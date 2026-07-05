import "server-only";

import { createHash, randomUUID } from "crypto";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseTenantBrandingMetadata } from "./tenantBrandingCore";
import { loadTenantBranding } from "./tenantSettings";
import {
  assertAllowedTenantLogoFile,
  TENANT_BRANDING_BUCKET,
} from "./tenantBrandingStorageCore";

export {
  assertAllowedTenantLogoFile,
  buildTenantLogoStoragePath,
  TENANT_BRANDING_BUCKET,
  TENANT_LOGO_MAX_BYTES,
} from "./tenantBrandingStorageCore";

function buildTenantLogoStoragePathWithHash(
  tenantId: string,
  originalFilename: string,
  contentType: string
): string {
  const tid = tenantId.trim();
  const base = originalFilename.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "logo";
  const ext =
    contentType === "image/png"
      ? "png"
      : contentType === "image/jpeg"
        ? "jpg"
        : contentType === "image/webp"
          ? "webp"
          : contentType === "image/svg+xml"
            ? "svg"
            : "png";
  const hash = createHash("sha256")
    .update(`${tid}:${Date.now()}:${randomUUID()}:${base}`)
    .digest("hex")
    .slice(0, 12);
  const safeName = base.replace(/\.[^.]+$/, "");
  return `tenant-branding/${tid}/logo/${Date.now()}-${hash}-${safeName}.${ext}`;
}

export async function resolveTenantLogoSignedUrl(
  metadata: Record<string, unknown> | null | undefined,
  ttlSec = 3600
): Promise<string | null> {
  const meta = parseTenantBrandingMetadata(metadata);
  const bucket = meta.logo_storage_bucket?.trim();
  const path = meta.logo_storage_path?.trim();
  if (!bucket || !path) return null;

  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttlSec);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

export async function uploadTenantLogoFile(
  tenantId: string,
  file: File
): Promise<{ ok: true; signedUrl: string; storagePath: string } | { ok: false; error: string }> {
  const check = assertAllowedTenantLogoFile(file);
  if (!check.ok) return check;

  const tid = tenantId.trim();
  const storagePath = buildTenantLogoStoragePathWithHash(tid, file.name, check.contentType);
  const buffer = Buffer.from(await file.arrayBuffer());

  const supabase = supabaseAdmin();
  const { error: uploadErr } = await supabase.storage
    .from(TENANT_BRANDING_BUCKET)
    .upload(storagePath, buffer, {
      contentType: check.contentType,
      upsert: false,
    });
  if (uploadErr) {
    return { ok: false, error: uploadErr.message || "Logo upload failed." };
  }

  const existing = await loadTenantBranding(tid);
  const prevMeta = existing?.metadata ?? {};
  const prevParsed = parseTenantBrandingMetadata(prevMeta);

  if (prevParsed.logo_storage_path && prevParsed.logo_storage_bucket) {
    await supabase.storage
      .from(prevParsed.logo_storage_bucket)
      .remove([prevParsed.logo_storage_path])
      .catch(() => undefined);
  }

  const now = new Date().toISOString();
  const metadata = {
    ...prevMeta,
    logo_storage_bucket: TENANT_BRANDING_BUCKET,
    logo_storage_path: storagePath,
    logo_uploaded_at: now,
  };

  const { error: upsertErr } = await supabase.from("fi_tenant_settings").upsert(
    {
      tenant_id: tid,
      brand_name: existing?.brand_name ?? null,
      logo_url: existing?.logo_url ?? null,
      primary_colour: existing?.primary_colour ?? null,
      secondary_colour: existing?.secondary_colour ?? null,
      accent_colour: existing?.accent_colour ?? null,
      support_email: existing?.support_email ?? null,
      default_timezone: existing?.default_timezone ?? null,
      metadata,
      updated_at: now,
    },
    { onConflict: "tenant_id" }
  );
  if (upsertErr) {
    await supabase.storage.from(TENANT_BRANDING_BUCKET).remove([storagePath]).catch(() => undefined);
    return { ok: false, error: upsertErr.message || "Could not save logo metadata." };
  }

  const signedUrl = await resolveTenantLogoSignedUrl(metadata);
  if (!signedUrl) {
    return { ok: false, error: "Logo uploaded but could not generate preview URL." };
  }

  return { ok: true, signedUrl, storagePath };
}

export async function removeTenantUploadedLogo(
  tenantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tid = tenantId.trim();
  const existing = await loadTenantBranding(tid);
  if (!existing) return { ok: true };

  const meta = parseTenantBrandingMetadata(existing.metadata);
  const supabase = supabaseAdmin();

  if (meta.logo_storage_path && meta.logo_storage_bucket) {
    await supabase.storage
      .from(meta.logo_storage_bucket)
      .remove([meta.logo_storage_path])
      .catch(() => undefined);
  }

  const nextMeta = { ...existing.metadata };
  delete nextMeta.logo_storage_bucket;
  delete nextMeta.logo_storage_path;
  delete nextMeta.logo_uploaded_at;

  try {
    const { error } = await supabase
      .from("fi_tenant_settings")
      .update({
        metadata: nextMeta,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tid);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Remove failed." };
  }
}
