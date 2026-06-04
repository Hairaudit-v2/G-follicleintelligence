/**
 * Stage 1K–1L — tenant / organisation / clinic settings & branding.
 * Loaders are read-only; upsert helpers are service-role / server-only (FI Admin actions + gate).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FoundationSupabase } from "./types";

export type FiTenantSettingsRow = {
  id: string;
  tenant_id: string;
  brand_name: string | null;
  logo_url: string | null;
  primary_colour: string | null;
  secondary_colour: string | null;
  accent_colour: string | null;
  support_email: string | null;
  default_timezone: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type FiOrganisationSettingsRow = {
  id: string;
  tenant_id: string;
  organisation_id: string;
  brand_name: string | null;
  logo_url: string | null;
  primary_colour: string | null;
  secondary_colour: string | null;
  accent_colour: string | null;
  website_url: string | null;
  support_email: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type FiClinicSettingsRow = {
  id: string;
  tenant_id: string;
  clinic_id: string;
  display_name: string | null;
  booking_url: string | null;
  public_intake_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Merged visual and contact defaults after tenant → organisation → clinic cascade. */
export type EffectiveBranding = {
  brand_name: string | null;
  logo_url: string | null;
  primary_colour: string | null;
  secondary_colour: string | null;
  accent_colour: string | null;
  support_email: string | null;
  default_timezone: string | null;
  website_url: string | null;
  clinic_display_name: string | null;
  booking_url: string | null;
  public_intake_url: string | null;
  clinic_phone: string | null;
  clinic_email: string | null;
  address: string | null;
  clinic_timezone: string | null;
};

export type ResolveEffectiveBrandingParams = {
  tenantId: string;
  organisationId?: string | null;
  clinicId?: string | null;
};

export type OrganisationWithSettings = {
  organisation: { id: string; name: string; slug: string | null };
  settings: FiOrganisationSettingsRow | null;
};

export type ClinicWithSettings = {
  clinic: { id: string; display_name: string; organisation_id: string | null };
  settings: FiClinicSettingsRow | null;
};

export type TenantConfigurationOverview = {
  tenant_id: string;
  tenant_settings: FiTenantSettingsRow | null;
  organisations: OrganisationWithSettings[];
  clinics: ClinicWithSettings[];
};

