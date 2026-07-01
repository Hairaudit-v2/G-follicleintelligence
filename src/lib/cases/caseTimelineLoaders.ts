import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type {
  CaseTimelineCrmActivityRow,
  CaseTimelineExtraSources,
  CaseTimelineFoundationEventRow,
  CaseTimelineLinkedLeadRow,
  CaseTimelineLiveTheatreEventRow,
} from "./caseTimelineTypes";
import {
  SURGERY_OS_PROCEDURE_EVENT_LABELS,
  type SurgeryOsProcedureEventKind,
} from "@/src/lib/surgeryOs/surgeryOsBoardModel";
import { isMissingDatabaseRelationError } from "@/src/lib/surgeryOs/surgeryOsLoaderResilience";

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

const TIMELINE_EVENTS_LIMIT = 200;
const CRM_ACTIVITY_LIMIT = 150;
const LIVE_THEATRE_EVENTS_LIMIT = 300;

function liveTheatreEventTitle(eventKind: string, metadata: Record<string, unknown>): string {
  const kind = eventKind as SurgeryOsProcedureEventKind;
  if (kind in SURGERY_OS_PROCEDURE_EVENT_LABELS) {
    return SURGERY_OS_PROCEDURE_EVENT_LABELS[kind];
  }
  const custom = metadata.custom_label;
  if (typeof custom === "string" && custom.trim()) return custom.trim();
  return eventKind.replace(/_/g, " ");
}

function liveTheatreEventDescription(metadata: Record<string, unknown>): string | null {
  const customBody = metadata.custom_body;
  if (typeof customBody === "string" && customBody.trim()) return customBody.trim().slice(0, 280);
  const sourceAction = metadata.source_action;
  if (typeof sourceAction === "string" && sourceAction.trim()) {
    return `Source action: ${sourceAction.replace(/_/g, " ")}`;
  }
  return null;
}

async function loadLiveTheatreEventsForCase(
  tenantId: string,
  caseId: string,
  client: SupabaseClient
): Promise<CaseTimelineLiveTheatreEventRow[]> {
  const { data: surgeries, error: surgeryErr } = await client
    .from("fi_surgeries")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("case_id", caseId);
  if (surgeryErr) {
    if (isMissingDatabaseRelationError(surgeryErr)) return [];
    throw new Error(surgeryErr.message);
  }

  const surgeryIds = (surgeries ?? []).map((r) => String((r as { id: string }).id)).filter(Boolean);
  if (!surgeryIds.length) return [];

  const { data: events, error: eventsErr } = await client
    .from("fi_surgery_procedure_events")
    .select("id, event_kind, occurred_at, metadata")
    .eq("tenant_id", tenantId)
    .in("surgery_id", surgeryIds)
    .order("occurred_at", { ascending: false })
    .limit(LIVE_THEATRE_EVENTS_LIMIT);
  if (eventsErr) {
    if (isMissingDatabaseRelationError(eventsErr)) return [];
    throw new Error(eventsErr.message);
  }

  return (events ?? []).map((r) => {
    const x = r as Record<string, unknown>;
    const metadata = asObj(x.metadata);
    const eventKind = String(x.event_kind ?? "");
    const newStatus = metadata.new_status;
    return {
      id: String(x.id),
      event_kind: eventKind,
      occurred_at: String(x.occurred_at ?? ""),
      title: liveTheatreEventTitle(eventKind, metadata),
      description: liveTheatreEventDescription(metadata),
      status: typeof newStatus === "string" && newStatus.trim() ? newStatus.trim() : eventKind,
    };
  });
}

/**
 * Loads additional tenant-scoped rows for the case clinical timeline (beyond 5A case detail payload).
 * Safe when tables are empty or columns are null.
 */
export async function loadCaseTimelineExtraSources(
  tenantId: string,
  caseId: string,
  client?: SupabaseClient
): Promise<CaseTimelineExtraSources> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const cid = assertNonEmptyUuid(caseId, "caseId");

  const [
    { data: tlRows, error: tle },
    { data: actRows, error: ae },
    { data: leadRows, error: le },
    liveTheatreEvents,
  ] = await Promise.all([
    supabase
      .from("fi_timeline_events")
      .select("id, event_kind, title, occurred_at, detail")
      .eq("tenant_id", tid)
      .eq("case_id", cid)
      .order("occurred_at", { ascending: false })
      .limit(TIMELINE_EVENTS_LIMIT),
    supabase
      .from("fi_crm_activity_events")
      .select("id, lead_id, patient_id, activity_kind, title, occurred_at, detail")
      .eq("tenant_id", tid)
      .eq("case_id", cid)
      .order("occurred_at", { ascending: false })
      .limit(CRM_ACTIVITY_LIMIT),
    supabase
      .from("fi_crm_leads")
      .select(
        "id, summary, status, created_at, updated_at, case_id, converted_case_id, converted_at"
      )
      .eq("tenant_id", tid)
      .or(`case_id.eq.${cid},converted_case_id.eq.${cid}`),
    loadLiveTheatreEventsForCase(tid, cid, supabase),
  ]);

  if (tle) throw new Error(tle.message);
  if (ae) throw new Error(ae.message);
  if (le) throw new Error(le.message);

  const foundationTimelineEvents: CaseTimelineFoundationEventRow[] = (tlRows ?? []).map((r) => {
    const x = r as Record<string, unknown>;
    return {
      id: String(x.id),
      event_kind: String(x.event_kind ?? ""),
      title: x.title != null ? String(x.title) : null,
      occurred_at: String(x.occurred_at ?? ""),
      detail: x.detail,
    };
  });

  const crmActivityEvents: CaseTimelineCrmActivityRow[] = (actRows ?? []).map((r) => {
    const x = r as Record<string, unknown>;
    return {
      id: String(x.id),
      lead_id: x.lead_id != null ? String(x.lead_id) : null,
      patient_id: x.patient_id != null ? String(x.patient_id) : null,
      activity_kind: String(x.activity_kind ?? ""),
      title: x.title != null ? String(x.title) : null,
      occurred_at: String(x.occurred_at ?? ""),
      detail: asObj(x.detail),
    };
  });

  const linkedLeads: CaseTimelineLinkedLeadRow[] = (leadRows ?? []).map((r) => {
    const x = r as Record<string, unknown>;
    return {
      id: String(x.id),
      summary: x.summary != null ? String(x.summary) : null,
      status: String(x.status ?? ""),
      created_at: String(x.created_at ?? ""),
      updated_at: String(x.updated_at ?? ""),
      case_id: x.case_id != null ? String(x.case_id) : null,
      converted_case_id: x.converted_case_id != null ? String(x.converted_case_id) : null,
      converted_at: x.converted_at != null ? String(x.converted_at) : null,
    };
  });

  return { foundationTimelineEvents, crmActivityEvents, linkedLeads, liveTheatreEvents };
}
