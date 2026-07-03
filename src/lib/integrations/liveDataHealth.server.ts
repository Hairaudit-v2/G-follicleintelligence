import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isPathologyEmailIngestionEnabledFromEnv } from "@/src/lib/pathology/email/pathologyEmailIngestionEnv";

const STALE_SYNC_HOURS = 24;
const RECENT_ACTIVITY_HOURS = 24;

export type LiveDataHealthSummary = {
  tenantId: string;
  generatedAt: string;
  googleCalendarConnected: boolean;
  googleCalendarLastSyncAt: string | null;
  googleCalendarStagedEventCount: number;
  googleCalendarPromotedAppointmentCount: number;
  hubSpotConnected: boolean;
  hubSpotLastSyncAt: string | null;
  hubSpotStagedContactCount: number;
  hubSpotPromotedLeadCount: number;
  hubSpotStagedDealCount: number;
  hubSpotPromotedOpportunityCount: number;
  emailIngestionConfigured: boolean;
  recentActivityEventCount: number;
  warnings: string[];
};

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  now?: Date;
};

function hoursSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso?.trim()) return null;
  const ms = now.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return ms / (60 * 60 * 1000);
}

export function buildLiveDataHealthWarnings(input: {
  googleCalendarConnected: boolean;
  googleCalendarLastSyncAt: string | null;
  googleCalendarStagedEventCount: number;
  googleCalendarPromotedAppointmentCount: number;
  hubSpotConnected: boolean;
  hubSpotLastSyncAt: string | null;
  hubSpotStagedContactCount: number;
  hubSpotStagedDealCount: number;
  hubSpotPromotedLeadCount: number;
  hubSpotPromotedOpportunityCount: number;
  emailIngestionConfigured: boolean;
  now?: Date;
}): string[] {
  const warnings: string[] = [];
  const now = input.now ?? new Date();

  if (input.googleCalendarConnected) {
    const staleHours = hoursSince(input.googleCalendarLastSyncAt, now);
    if (staleHours == null) {
      warnings.push("Google Calendar is connected but has never synced.");
    } else if (staleHours > STALE_SYNC_HOURS) {
      warnings.push(
        `Google Calendar last synced ${Math.round(staleHours)}h ago — calendar UI may be stale.`
      );
    }
    if (input.googleCalendarStagedEventCount > 0 && input.googleCalendarPromotedAppointmentCount === 0) {
      warnings.push(
        `${input.googleCalendarStagedEventCount} OnboardingOS calendar event(s) staged with no promoted fi_calendar_events — use CalendarOS inbound sync or import review.`
      );
    }
  }

  if (input.hubSpotConnected) {
    const staleHours = hoursSince(input.hubSpotLastSyncAt, now);
    if (staleHours == null) {
      warnings.push("HubSpot is connected but has never completed a connector sync.");
    } else if (staleHours > STALE_SYNC_HOURS) {
      warnings.push(`HubSpot last synced ${Math.round(staleHours)}h ago — CRM may be stale.`);
    }
    const stagedTotal = input.hubSpotStagedContactCount + input.hubSpotStagedDealCount;
    if (stagedTotal > 0 && input.hubSpotPromotedLeadCount === 0 && input.hubSpotPromotedOpportunityCount === 0) {
      warnings.push(
        `${stagedTotal} HubSpot record(s) in connector staging — approve and import via OnboardingOS import review.`
      );
    }
  }

  if (!input.emailIngestionConfigured) {
    warnings.push("Pathology email ingestion is not enabled (generic clinic email ingest is not implemented).");
  }

  return warnings;
}

