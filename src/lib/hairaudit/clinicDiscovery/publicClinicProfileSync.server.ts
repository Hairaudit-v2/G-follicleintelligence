import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  loadClinicDiscoveryAdminContext,
  loadPublicClinicProfileForFiClinic,
  savePublicClinicDiscoverySettings,
} from "./publicClinicProfileSettings.server";
import {
  aggregatePublicClinicProfileSyncSummary,
  planPublicClinicProfileSyncItem,
  type PublicClinicProfileSyncSummary,
} from "./publicClinicProfileSyncCore";

export type RunPublicClinicProfileSyncInput = {
  tenantId: string;
  fiClinicId?: string | null;
  dryRun?: boolean;
  actorFiUserId?: string | null;
};

export type RunPublicClinicProfileSyncResult = {
  summary: PublicClinicProfileSyncSummary;
};

export async function runPublicClinicProfileSync(
  input: RunPublicClinicProfileSyncInput,
  deps?: { supabase?: SupabaseClient }
): Promise<RunPublicClinicProfileSyncResult> {
  const supabase = deps?.supabase ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(input.tenantId.trim(), "tenantId");
  const dryRun = input.dryRun ?? true;

  let clinicIds: string[] = [];
  if (input.fiClinicId?.trim()) {
    clinicIds = [input.fiClinicId.trim()];
  } else {
    const { data, error } = await supabase
      .from("fi_clinics")
      .select("id")
      .eq("tenant_id", tid);
    if (error) throw new Error(error.message);
    clinicIds = (data ?? []).map((row) => String((row as { id: string }).id));
  }

  const outcomes = [];
  for (const fiClinicId of clinicIds) {
    const context = await loadClinicDiscoveryAdminContext(tid, fiClinicId, { supabase });
    const planned = planPublicClinicProfileSyncItem({
      tenantId: tid,
      fiClinicId,
      clinicDisplayName: context.clinic.display_name,
      hairauditClinicId: context.hairauditClinicId,
      existingProfile: context.profile,
      dryRun,
      discoveryInput: {
        tenantId: tid,
        fiClinicId,
        clinicDisplayName: context.clinic.display_name,
        hairauditClinicId: context.hairauditClinicId,
        discoverySettings: context.settings,
      },
    });

    outcomes.push(planned.outcome);

    if (!dryRun && planned.nextProfile && planned.outcome.kind !== "skipped_opt_out") {
      await savePublicClinicDiscoverySettings(
        {
          tenantId: tid,
          fiClinicId,
          settings: {
            public_profile_enabled: planned.nextProfile.public_profile_enabled,
            search_visible: planned.nextProfile.search_visible,
            accepts_independent_hairaudit_enquiries:
              planned.nextProfile.accepts_independent_hairaudit_enquiries,
            clinic_name: planned.nextProfile.clinic_name,
            city_suburb: planned.nextProfile.city_suburb,
            state_region: planned.nextProfile.state_region,
            country: planned.nextProfile.country,
            public_phone: planned.nextProfile.public_phone,
            public_email: planned.nextProfile.public_email,
            public_website_url: planned.nextProfile.public_website_url,
            public_booking_url: planned.nextProfile.public_booking_url,
            logo_brand_image_url: planned.nextProfile.logo_brand_image_url,
            services_offered: planned.nextProfile.services_offered,
            profile_summary: planned.nextProfile.profile_summary,
            profile_bio: planned.nextProfile.profile_bio,
          },
          actorFiUserId: input.actorFiUserId,
        },
        { supabase }
      );
    }

    if (dryRun) {
      await supabase.from("fi_public_clinic_discovery_audit_events").insert({
        tenant_id: tid,
        public_clinic_profile_id: context.profile?.public_clinic_profile_id ?? null,
        event_kind: "discovery.profile.sync_dry_run",
        actor_fi_user_id: input.actorFiUserId ?? null,
        detail: { fi_clinic_id: fiClinicId, outcome: planned.outcome.kind },
      });
    } else if (planned.outcome.kind === "created" || planned.outcome.kind === "updated") {
      const profile = await loadPublicClinicProfileForFiClinic(tid, fiClinicId, { supabase });
      await supabase.from("fi_public_clinic_discovery_audit_events").insert({
        tenant_id: tid,
        public_clinic_profile_id: profile?.public_clinic_profile_id ?? null,
        event_kind: "discovery.profile.synced",
        actor_fi_user_id: input.actorFiUserId ?? null,
        detail: { fi_clinic_id: fiClinicId, outcome: planned.outcome.kind },
      });
    }
  }

  return { summary: aggregatePublicClinicProfileSyncSummary(outcomes, dryRun) };
}