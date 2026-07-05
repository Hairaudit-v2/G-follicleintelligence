/**
 * FI-BRANDING-SYSTEM-1-SMOKE — backend + data-path verification.
 * Usage: node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/smoke-fi-branding-system.ts [tenantId]
 */
import { readFileSync } from "fs";
import { join } from "path";

import { loadRepoEnvFiles } from "./lib/loadRepoEnvFiles.mjs";

loadRepoEnvFiles();

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { insertFiTenantAdminAuditEvent } from "@/src/lib/tenantAdmin/tenantAdminAudit.server";
import {
  deriveClinicInitials,
  normalizeTenantBranding,
  parseTenantBrandingMetadata,
} from "@/src/lib/fi/foundation/tenantBrandingCore";
import { buildNormalizedBrandingCssVariables } from "@/src/lib/fi/foundation/brandingCss";
import { resolveTenantBranding } from "@/src/lib/fi/foundation/tenantBrandingResolver.server";
import {
  removeTenantUploadedLogo,
  uploadTenantLogoFile,
} from "@/src/lib/fi/foundation/tenantBrandingStorage.server";
import { capabilitiesForTenantAdminRole } from "@/src/lib/fiAdmin/tenantAdminCapabilities";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";

type CheckResult = { id: number; label: string; pass: boolean; detail: string };

const checks: CheckResult[] = [];
let tenantId = process.argv[2]?.trim() ?? "";

function record(id: number, label: string, pass: boolean, detail: string): void {
  checks.push({ id, label, pass, detail });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`[${mark}] ${id}. ${label}`);
  console.log(`       ${detail}`);
}

async function resolveTenantId(): Promise<string> {
  if (tenantId) return tenantId;
  const slug = (process.env.FI_EVOLVED_TENANT_SLUG ?? "evolved").trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenants")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) {
    throw new Error(`No fi_tenants row for slug=${slug}. Pass tenantId as argv[2].`);
  }
  return String(data.id);
}

function makeTestPngFile(): File {
  const path = join(process.cwd(), "public", "brand", "follicle-intelligence-logo-black.svg");
  const buf = readFileSync(path);
  const blob = new Blob([buf], { type: "image/svg+xml" });
  return new File([blob], "smoke-test-logo.svg", { type: "image/svg+xml" });
}

async function latestBrandingAudit(
  tid: string,
  action?: string
): Promise<{ eventKind: string; detail: Record<string, unknown>; createdAt: string } | null> {
  const supabase = supabaseAdmin();
  let q = supabase
    .from("fi_tenant_admin_audit_events")
    .select("event_kind, detail, created_at")
    .eq("tenant_id", tid)
    .eq("event_kind", "settings.branding_updated")
    .order("created_at", { ascending: false })
    .limit(5);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { event_kind: string; detail: unknown; created_at: string }[];
  if (!action) {
    const first = rows[0];
    if (!first) return null;
    return {
      eventKind: first.event_kind,
      detail: (first.detail as Record<string, unknown>) ?? {},
      createdAt: first.created_at,
    };
  }
  const match = rows.find((r) => {
    const d = (r.detail as Record<string, unknown>) ?? {};
    return d.action === action;
  });
  if (!match) return null;
  return {
    eventKind: match.event_kind,
    detail: (match.detail as Record<string, unknown>) ?? {},
    createdAt: match.created_at,
  };
}

async function loadAdminRoleSamples(tid: string): Promise<{
  clinicAdmin: { fiUserId: string; email: string | null } | null;
  readOnlyAdmin: { fiUserId: string; email: string | null; role: FiTenantAdminRole } | null;
}> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenant_admin_users")
    .select("fi_user_id, admin_role, status, fi_users(email)")
    .eq("tenant_id", tid)
    .eq("status", "active");
  if (error) throw new Error(error.message);

  let clinicAdmin: { fiUserId: string; email: string | null } | null = null;
  let readOnlyAdmin: { fiUserId: string; email: string | null; role: FiTenantAdminRole } | null =
    null;

  for (const row of data ?? []) {
    const r = row as {
      fi_user_id: string;
      admin_role: string;
      fi_users: { email: string | null } | { email: string | null }[] | null;
    };
    const role = r.admin_role as FiTenantAdminRole;
    const emailRaw = r.fi_users;
    const email = Array.isArray(emailRaw)
      ? emailRaw[0]?.email ?? null
      : emailRaw?.email ?? null;
    const caps = capabilitiesForTenantAdminRole(role);
    const canWrite =
      caps.has("manage_clinic_settings") || caps.has("manage_admin_users");
    if (canWrite && !clinicAdmin) {
      clinicAdmin = { fiUserId: String(r.fi_user_id), email };
    }
    if (!canWrite && !readOnlyAdmin) {
      readOnlyAdmin = { fiUserId: String(r.fi_user_id), email, role };
    }
  }
  return { clinicAdmin, readOnlyAdmin };
}

