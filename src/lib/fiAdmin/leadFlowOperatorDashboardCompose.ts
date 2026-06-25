import type { LeadFlowQueueDiagnosticEvent } from "@/src/lib/leadFlow/leadFlowQueueDiagnostics.server";
import type { LeadFlowQueueHealth } from "@/src/lib/leadFlow/leadFlowQueueHealth.server";
import type { FiLeadRow } from "@/src/lib/leadFlow/leadFlowFoundationTypes";
import {
  buildLeadFlowOperatorPipelineColumns,
  buildLeadFlowOperatorPredictedProcedureCounts,
  buildLeadFlowOperatorPriorityCounts,
  buildLeadFlowOperatorSummaryMetrics,
  sanitizeLeadFlowOperatorFailedEvent,
  selectLeadFlowOperatorHighPriorityLeads,
} from "@/src/lib/fiAdmin/leadFlowOperatorDashboardCore";
import type {
  LeadFlowOperatorActivityRow,
  LeadFlowOperatorDashboardPayload,
  LeadFlowOperatorHubSpotStatus,
} from "@/src/lib/fiAdmin/leadFlowOperatorDashboardTypes";

export function composeLeadFlowOperatorDashboardPayload(input: {
  tenantId: string;
  leads: FiLeadRow[];
  queueHealth: LeadFlowQueueHealth;
  failedEvents: LeadFlowQueueDiagnosticEvent[];
  hubspot: LeadFlowOperatorHubSpotStatus;
  recentActivity: LeadFlowOperatorActivityRow[];
}): LeadFlowOperatorDashboardPayload {
  const failedIngestionEvents = input.queueHealth.counts.failed;

  return {
    tenantId: input.tenantId.trim(),
    summary: buildLeadFlowOperatorSummaryMetrics(input.leads, failedIngestionEvents),
    pipeline: buildLeadFlowOperatorPipelineColumns(input.leads),
    priorityCounts: buildLeadFlowOperatorPriorityCounts(input.leads),
    predictedProcedureCounts: buildLeadFlowOperatorPredictedProcedureCounts(input.leads),
    highPriorityLeads: selectLeadFlowOperatorHighPriorityLeads(input.leads),
    recentActivity: input.recentActivity,
    queueHealth: input.queueHealth,
    failedDiagnostics: input.failedEvents.map(sanitizeLeadFlowOperatorFailedEvent),
    hubspot: input.hubspot,
  };
}
