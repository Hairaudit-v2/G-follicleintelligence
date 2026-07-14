import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  buildPublicClinicDiscoveryPreview,
  buildPublicClinicProfileFromFiOsClinic,
  defaultPublicClinicDiscoveryAdminSettings,
} from "./publicClinicProfileCore";
import type {
  PublicClinicDiscoveryAdminSettings,
  PublicClinicProfile,
} from "./publicClinicProfileTypes";

function mapProfileRow(row: Record<string, unknown>): PublicClinicProfile {
  const services = row.services_offered;
  return {
    public_clinic_profile_id: String(row.id),
    tenant_id: (row.tenant_id as string | null) ?? null,
    fi_clinic_id: (row.fi_clinic_id as string | null) ?? null,
    hairaudit_clinic_id: (row.hairaudit_clinic_id as string | null) ?? null,
    clinic_name: String(row.clinic_name),
    public_slug: String(row.public_slug),
    audit_source: row.audit_source as PublicClinicProfile["audit_source"],
    audit_participation_status:
      row.audit_participation_status as PublicClinicProfile["audit_participation_status"],
    audit_verified: Boolean(row.audit_verified),
    public_profile_enabled: Boolean(row.public_profile_enabled),
    search_visible: Boolean(row.search_visible),
    accepts_independent_hairaudit_enquiries: Boolean(row.accepts_independent_hairaudit_enquiries),
    city_suburb: (row.city_suburb as string | null) ?? null,
    state_region: (row.state_region as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    public_phone: (row.public_phone as string | null) ?? null,
    public_email: (row.public_email as string | null) ?? null,
    public_website_url: (row.public_website_url as string | null) ?? null,
    public_booking_url: (row.public_booking_url as string | null) ?? null,
    logo_brand_image_url: (row.logo_brand_image_url as string | null) ?? null,
    services_offered: Array.isArray(services)
      ? services.filter((entry): entry is string => typeof entry === "string")
      : [],
    profile_summary: (row.profile_summary as string | null) ?? null,
    profile_bio: (row.profile_bio as string | null) ?? null,
    last_audit_activity_at: (row.last_audit_activity_at as string | null) ?? null,
    link_origin: row.link_origin as PublicClinicProfile["link_origin"],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function toRowPayload(profile: PublicClinicProfile): Record<string, unknown> {
  return {
    tenant_id: profile.tenant_id,
    fi_clinic_id: profile.fi_clinic_id,
    hairaudit_clinic_id: profile.hairaudit_clinic_id,
    clinic_name: profile.clinic_name,
    public_slug: profile.public_slug,
    audit_source: profile.audit_source,
    audit_participation_status: profile.audit_participation_status,
    audit_verified: profile.audit_verified,
    public_profile_enabled: profile.public_profile_enabled,
    search_visible: profile.search_visible,
    accepts_independent_hairaudit_enquiries: profile.accepts_independent_hairaudit_enquiries,
    city_suburb: profile.city_suburb,
    state_region: profile.state_region,
    country: profile.country,
    public_phone: profile.public_phone,
    public_email: profile.public_email,
    public_website_url: profile.public_website_url,
    public_booking_url: profile.public_booking_url,
    logo_brand_image_url: profile.logo_brand_image_url,
    services_offered: profile.services_offered,
    profile_summary: profile.profile_summary,
    profile_bio: profile.profile_bio,
    last_audit_activity_at: profile.last_audit_activity_at,
    link_origin: profile.link_origin,
    updated_at: profile.updated_at,
  };
}

async function recordDiscoveryAuditEvent(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    profileId: string | null;
    eventKind:
      | "discovery.profile.created"
      | "discovery.profile.updated"
      | "discovery.profile.published"
      | "discovery.profile.unpublished"
      | "discovery.profile.synced"
      | "discovery.profile.sync_dry_run";
    detail?: Record<string, unknown>;
    actorFiUserId?: string | null;
  }
) {
  await supabase.from("fi_public_clinic_discovery_audit_events").insert({
    tenant_id: input.tenantId,
    public_clinic_profile_id: input.profileId,
    event_kind: input.eventKind,
    actor_fi_user_id: input.actorFiUserId ?? null,
    detail: input.detail ?? {},
  });
}

export async function loadPublicClinicProfileForFiClinic(
  tenantId: string,
  fiClinicId: string,
  deps?: { supabase?: SupabaseClient }
): Promise<PublicClinicProfile | null> {
  const supabase = deps?.supabase ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_public_clinic_profiles")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("fi_clinic_id", fiClinicId.trim())
    .maybeSingle();
  if (error || !data) return null;
  return mapProfileRow(data as Record<string, unknown>);
}

export async function loadClinicDiscoveryAdminContext(
  tenantId: string,
  fiClinicId: string,
  deps?: { supabase?: SupabaseClient }
): Promise<{
  clinic: { id: string; display_name: string };
  settings: PublicClinicDiscoveryAdminSettings;
  profile: PublicClinicProfile | null;
  preview: ReturnType<typeof buildPublicClinicDiscoveryPreview>;
  hairauditClinicId: string | null;
}> {
  const supabase = deps?.supabase ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId.trim(), "tenantId");
  const cid = assertNonEmptyUuid(fiClinicId.trim(), "fiClinicId");

  const { data: clinic, error: clinicError } = await supabase
    .from("fi_clinics")
    .select("id, display_name")
    .eq("tenant_id", tid)
    .eq("id", cid)
    .maybeSingle();
  if (clinicError || !clinic) throw new Error("Clinic not found.");

  const { data: clinicSettings } = await supabase
    .from("fi_clinic_settings")
    .select("*")
    .eq("tenant_id", tid)
    .eq("clinic_id", cid)
    .maybeSingle();

  const { data: sourceRows } = await supabase
    .from("fi_clinic_source_ids")
    .select("source_clinic_id")
    .eq("tenant_id", tid)
    .eq("clinic_id", cid)
    .eq("source_system", "hairaudit")
    .limit(1);

  const hairauditClinicId =
    sourceRows?.[0] &&
    typeof (sourceRows[0] as { source_clinic_id: string }).source_clinic_id === "string"
      ? (sourceRows[0] as { source_clinic_id: string }).source_clinic_id
      : null;

  const existing = await loadPublicClinicProfileForFiClinic(tid, cid, { supabase });
  const draft = buildPublicClinicProfileFromFiOsClinic({
    tenantId: tid,
    fiClinicId: cid,
    clinicDisplayName: String((clinic as { display_name: string }).display_name),
    hairauditClinicId,
    settings: clinicSettings
      ? {
          displayName: (clinicSettings as { display_name?: string | null }).display_name ?? null,
          phone: (clinicSettings as { phone?: string | null }).phone ?? null,
          email: (clinicSettings as { email?: string | null }).email ?? null,
          bookingUrl: (clinicSettings as { booking_url?: string | null }).booking_url ?? null,
          publicIntakeUrl:
            (clinicSettings as { public_intake_url?: string | null }).public_intake_url ?? null,
          address: (clinicSettings as { address?: string | null }).address ?? null,
        }
      : null,
    discoverySettings: existing
      ? {
          public_profile_enabled: existing.public_profile_enabled,
          search_visible: existing.search_visible,
          accepts_independent_hairaudit_enquiries: existing.accepts_independent_hairaudit_enquiries,
          clinic_name: existing.clinic_name,
          city_suburb: existing.city_suburb,
          state_region: existing.state_region,
          country: existing.country,
          public_phone: existing.public_phone,
          public_email: existing.public_email,
          public_website_url: existing.public_website_url,
          public_booking_url: existing.public_booking_url,
          logo_brand_image_url: existing.logo_brand_image_url,
          services_offered: existing.services_offered,
          profile_summary: existing.profile_summary,
          profile_bio: existing.profile_bio,
        }
      : defaultPublicClinicDiscoveryAdminSettings(
          String((clinic as { display_name: string }).display_name)
        ),
  });

  const profile = existing ?? draft;
  const preview = buildPublicClinicDiscoveryPreview(profile);

  return {
    clinic: {
      id: String((clinic as { id: string }).id),
      display_name: String((clinic as { display_name: string }).display_name),
    },
    settings: {
      public_profile_enabled: profile.public_profile_enabled,
      search_visible: profile.search_visible,
      accepts_independent_hairaudit_enquiries: profile.accepts_independent_hairaudit_enquiries,
      clinic_name: profile.clinic_name,
      city_suburb: profile.city_suburb,
      state_region: profile.state_region,
      country: profile.country,
      public_phone: profile.public_phone,
      public_email: profile.public_email,
      public_website_url: profile.public_website_url,
      public_booking_url: profile.public_booking_url,
      logo_brand_image_url: profile.logo_brand_image_url,
      services_offered: profile.services_offered,
      profile_summary: profile.profile_summary,
      profile_bio: profile.profile_bio,
    },
    profile: existing,
    preview,
    hairauditClinicId,
  };
}

export async function savePublicClinicDiscoverySettings(
  input: {
    tenantId: string;
    fiClinicId: string;
    settings: PublicClinicDiscoveryAdminSettings;
    actorFiUserId?: string | null;
  },
  deps?: { supabase?: SupabaseClient }
): Promise<PublicClinicProfile> {
  const supabase = deps?.supabase ?? supabaseAdmin();
  const context = await loadClinicDiscoveryAdminContext(input.tenantId, input.fiClinicId, {
    supabase,
  });

  const next = buildPublicClinicProfileFromFiOsClinic({
    tenantId: input.tenantId,
    fiClinicId: input.fiClinicId,
    clinicDisplayName: context.clinic.display_name,
    hairauditClinicId: context.hairauditClinicId,
    discoverySettings: input.settings,
  });

  const payload = toRowPayload({
    ...next,
    public_clinic_profile_id:
      context.profile?.public_clinic_profile_id ?? next.public_clinic_profile_id,
    created_at: context.profile?.created_at ?? next.created_at,
  });

  if (context.profile) {
    const { data, error } = await supabase
      .from("fi_public_clinic_profiles")
      .update(payload)
      .eq("id", context.profile.public_clinic_profile_id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const mapped = mapProfileRow(data as Record<string, unknown>);
    const eventKind = mapped.search_visible
      ? "discovery.profile.published"
      : mapped.public_profile_enabled
        ? "discovery.profile.updated"
        : "discovery.profile.unpublished";
    await recordDiscoveryAuditEvent(supabase, {
      tenantId: input.tenantId,
      profileId: mapped.public_clinic_profile_id,
      eventKind,
      actorFiUserId: input.actorFiUserId,
      detail: {
        search_visible: mapped.search_visible,
        public_profile_enabled: mapped.public_profile_enabled,
      },
    });
    return mapped;
  }

  const { data, error } = await supabase
    .from("fi_public_clinic_profiles")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const mapped = mapProfileRow(data as Record<string, unknown>);
  await recordDiscoveryAuditEvent(supabase, {
    tenantId: input.tenantId,
    profileId: mapped.public_clinic_profile_id,
    eventKind: "discovery.profile.created",
    actorFiUserId: input.actorFiUserId,
    detail: { public_profile_enabled: mapped.public_profile_enabled },
  });
  return mapped;
}
