import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type {
  CaseTimelineCrmActivityRow,
  CaseTimelineExtraSources,
  CaseTimelineFoundationEventRow,
  CaseTimelineLinkedLeadRow,
} from "./caseTimelineTypes";

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

const TIMELINE_EVENTS_LIMIT = 200;
const CRM_ACTIVITY_LIMIT = 150;

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

  const [{ data: tlRows, error: tle }, { data: actRows, error: ae }, { data: leadRows, error: le }] = await Promise.all([
    supabase
      .from("fi_timeline_events")
      .select("id, event_kind, title, occurred_at, detail")
      .eq("tenant_id", tid)
      .eq("case_id", cid)
      .order("occurred_at", { ascending: false })
      .limit(TIMELINE_EVENTS_LIMIT),
    supabase
      .from("fi_crm_activity_events")
      .select("id, lead_id, activity_kind, title, occurred_at, detail")
      .eq("tenant_id", tid)
      .eq("case_id", cid)
      .order("occurred_at", { ascending: false })
      .limit(CRM_ACTIVITY_LIMIT),
    supabase
      .from("fi_crm_leads")
      .select("id, summary, status, created_at, updated_at, case_id, converted_case_id, converted_at")
      .eq("tenant_id", tid)
      .or(`case_id.eq.${cid},converted_case_id.eq.${cid}`),
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
      lead_id: String(x.lead_id ?? ""),
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

  return { foundationTimelineEvents, crmActivityEvents, linkedLeads };
}