/** Tenant-level health summary for live external data inputs. */
export async function loadLiveDataHealthSummary(
  tenantId: string,
  opts: ServerOpts = {}
): Promise<LiveDataHealthSummary> {
  const tid = tenantId.trim();
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const now = opts.now ?? new Date();
  const sinceIso = new Date(now.getTime() - RECENT_ACTIVITY_HOURS * 60 * 60 * 1000).toISOString();

  const [
    calendarIntegrationRes,
    onboardingCalendarRes,
    hubspotIntegrationRes,
    hubspotSyncRunRes,
    stagedCalendarRes,
    calendarEventsRes,
    timelyMappingsRes,
    stagedContactsRes,
    stagedDealsRes,
    crmLeadsRes,
    leadFlowLeadsRes,
    dealMappingsRes,
    pathologyRoutesRes,
    crmActivityRes,
  ] = await Promise.all([
    supabase
      .from("fi_calendar_integrations")
      .select("last_synced_at, status")
      .eq("tenant_id", tid)
      .neq("status", "disconnected")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("fi_tenant_external_integrations")
      .select("id, status")
      .eq("tenant_id", tid)
      .eq("provider", "google_calendar")
      .neq("status", "disabled")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("fi_tenant_external_integrations")
      .select("id, status")
      .eq("tenant_id", tid)
      .eq("provider", "hubspot")
      .neq("status", "disabled")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("fi_external_hubspot_sync_runs")
      .select("completed_at")
      .eq("tenant_id", tid)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("fi_external_calendar_event_staging")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .in("import_status", ["staged", "approved", "reviewed"]),
    supabase
      .from("fi_calendar_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid),
    supabase
      .from("fi_external_entity_mappings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("source_system", "timely")
      .eq("entity_type", "booking"),
    supabase
      .from("fi_external_hubspot_contact_staging")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .in("import_status", ["staged", "approved", "reviewed"]),
    supabase
      .from("fi_external_hubspot_deal_staging")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .in("import_status", ["staged", "approved", "reviewed"]),
    supabase
      .from("fi_crm_leads")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .not("metadata->hubspot", "is", null),
    supabase
      .from("fi_leads")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .not("hubspot_contact_id", "is", null),
    supabase
      .from("fi_external_record_mappings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("source_entity_type", "deal"),
    supabase
      .from("fi_pathology_email_routes")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("status", "active"),
    supabase
      .from("fi_crm_activity_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .gte("created_at", sinceIso),
  ]);

  const results = [
    calendarIntegrationRes,
    onboardingCalendarRes,
    hubspotIntegrationRes,
    hubspotSyncRunRes,
    stagedCalendarRes,
    calendarEventsRes,
    timelyMappingsRes,
    stagedContactsRes,
    stagedDealsRes,
    crmLeadsRes,
    leadFlowLeadsRes,
    dealMappingsRes,
    pathologyRoutesRes,
    crmActivityRes,
  ];
  for (const res of results) {
    if (res.error) throw new Error(res.error.message);
  }

  const googleCalendarConnected = Boolean(calendarIntegrationRes.data || onboardingCalendarRes.data);
  const googleCalendarLastSyncAt =
    (calendarIntegrationRes.data as { last_synced_at?: string | null } | null)?.last_synced_at?.trim() ??
    null;
  const googleCalendarStagedEventCount = stagedCalendarRes.count ?? 0;
  const googleCalendarPromotedAppointmentCount =
    (calendarEventsRes.count ?? 0) + (timelyMappingsRes.count ?? 0);

  const hubSpotConnected = Boolean(hubspotIntegrationRes.data);
  const hubSpotLastSyncAt =
    (hubspotSyncRunRes.data as { completed_at?: string | null } | null)?.completed_at?.trim() ?? null;
  const hubSpotStagedContactCount = stagedContactsRes.count ?? 0;
  const hubSpotStagedDealCount = stagedDealsRes.count ?? 0;
  const hubSpotPromotedLeadCount = (crmLeadsRes.count ?? 0) + (leadFlowLeadsRes.count ?? 0);
  const hubSpotPromotedOpportunityCount = dealMappingsRes.count ?? 0;

  const emailIngestionConfigured =
    isPathologyEmailIngestionEnabledFromEnv() && (pathologyRoutesRes.count ?? 0) > 0;
  const recentActivityEventCount = crmActivityRes.count ?? 0;

  const warnings = buildLiveDataHealthWarnings({
    googleCalendarConnected,
    googleCalendarLastSyncAt,
    googleCalendarStagedEventCount,
    googleCalendarPromotedAppointmentCount,
    hubSpotConnected,
    hubSpotLastSyncAt,
    hubSpotStagedContactCount,
    hubSpotStagedDealCount,
    hubSpotPromotedLeadCount,
    hubSpotPromotedOpportunityCount,
    emailIngestionConfigured,
    now,
  });

  return {
    tenantId: tid,
    generatedAt: now.toISOString(),
    googleCalendarConnected,
    googleCalendarLastSyncAt,
    googleCalendarStagedEventCount,
    googleCalendarPromotedAppointmentCount,
    hubSpotConnected,
    hubSpotLastSyncAt,
    hubSpotStagedContactCount,
    hubSpotPromotedLeadCount,
    hubSpotStagedDealCount,
    hubSpotPromotedOpportunityCount,
    emailIngestionConfigured,
    recentActivityEventCount,
    warnings,
  };
}
