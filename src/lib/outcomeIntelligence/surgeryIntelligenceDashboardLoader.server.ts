import "server-only";

import {
  assertAnalyticsEventsTenantScoped,
  getAnalyticsEvents,
  type AnalyticsEventCoreOptions,
} from "@/src/lib/analytics-os/analyticsEventCore";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE } from "./surgeryCaseFactsPublisherCore";
import {
  composeSurgeryIntelligenceDashboardFromEvents,
  parseSurgeryIntelligenceDashboardFilters,
} from "./surgeryIntelligenceDashboardDerive";
import type {
  SurgeryIntelligenceDashboardFilters,
  SurgeryIntelligenceDashboardPayload,
} from "./surgeryIntelligenceDashboardTypes";

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

  const composed = composeSurgeryIntelligenceDashboardFromEvents({
    tenantId: tid,
    events,
    filters,
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