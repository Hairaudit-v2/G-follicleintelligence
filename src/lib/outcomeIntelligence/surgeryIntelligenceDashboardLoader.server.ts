import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  assertAnalyticsEventsTenantScoped,
  getAnalyticsEvents,
  type AnalyticsEventCoreOptions,
} from "@/src/lib/analytics-os/analyticsEventCore";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE } from "./surgeryCaseFactsPublisherCore";
import {
  composeSurgeryIntelligenceDashboardFromEvents,
  dedupeLatestPublishedCaseRows,
  parsePublishedSurgeryCaseIntelligenceEvent,
  parseSurgeryIntelligenceDashboardFilters,
} from "./surgeryIntelligenceDashboardDerive";
import type {
  SurgeryIntelligenceDashboardFilters,
  SurgeryIntelligenceDashboardPayload,
} from "./surgeryIntelligenceDashboardTypes";

async function loadHairAuditLinkContextForCases(
  supabase: SupabaseClient,
  tenantId: string,
  caseIds: readonly string[]
): Promise<{
  caseMetadataByCaseId: Record<string, Record<string, unknown>>;
  fiReportIdByCaseId: Record<string, string>;
  fiReportStatusByCaseId: Record<string, string>;
  globalHairAuditSourceByCaseId: Record<
    string,
    Array<{ source_system: string; source_case_id: string }>
  >;
}> {
  const uniqueCaseIds = [...new Set(caseIds.filter(Boolean))];
  const caseMetadataByCaseId: Record<string, Record<string, unknown>> = {};
  const fiReportIdByCaseId: Record<string, string> = {};
  const fiReportStatusByCaseId: Record<string, string> = {};
  const globalHairAuditSourceByCaseId: Record<
    string,
    Array<{ source_system: string; source_case_id: string }>
  > = {};

  if (!uniqueCaseIds.length) {
    return {
      caseMetadataByCaseId,
      fiReportIdByCaseId,
      fiReportStatusByCaseId,
      globalHairAuditSourceByCaseId,
    };
  }

  const { data: cases, error: casesError } = await supabase
    .from("fi_cases")
    .select("id, metadata")
    .eq("tenant_id", tenantId)
    .in("id", uniqueCaseIds);
  if (casesError) throw new Error(casesError.message);
  for (const row of cases ?? []) {
    const caseId = String((row as { id: string }).id);
    const metadata = (row as { metadata?: unknown }).metadata;
    caseMetadataByCaseId[caseId] =
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {};
  }

  const { data: reports, error: reportsError } = await supabase
    .from("fi_reports")
    .select("id, case_id, created_at, report_status")
    .eq("tenant_id", tenantId)
    .in("case_id", uniqueCaseIds)
    .order("created_at", { ascending: false });
  if (reportsError) throw new Error(reportsError.message);
  for (const row of reports ?? []) {
    const caseId = String((row as { case_id: string }).case_id);
    if (!fiReportIdByCaseId[caseId]) {
      fiReportIdByCaseId[caseId] = String((row as { id: string }).id);
      const status = (row as { report_status?: string | null }).report_status;
      if (status) fiReportStatusByCaseId[caseId] = status;
    }
  }

  const { data: globalCases, error: globalError } = await supabase
    .from("fi_global_cases")
    .select("fi_case_id, source_system, source_case_id")
    .eq("tenant_id", tenantId)
    .in("fi_case_id", uniqueCaseIds);
  if (globalError) throw new Error(globalError.message);
  for (const row of globalCases ?? []) {
    const caseId = String((row as { fi_case_id: string | null }).fi_case_id ?? "");
    if (!caseId) continue;
    const bucket = globalHairAuditSourceByCaseId[caseId] ?? [];
    bucket.push({
      source_system: String((row as { source_system: string }).source_system),
      source_case_id: String((row as { source_case_id: string }).source_case_id),
    });
    globalHairAuditSourceByCaseId[caseId] = bucket;
  }

  return {
    caseMetadataByCaseId,
    fiReportIdByCaseId,
    fiReportStatusByCaseId,
    globalHairAuditSourceByCaseId,
  };
}

/**
 * Read-only loader: queries published surgery_case_intelligence_facts events only.
 * Does not rebuild facts from SurgeryOS state and does not publish.
 */
export async function loadSurgeryIntelligenceDashboard(
  input: {
    tenantId: string;
    filters?: SurgeryIntelligenceDashboardFilters;
    searchParams?: Record<string, string | string[] | undefined>;
  },
  options?: AnalyticsEventCoreOptions
): Promise<SurgeryIntelligenceDashboardPayload> {
  const tid = assertNonEmptyUuid(input.tenantId.trim(), "tenantId");
  const filters =
    input.filters ?? parseSurgeryIntelligenceDashboardFilters(input.searchParams ?? {});

  const events = await getAnalyticsEvents(
    {
      tenantId: tid,
      moduleName: "surgery_os",
      eventType: SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE,
      occurredAfter: filters.occurredAfter ?? undefined,
      occurredBefore: filters.occurredBefore ?? undefined,
      clinicId: filters.clinicId ?? undefined,
      limit: 500,
    },
    options
  );

  assertAnalyticsEventsTenantScoped(tid, events);

  const parsed = events
    .map((event) => parsePublishedSurgeryCaseIntelligenceEvent(event, tid))
    .filter((row): row is NonNullable<typeof row> => row != null);
  const deduped = dedupeLatestPublishedCaseRows(parsed);
  const caseIds = deduped.map((row) => row.caseId).filter((id): id is string => Boolean(id));
  const linkContext = await loadHairAuditLinkContextForCases(
    options?.supabaseClientForTests ?? supabaseAdmin(),
    tid,
    caseIds
  );

  const composed = composeSurgeryIntelligenceDashboardFromEvents({
    tenantId: tid,
    events,
    filters,
    caseMetadataByCaseId: linkContext.caseMetadataByCaseId,
    fiReportIdByCaseId: linkContext.fiReportIdByCaseId,
    fiReportStatusByCaseId: linkContext.fiReportStatusByCaseId,
    globalHairAuditSourceByCaseId: linkContext.globalHairAuditSourceByCaseId,
  });

  return {
    tenantId: tid,
    filters,
    filterOptions: composed.filterOptions,
    metrics: composed.metrics,
    tableRows: composed.tableRows,
    eventCountLoaded: composed.eventCountLoaded,
    dedupedCaseCount: composed.dedupedCaseCount,
  };
}
