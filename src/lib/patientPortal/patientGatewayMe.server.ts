import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadTenantBranding } from "@/src/lib/fi/foundation/tenantSettings";

import { writePatientGatewayAudit } from "./patientGatewayAudit.server";
import { buildPatientGatewayMeResponse } from "./patientGatewayMeCore";
import type { PatientGatewayContext, PatientGatewayMeResponse } from "./patientGatewayTypes";

function asMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

function asTrimmed(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Resolve tenant/brand display name without falling back to location labels.
 * Prefer tenant settings → organisation settings → organisation name.
 */
async function loadTenantBrandDisplayName(
  tenantId: string,
  client: SupabaseClient,
  tenantSettingsBrandName: string | null
): Promise<string | null> {
  if (tenantSettingsBrandName) return tenantSettingsBrandName;

  const { data: orgSettings } = await client
    .from("fi_organisation_settings")
    .select("brand_name")
    .eq("tenant_id", tenantId)
    .not("brand_name", "is", null)
    .limit(20);

  if (Array.isArray(orgSettings)) {
    for (const row of orgSettings) {
      const name = asTrimmed((row as { brand_name?: unknown }).brand_name);
      if (name) return name;
    }
  }

  const { data: orgs } = await client
    .from("fi_organisations")
    .select("name")
    .eq("tenant_id", tenantId)
    .limit(20);

  if (Array.isArray(orgs)) {
    for (const row of orgs) {
      const name = asTrimmed((row as { name?: unknown }).name);
      if (name) return name;
    }
  }

  return null;
}

/**
 * Load patient-safe /me payload for an already-resolved gateway context.
 * Never returns portal_auth_user_id, admin notes, or CRM internals.
 */
export async function loadPatientGatewayMe(
  ctx: PatientGatewayContext,
  client?: SupabaseClient
): Promise<PatientGatewayMeResponse> {
  const supabase = client ?? supabaseAdmin();

  const { data: patientRow, error: patientErr } = await supabase
    .from("fi_patients")
    .select("id, tenant_id, person_id, metadata")
    .eq("tenant_id", ctx.tenantId)
    .eq("id", ctx.patientId)
    .maybeSingle();
  if (patientErr) throw new Error(patientErr.message);
  if (!patientRow) throw new Error("Patient not found for gateway context.");

  const { data: personRow, error: personErr } = await supabase
    .from("fi_persons")
    .select("id, tenant_id, metadata")
    .eq("tenant_id", ctx.tenantId)
    .eq("id", ctx.personId)
    .maybeSingle();
  if (personErr) throw new Error(personErr.message);
  if (!personRow) throw new Error("Person not found for gateway context.");

  let branding: {
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    accentColor: string | null;
  } = {
    logoUrl: null,
    primaryColor: null,
    secondaryColor: null,
    accentColor: null,
  };
  let settingsBrandName: string | null = null;

  try {
    const settings = await loadTenantBranding(ctx.tenantId, supabase);
    if (settings) {
      settingsBrandName = settings.brand_name?.trim() || null;
      branding = {
        logoUrl: settings.logo_url,
        primaryColor: settings.primary_colour,
        secondaryColor: settings.secondary_colour,
        accentColor: settings.accent_colour,
      };
    }
  } catch {
    /* branding is optional for /me */
  }

  // ctx.clinicName is the location/site label (historically fi_tenants.name, e.g. Perth).
  const locationName = asTrimmed(ctx.clinicName);
  const tenantName = await loadTenantBrandDisplayName(ctx.tenantId, supabase, settingsBrandName);

  const response = buildPatientGatewayMeResponse({
    patientId: ctx.patientId,
    clinicId: ctx.tenantId,
    clinicName: tenantName,
    locationName,
    personMetadata: asMeta((personRow as { metadata?: unknown }).metadata),
    patientMetadata: asMeta((patientRow as { metadata?: unknown }).metadata),
    branding,
  });

  writePatientGatewayAudit({
    action: "me_ok",
    outcome: "allow",
    authUserId: ctx.authUserId,
    patientId: ctx.patientId,
    tenantId: ctx.tenantId,
    resourceKind: "me",
  });

  return response;
}
