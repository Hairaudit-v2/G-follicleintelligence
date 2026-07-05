"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import {
  loadClinicDiscoveryAdminContext,
  savePublicClinicDiscoverySettings,
} from "@/src/lib/hairaudit/clinicDiscovery/publicClinicProfileSettings.server";
import { runPublicClinicProfileSync } from "@/src/lib/hairaudit/clinicDiscovery/publicClinicProfileSync.server";
import type { RunPublicClinicProfileSyncResult } from "@/src/lib/hairaudit/clinicDiscovery/publicClinicProfileSync.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

const discoverySettingsSchema = z
  .object({
    public_profile_enabled: z.boolean(),
    search_visible: z.boolean(),
    accepts_independent_hairaudit_enquiries: z.boolean(),
    clinic_name: z.string().min(1).max(200),
    city_suburb: z.string().max(120).nullable().optional(),
    state_region: z.string().max(120).nullable().optional(),
    country: z.string().max(120).nullable().optional(),
    public_phone: z.string().max(80).nullable().optional(),
    public_email: z.string().email().max(200).nullable().optional().or(z.literal("")),
    public_website_url: z.string().url().max(500).nullable().optional().or(z.literal("")),
    public_booking_url: z.string().url().max(500).nullable().optional().or(z.literal("")),
    logo_brand_image_url: z.string().url().max(500).nullable().optional().or(z.literal("")),
    services_offered: z.array(z.string().max(120)).max(30),
    profile_summary: z.string().max(500).nullable().optional(),
    profile_bio: z.string().max(4000).nullable().optional(),
  })
  .strict();

const saveSchema = z
  .object({
    fi_clinic_id: z.string().uuid(),
    settings: discoverySettingsSchema,
  })
  .strict();

const syncSchema = z
  .object({
    fi_clinic_id: z.string().uuid().optional(),
    dryRun: z.boolean().optional(),
  })
  .strict();

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function normalizeNullable(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  return value.trim();
}

function revalidateDiscoveryPaths(tenantId: string) {
  revalidatePath(`/fi-admin/${tenantId.trim()}/settings/hairaudit-discovery`);
  revalidatePath(`/fi-admin/${tenantId.trim()}/configuration`);
}

export async function saveHairAuditClinicDiscoverySettingsAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    await assertFiTenantPortalAccess(tenantId);
    const parsed = saveSchema.parse(body);
    await savePublicClinicDiscoverySettings({
      tenantId,
      fiClinicId: parsed.fi_clinic_id,
      settings: {
        ...parsed.settings,
        city_suburb: normalizeNullable(parsed.settings.city_suburb),
        state_region: normalizeNullable(parsed.settings.state_region),
        country: normalizeNullable(parsed.settings.country),
        public_phone: normalizeNullable(parsed.settings.public_phone),
        public_email: normalizeNullable(parsed.settings.public_email),
        public_website_url: normalizeNullable(parsed.settings.public_website_url),
        public_booking_url: normalizeNullable(parsed.settings.public_booking_url),
        logo_brand_image_url: normalizeNullable(parsed.settings.logo_brand_image_url),
        profile_summary: normalizeNullable(parsed.settings.profile_summary),
        profile_bio: normalizeNullable(parsed.settings.profile_bio),
      },
    });
    revalidateDiscoveryPaths(tenantId);
    return { ok: true, message: "HairAudit discovery settings saved." };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function previewHairAuditClinicDiscoveryAction(
  tenantId: string,
  fiClinicId: string
) {
  try {
    await assertFiTenantPortalAccess(tenantId);
    const context = await loadClinicDiscoveryAdminContext(tenantId, fiClinicId);
    return { ok: true as const, preview: context.preview };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function runHairAuditClinicDiscoverySyncAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; data: RunPublicClinicProfileSyncResult; message: string }
  | { ok: false; error: string }
> {
  try {
    await assertFiTenantPortalAccess(tenantId);
    const parsed = syncSchema.parse(body);
    const result = await runPublicClinicProfileSync({
      tenantId,
      fiClinicId: parsed.fi_clinic_id,
      dryRun: parsed.dryRun ?? true,
    });
    if (!result.summary.dryRun) revalidateDiscoveryPaths(tenantId);
    const message = result.summary.dryRun
      ? `Dry run: ${result.summary.wouldCreate} would create, ${result.summary.wouldUpdate} would update.`
      : `Sync complete: ${result.summary.created} created, ${result.summary.updated} updated.`;
    return { ok: true, data: result, message };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}