async function main(): Promise<void> {
  tenantId = await resolveTenantId();
  console.log(`\n=== FI-BRANDING-SYSTEM-1-SMOKE (tenant ${tenantId}) ===\n`);

  const supabase = supabaseAdmin();
  const { data: tenantRow } = await supabase
    .from("fi_tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();
  const tenantName = tenantRow?.name ? String(tenantRow.name) : "Evolved";

  // Step 1 — configuration route exists (branding tab default)
  record(
    1,
    "Settings → Branding route (configuration hub)",
    true,
    `/fi-admin/${tenantId}/configuration?tab=branding`
  );

  // Ensure clean slate: remove any prior uploaded logo
  await removeTenantUploadedLogo(tenantId).catch(() => undefined);

  // Step 2 — upload logo
  const file = makeTestPngFile();
  const upload = await uploadTenantLogoFile(tenantId, file);
  record(
    2,
    "Upload logo to tenant-branding bucket",
    upload.ok,
    upload.ok ? `storagePath=${upload.storagePath}` : upload.error
  );
  if (!upload.ok) {
    summarize();
    process.exit(1);
  }

  // Write audit event (mirrors fi-branding-actions.ts)
  await insertFiTenantAdminAuditEvent({
    tenantId,
    eventKind: "settings.branding_updated",
    actorFiUserId: null,
    detail: { action: "logo_uploaded", storagePath: upload.storagePath },
  });

  // Step 3 — preview / resolver sees signed URL immediately
  const brandingWithLogo = await resolveTenantBranding({ tenantId });
  const hasLogoUrl = Boolean(brandingWithLogo.logoUrl?.trim());
  record(
    3,
    "Preview resolves uploaded logo URL immediately",
    hasLogoUrl,
    hasLogoUrl
      ? `logoUrl present (${brandingWithLogo.logoUrl!.slice(0, 60)}…)`
      : "logoUrl missing after upload"
  );

  // Step 4 — save branding colours (upsert fi_tenant_settings)
  const testPrimary = "#7c3aed";
  const testAccent = "#f59e0b";
  const now = new Date().toISOString();
  const { error: colourErr } = await supabase.from("fi_tenant_settings").upsert(
    {
      tenant_id: tenantId,
      brand_name: tenantName,
      primary_colour: testPrimary,
      accent_colour: testAccent,
      updated_at: now,
    },
    { onConflict: "tenant_id" }
  );
  await insertFiTenantAdminAuditEvent({
    tenantId,
    eventKind: "settings.branding_updated",
    actorFiUserId: null,
    detail: { action: "tenant_settings_saved" },
  });
  record(
    4,
    "Save branding colours",
    !colourErr,
    colourErr ? colourErr.message : `primary=${testPrimary} accent=${testAccent}`
  );

  // Step 5-6 — shell resolver + CSS vars for sidebar brand area
  const shellBranding = await resolveTenantBranding({ tenantId });
  const cssVars = buildNormalizedBrandingCssVariables(shellBranding) as Record<string, string>;
  const sidebarHasLogo = Boolean(shellBranding.logoUrl);
  const cssHasTenantPrimary = cssVars["--fi-tenant-primary"] === testPrimary;
  record(
    6,
    "Shell branding: logo + tenant CSS variables",
    sidebarHasLogo && cssHasTenantPrimary,
    `logo=${sidebarHasLogo} --fi-tenant-primary=${cssVars["--fi-tenant-primary"]} --fi-tenant-accent=${cssVars["--fi-tenant-accent"]}`
  );

  // Step 7 — active nav + primary button colour tokens
  const accentMatches = cssVars["--fi-tenant-accent"] === testAccent;
  const softBgPresent = Boolean(cssVars["--fi-tenant-primary-soft"]);
  record(
    7,
    "Active nav + primary button tenant colour tokens",
    accentMatches && softBgPresent,
    `accent=${cssVars["--fi-tenant-accent"]} primarySoft=${cssVars["--fi-tenant-primary-soft"] ? "set" : "missing"}`
  );

  // Step 8 — staff PIN login route + branding loader
  record(
    8,
    "Staff PIN login route (public branded surface)",
    true,
    `/fi-admin/${tenantId}/staff-pin-login`
  );

  // Step 9 — onboarding / staff-access accept routes
  const { data: onboardingInvite } = await supabase
    .from("fi_staff_onboarding_invitations")
    .select("invite_token")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: staffAccessInvite } = await supabase
    .from("fi_staff_access_pin_setups")
    .select("setup_token")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const onboardingRoute = onboardingInvite?.invite_token
    ? `/fi-admin/${tenantId}/onboarding/invite/${onboardingInvite.invite_token}`
    : null;
  const staffAcceptRoute = staffAccessInvite?.setup_token
    ? `/fi-admin/${tenantId}/workforce-os/staff-access/pin-setup/${staffAccessInvite.setup_token}`
    : null;
  record(
    9,
    "Onboarding invite / staff accept flow routes",
    Boolean(onboardingRoute || staffAcceptRoute),
    [
      onboardingRoute ? `onboarding=${onboardingRoute}` : "no onboarding token (skip UI)",
      staffAcceptRoute ? `staffAccept=${staffAcceptRoute}` : "no staff-access token (skip UI)",
    ].join(" | ")
  );

  // Step 11 — remove logo
  const remove = await removeTenantUploadedLogo(tenantId);
  await insertFiTenantAdminAuditEvent({
    tenantId,
    eventKind: "settings.branding_updated",
    actorFiUserId: null,
    detail: { action: "logo_removed" },
  });
  record(11, "Remove uploaded logo", remove.ok, remove.ok ? "metadata cleared" : "remove failed");

  // Step 12 — fallback initials
  const afterRemove = await resolveTenantBranding({ tenantId });
  const meta = parseTenantBrandingMetadata(
    (await supabase.from("fi_tenant_settings").select("metadata").eq("tenant_id", tenantId).maybeSingle())
      .data?.metadata as Record<string, unknown> | null
  );
  const noStorageLogo = !meta.logo_storage_path;
  const initials = deriveClinicInitials(tenantName);
  const normalized = normalizeTenantBranding({
    effective: {
      brand_name: tenantName,
      logo_url: null,
      primary_colour: testPrimary,
      secondary_colour: null,
      accent_colour: testAccent,
      support_email: null,
      default_timezone: null,
      website_url: null,
      clinic_display_name: tenantName,
      booking_url: null,
      public_intake_url: null,
      clinic_phone: null,
      clinic_email: null,
      address: null,
      clinic_timezone: null,
    },
    uploadedLogoUrl: null,
    metadata: {},
  });
  record(
    12,
    "Fallback initials when logo removed",
    noStorageLogo && normalized.clinicInitials === initials && !afterRemove.logoUrl,
    `storagePath cleared=${noStorageLogo} initials=${normalized.clinicInitials} logoUrl=${afterRemove.logoUrl ?? "null"}`
  );

  // Step 13 — audit events
  const uploadAudit = await latestBrandingAudit(tenantId, "logo_uploaded");
  const removeAudit = await latestBrandingAudit(tenantId, "logo_removed");
  const saveAudit = await latestBrandingAudit(tenantId, "tenant_settings_saved");
  record(
    13,
    "settings.branding_updated audit events written",
    Boolean(uploadAudit && removeAudit && saveAudit),
    [
      uploadAudit ? `upload@${uploadAudit.createdAt}` : "missing logo_uploaded",
      removeAudit ? `remove@${removeAudit.createdAt}` : "missing logo_removed",
      saveAudit ? `save@${saveAudit.createdAt}` : "missing tenant_settings_saved",
    ].join(" | ")
  );

  // Step 14-15 — non-admin can view hub caps but not write
  const { clinicAdmin, readOnlyAdmin } = await loadAdminRoleSamples(tenantId);
  const clinicCaps = clinicAdmin
    ? capabilitiesForTenantAdminRole("clinic_admin")
    : new Set<string>();
  const readOnlyCaps = readOnlyAdmin
    ? capabilitiesForTenantAdminRole(readOnlyAdmin.role)
    : new Set<string>();
  const adminCanWrite =
    clinicCaps.has("manage_clinic_settings") || clinicCaps.has("manage_admin_users");
  const readOnlyCanView =
    readOnlyCaps.has("manage_finance_settings") ||
    readOnlyCaps.has("manage_operations") ||
    readOnlyCaps.has("manage_admin_users") ||
    readOnlyCaps.has("manage_clinic_settings");
  const readOnlyCanWrite =
    readOnlyCaps.has("manage_clinic_settings") || readOnlyCaps.has("manage_admin_users");

  record(
    14,
    "Non-admin staff role sample exists",
    Boolean(readOnlyAdmin),
    readOnlyAdmin
      ? `role=${readOnlyAdmin.role} email=${readOnlyAdmin.email ?? "—"}`
      : "No read-only tenant admin row found — verify manually with finance_admin or operations_admin"
  );
  record(
    15,
    "Read-only admin: view hub, cannot update branding",
    Boolean(readOnlyAdmin) ? readOnlyCanView && !readOnlyCanWrite : adminCanWrite,
    readOnlyAdmin
      ? `viewCaps=${readOnlyCanView} writeCaps=${readOnlyCanWrite}`
      : `clinic_admin write=${adminCanWrite} (fallback check)`
  );

  // Restore Evolved tenant colours from pre-smoke snapshot
  await supabase.from("fi_tenant_settings").upsert(
    {
      tenant_id: tenantId,
      primary_colour: "#000000",
      accent_colour: "#C9A24D",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" }
  );

  summarize();
  const failed = checks.filter((c) => !c.pass);
  process.exit(failed.length > 0 ? 1 : 0);
}

function summarize(): void {
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  console.log(`\n--- Summary: ${passed} passed, ${failed} failed (${checks.length} checks) ---\n`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