function asRecordMeta(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

export async function loadTenantBranding(
  tenantId: string,
  client?: FoundationSupabase
): Promise<FiTenantSettingsRow | null> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const { data, error } = await supabase.from("fi_tenant_settings").select("*").eq("tenant_id", tid).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    brand_name: (r.brand_name as string | null) ?? null,
    logo_url: (r.logo_url as string | null) ?? null,
    primary_colour: (r.primary_colour as string | null) ?? null,
    secondary_colour: (r.secondary_colour as string | null) ?? null,
    accent_colour: (r.accent_colour as string | null) ?? null,
    support_email: (r.support_email as string | null) ?? null,
    default_timezone: (r.default_timezone as string | null) ?? null,
    metadata: asRecordMeta(r.metadata),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function loadOrganisationBranding(
  tenantId: string,
  organisationId: string,
  client?: FoundationSupabase
): Promise<FiOrganisationSettingsRow | null> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const oid = organisationId.trim();
  const { data, error } = await supabase
    .from("fi_organisation_settings")
    .select("*")
    .eq("tenant_id", tid)
    .eq("organisation_id", oid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    organisation_id: String(r.organisation_id),
    brand_name: (r.brand_name as string | null) ?? null,
    logo_url: (r.logo_url as string | null) ?? null,
    primary_colour: (r.primary_colour as string | null) ?? null,
    secondary_colour: (r.secondary_colour as string | null) ?? null,
    accent_colour: (r.accent_colour as string | null) ?? null,
    website_url: (r.website_url as string | null) ?? null,
    support_email: (r.support_email as string | null) ?? null,
    metadata: asRecordMeta(r.metadata),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function loadClinicSettings(
  tenantId: string,
  clinicId: string,
  client?: FoundationSupabase
): Promise<FiClinicSettingsRow | null> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const cid = clinicId.trim();
  const { data, error } = await supabase
    .from("fi_clinic_settings")
    .select("*")
    .eq("tenant_id", tid)
    .eq("clinic_id", cid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    clinic_id: String(r.clinic_id),
    display_name: (r.display_name as string | null) ?? null,
    booking_url: (r.booking_url as string | null) ?? null,
    public_intake_url: (r.public_intake_url as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    address: (r.address as string | null) ?? null,
    timezone: (r.timezone as string | null) ?? null,
    metadata: asRecordMeta(r.metadata),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

/**
 * Cascade: tenant → organisation (colours, logo, brand name, web, support) → clinic (contact, URLs, display, timezone).
 * Clinic does not define brand colours in schema; colours come from organisation then tenant.
 */
export async function resolveEffectiveBranding(
  params: ResolveEffectiveBrandingParams,
  client?: FoundationSupabase
): Promise<EffectiveBranding> {
  const tenant = await loadTenantBranding(params.tenantId, client);
  const org = params.organisationId?.trim()
    ? await loadOrganisationBranding(params.tenantId, params.organisationId, client)
    : null;
  const clinic = params.clinicId?.trim()
    ? await loadClinicSettings(params.tenantId, params.clinicId, client)
    : null;

  const pick = <T extends string | null>(clinicVal: T | undefined, orgVal: T | null | undefined, tenantVal: T | null | undefined): T | null => {
    const c = clinicVal !== undefined ? clinicVal : undefined;
    if (c !== undefined && c !== null && String(c).trim() !== "") return c;
    if (orgVal !== undefined && orgVal !== null && String(orgVal).trim() !== "") return orgVal;
    if (tenantVal !== undefined && tenantVal !== null && String(tenantVal).trim() !== "") return tenantVal;
    return null;
  };

  const brandName =
    clinic?.display_name?.trim() ? clinic.display_name : org?.brand_name ?? tenant?.brand_name ?? null;

  return {
    brand_name: brandName,
    logo_url: pick(undefined, org?.logo_url, tenant?.logo_url),
    primary_colour: pick(undefined, org?.primary_colour, tenant?.primary_colour),
    secondary_colour: pick(undefined, org?.secondary_colour, tenant?.secondary_colour),
    accent_colour: pick(undefined, org?.accent_colour, tenant?.accent_colour),
    support_email: org?.support_email ?? tenant?.support_email ?? null,
    default_timezone: clinic?.timezone?.trim() ? clinic.timezone : tenant?.default_timezone ?? null,
    website_url: org?.website_url ?? null,
    clinic_display_name: clinic?.display_name ?? null,
    booking_url: clinic?.booking_url ?? null,
    public_intake_url: clinic?.public_intake_url ?? null,
    clinic_phone: clinic?.phone ?? null,
    clinic_email: clinic?.email ?? null,
    address: clinic?.address ?? null,
    clinic_timezone: clinic?.timezone ?? null,
  };
}

/** Load tenant settings plus all organisations and clinics (with optional settings rows) for admin overview. */
export async function loadTenantConfigurationOverview(
  tenantId: string,
  client?: FoundationSupabase
): Promise<TenantConfigurationOverview> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = tenantId.trim();

  const tenant_settings = await loadTenantBranding(tid, client);

  const { data: orgs, error: oErr } = await supabase
    .from("fi_organisations")
    .select("id, name, slug")
    .eq("tenant_id", tid)
    .order("name", { ascending: true });
  if (oErr) throw new Error(oErr.message);

  const { data: orgSettings, error: osErr } = await supabase
    .from("fi_organisation_settings")
    .select("*")
    .eq("tenant_id", tid);
  if (osErr) throw new Error(osErr.message);
  const orgSettingsByOrg = new Map<string, FiOrganisationSettingsRow>();
  for (const row of orgSettings ?? []) {
    const r = row as Record<string, unknown>;
    orgSettingsByOrg.set(String(r.organisation_id), {
      id: String(r.id),
      tenant_id: String(r.tenant_id),
      organisation_id: String(r.organisation_id),
      brand_name: (r.brand_name as string | null) ?? null,
      logo_url: (r.logo_url as string | null) ?? null,
      primary_colour: (r.primary_colour as string | null) ?? null,
      secondary_colour: (r.secondary_colour as string | null) ?? null,
      accent_colour: (r.accent_colour as string | null) ?? null,
      website_url: (r.website_url as string | null) ?? null,
      support_email: (r.support_email as string | null) ?? null,
      metadata: asRecordMeta(r.metadata),
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    });
  }

  const organisations: OrganisationWithSettings[] = (orgs ?? []).map((o) => {
    const r = o as { id: string; name: string; slug: string | null };
    return {
      organisation: { id: String(r.id), name: String(r.name), slug: r.slug },
      settings: orgSettingsByOrg.get(String(r.id)) ?? null,
    };
  });

  const { data: clinics, error: cErr } = await supabase
    .from("fi_clinics")
    .select("id, display_name, organisation_id")
    .eq("tenant_id", tid)
    .order("display_name", { ascending: true });
  if (cErr) throw new Error(cErr.message);

  const { data: clinicSettings, error: csErr } = await supabase.from("fi_clinic_settings").select("*").eq("tenant_id", tid);
  if (csErr) throw new Error(csErr.message);
  const clinicSettingsByClinic = new Map<string, FiClinicSettingsRow>();
  for (const row of clinicSettings ?? []) {
    const r = row as Record<string, unknown>;
    clinicSettingsByClinic.set(String(r.clinic_id), {
      id: String(r.id),
      tenant_id: String(r.tenant_id),
      clinic_id: String(r.clinic_id),
      display_name: (r.display_name as string | null) ?? null,
      booking_url: (r.booking_url as string | null) ?? null,
      public_intake_url: (r.public_intake_url as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
      email: (r.email as string | null) ?? null,
      address: (r.address as string | null) ?? null,
      timezone: (r.timezone as string | null) ?? null,
      metadata: asRecordMeta(r.metadata),
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    });
  }

  const clinicsOut: ClinicWithSettings[] = (clinics ?? []).map((c) => {
    const r = c as { id: string; display_name: string; organisation_id: string | null };
    return {
      clinic: {
        id: String(r.id),
        display_name: String(r.display_name),
        organisation_id: r.organisation_id,
      },
      settings: clinicSettingsByClinic.get(String(r.id)) ?? null,
    };
  });

  return {
    tenant_id: tid,
    tenant_settings,
    organisations,
    clinics: clinicsOut,
  };
}

/** Returns true when `fi_organisations` has a row for this tenant and id. */
export async function organisationBelongsToTenant(
  tenantId: string,
  organisationId: string,
  client?: FoundationSupabase
): Promise<boolean> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const oid = organisationId.trim();
  const { data, error } = await supabase.from("fi_organisations").select("id").eq("tenant_id", tid).eq("id", oid).maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

/** Returns true when `fi_clinics` has a row for this tenant and id. */
export async function clinicBelongsToTenant(
  tenantId: string,
  clinicId: string,
  client?: FoundationSupabase
): Promise<boolean> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const cid = clinicId.trim();
  const { data, error } = await supabase.from("fi_clinics").select("id").eq("tenant_id", tid).eq("id", cid).maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

export type WriteFiTenantSettingsPayload = {
  brand_name: string | null;
  logo_url: string | null;
  primary_colour: string | null;
  secondary_colour: string | null;
  accent_colour: string | null;
  support_email: string | null;
  default_timezone: string | null;
};

export type WriteFiOrganisationSettingsPayload = {
  organisation_id: string;
  brand_name: string | null;
  logo_url: string | null;
  primary_colour: string | null;
  secondary_colour: string | null;
  accent_colour: string | null;
  website_url: string | null;
  support_email: string | null;
};

export type WriteFiClinicSettingsPayload = {
  clinic_id: string;
  display_name: string | null;
  booking_url: string | null;
  public_intake_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string | null;
};

/**
 * Upsert tenant settings by `tenant_id`. Caller must enforce FI admin gate and tenant existence.
 * Uses service-role client only; does not touch `metadata` (DB default on insert, unchanged on update).
 */
export async function upsertFiTenantSettings(
  tenantId: string,
  payload: WriteFiTenantSettingsPayload,
  client?: FoundationSupabase
): Promise<void> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const now = new Date().toISOString();
  const { error } = await supabase.from("fi_tenant_settings").upsert(
    {
      tenant_id: tid,
      brand_name: payload.brand_name,
      logo_url: payload.logo_url,
      primary_colour: payload.primary_colour,
      secondary_colour: payload.secondary_colour,
      accent_colour: payload.accent_colour,
      support_email: payload.support_email,
      default_timezone: payload.default_timezone,
      updated_at: now,
    },
    { onConflict: "tenant_id" }
  );
  if (error) throw new Error(error.message);
}

export async function upsertFiOrganisationSettings(
  tenantId: string,
  payload: WriteFiOrganisationSettingsPayload,
  client?: FoundationSupabase
): Promise<void> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const oid = payload.organisation_id.trim();
  const now = new Date().toISOString();
  const { error } = await supabase.from("fi_organisation_settings").upsert(
    {
      tenant_id: tid,
      organisation_id: oid,
      brand_name: payload.brand_name,
      logo_url: payload.logo_url,
      primary_colour: payload.primary_colour,
      secondary_colour: payload.secondary_colour,
      accent_colour: payload.accent_colour,
      website_url: payload.website_url,
      support_email: payload.support_email,
      updated_at: now,
    },
    { onConflict: "tenant_id,organisation_id" }
  );
  if (error) throw new Error(error.message);
}

export async function upsertFiClinicSettings(
  tenantId: string,
  payload: WriteFiClinicSettingsPayload,
  client?: FoundationSupabase
): Promise<void> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const cid = payload.clinic_id.trim();
  const now = new Date().toISOString();
  const { error } = await supabase.from("fi_clinic_settings").upsert(
    {
      tenant_id: tid,
      clinic_id: cid,
      display_name: payload.display_name,
      booking_url: payload.booking_url,
      public_intake_url: payload.public_intake_url,
      phone: payload.phone,
      email: payload.email,
      address: payload.address,
      timezone: payload.timezone,
      updated_at: now,
    },
    { onConflict: "tenant_id,clinic_id" }
  );
  if (error) throw new Error(error.message);
}
