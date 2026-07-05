/**
 * FI-BRANDING-SYSTEM-1C — end-to-end smoke of the tenant branding save path
 * against the configured Supabase project, using the same server modules the
 * settings UI actions call (no HTTP/auth layer).
 *
 * Verifies:
 *  1. upsertFiTenantSettings persists brand/colour fields (and preserves metadata).
 *  2. uploadTenantLogoFile stores the object + writes logo_storage_* metadata.
 *  3. resolveTenantBranding prefers uploaded logo > legacy logo_url > initials.
 *  4. removeTenantUploadedLogo deletes the object + clears metadata.
 *
 * Mutates the target tenant's branding row and restores the original values.
 * Default tenant: Demo Clinic. Override with FI_BRANDING_SMOKE_TENANT_ID.
 *
 * Run: npm run smoke:branding
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadRepoEnvFiles(): void {
  for (const name of [".env.local", ".env"] as const) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    let raw = readFileSync(p, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const s = t.startsWith("export ") ? t.slice(7).trim() : t;
      const eq = s.indexOf("=");
      if (eq <= 0) continue;
      const key = s.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      let val = s.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}
loadRepoEnvFiles();

const DEMO_TENANT_ID = "cef53cb8-04b6-4e06-878a-5ba065c22425"; // Demo Clinic

// 1x1 transparent PNG.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg: string): void {
  console.log(`ok: ${msg}`);
}

async function main() {
  const tenantId = process.env.FI_BRANDING_SMOKE_TENANT_ID?.trim() || DEMO_TENANT_ID;

  const { loadTenantBranding, upsertFiTenantSettings } = await import(
    "../src/lib/fi/foundation/tenantSettings"
  );
  const { uploadTenantLogoFile, removeTenantUploadedLogo, resolveTenantLogoSignedUrl } =
    await import("../src/lib/fi/foundation/tenantBrandingStorage.server");
  const { resolveTenantBranding } = await import(
    "../src/lib/fi/foundation/tenantBrandingResolver.server"
  );
  const { parseTenantBrandingMetadata } = await import(
    "../src/lib/fi/foundation/tenantBrandingCore"
  );

  const original = await loadTenantBranding(tenantId);
  console.log(`tenant ${tenantId} — original row ${original ? "exists" : "missing"}`);

  const stamp = new Date().toISOString();
  try {
    // --- 1. Settings save ---
    await upsertFiTenantSettings(tenantId, {
      brand_name: "Branding Smoke Clinic",
      logo_url: "/brand/smoke-legacy-logo.png",
      primary_colour: "#123456",
      secondary_colour: original?.secondary_colour ?? null,
      accent_colour: "#abcdef",
      support_email: original?.support_email ?? null,
      default_timezone: original?.default_timezone ?? null,
    });
    const afterSave = await loadTenantBranding(tenantId);
    if (afterSave?.brand_name !== "Branding Smoke Clinic") fail("brand_name did not persist");
    if (afterSave?.primary_colour !== "#123456") fail("primary_colour did not persist");
    if (afterSave?.accent_colour !== "#abcdef") fail("accent_colour did not persist");
    pass("upsertFiTenantSettings persisted brand_name/primary/accent");

    // --- 2. Legacy priority (no upload yet) ---
    const brandingLegacy = await resolveTenantBranding({ tenantId });
    if (brandingLegacy.logoUrl !== "/brand/smoke-legacy-logo.png")
      fail(`expected legacy logo to win without upload, got ${brandingLegacy.logoUrl}`);
    pass("resolver uses legacy logo_url when no upload present");

    // --- 3. Upload ---
    const file = new File([TINY_PNG], `smoke-${stamp}.png`, { type: "image/png" });
    const uploaded = await uploadTenantLogoFile(tenantId, file);
    if (!uploaded.ok) fail(`uploadTenantLogoFile: ${uploaded.error}`);
    pass(`upload stored object at ${uploaded.storagePath}`);

    const afterUpload = await loadTenantBranding(tenantId);
    const meta = parseTenantBrandingMetadata(afterUpload?.metadata);
    if (meta.logo_storage_bucket !== "tenant-branding") fail("logo_storage_bucket not written");
    if (meta.logo_storage_path !== uploaded.storagePath) fail("logo_storage_path not written");
    if (!meta.logo_uploaded_at) fail("logo_uploaded_at not written");
    pass("metadata.logo_storage_bucket/path/uploaded_at persisted");

    if (afterUpload?.brand_name !== "Branding Smoke Clinic")
      fail("upload clobbered brand_name");
    pass("upload preserved brand/colour columns");

    const signed = await resolveTenantLogoSignedUrl(afterUpload?.metadata);
    if (!signed) fail("could not sign uploaded logo URL");
    pass("signed URL generated for uploaded logo");

    // --- 4. Uploaded logo wins over legacy ---
    const brandingUploaded = await resolveTenantBranding({ tenantId });
    if (!brandingUploaded.logoUrl?.includes(uploaded.storagePath.split("/").pop() ?? "@@"))
      fail(`expected uploaded logo to win, got ${brandingUploaded.logoUrl}`);
    if (brandingUploaded.logoUrlLegacy !== "/brand/smoke-legacy-logo.png")
      fail("legacy fallback lost after upload");
    pass("resolver prefers uploaded logo over legacy logo_url");

    // --- 5. Remove upload ---
    const removed = await removeTenantUploadedLogo(tenantId);
    if (!removed.ok) fail(`removeTenantUploadedLogo: ${removed.error}`);
    const afterRemove = await loadTenantBranding(tenantId);
    const metaAfter = parseTenantBrandingMetadata(afterRemove?.metadata);
    if (metaAfter.logo_storage_path) fail("logo_storage_path not cleared after remove");
    pass("remove cleared storage metadata");

    // --- 6. Initials only when both sources absent ---
    await upsertFiTenantSettings(tenantId, {
      brand_name: "Branding Smoke Clinic",
      logo_url: null,
      primary_colour: "#123456",
      secondary_colour: original?.secondary_colour ?? null,
      accent_colour: "#abcdef",
      support_email: original?.support_email ?? null,
      default_timezone: original?.default_timezone ?? null,
    });
    const brandingNone = await resolveTenantBranding({ tenantId });
    if (brandingNone.logoUrl !== null)
      fail(`expected no logo when both sources absent, got ${brandingNone.logoUrl}`);
    if (!brandingNone.clinicInitials) fail("initials missing in fallback state");
    pass(`initials fallback active (${brandingNone.clinicInitials})`);
  } finally {
    // --- Restore original values ---
    await upsertFiTenantSettings(tenantId, {
      brand_name: original?.brand_name ?? null,
      logo_url: original?.logo_url ?? null,
      primary_colour: original?.primary_colour ?? null,
      secondary_colour: original?.secondary_colour ?? null,
      accent_colour: original?.accent_colour ?? null,
      support_email: original?.support_email ?? null,
      default_timezone: original?.default_timezone ?? null,
    });
    console.log("restored original branding row values");
  }

  console.log("SMOKE PASS: branding save pipeline verified end-to-end");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
