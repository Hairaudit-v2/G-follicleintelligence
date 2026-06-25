import type { LeadPriorityBand, PredictedProcedure } from "@/src/lib/leadFlow/leadScoringEngine";
import type { LeadFlowQueueHealth } from "@/src/lib/leadFlow/leadFlowQueueHealth.server";

export type LeadFlowOperatorSummaryMetrics = {
  totalLeads: number;
  newLeads: number;
  highUrgentPriorityLeads: number;
  consultationBooked: number;
  quoteSent: number;
  procedureBooked: number;
  failedIngestionEvents: number;
};

export type LeadFlowOperatorPipelineLeadPreview = {
  id: string;
  name: string;
  procedureInterest: string | null;
  priorityBand: string | null;
  leadScore: number;
};

export type LeadFlowOperatorPipelineColumn = {
  id: string;
  label: string;
  stage: string;
  count: number;
  topLeads: LeadFlowOperatorPipelineLeadPreview[];
};

export type LeadFlowOperatorHighPriorityLead = {
  id: string;
  name: string;
  contact: string | null;
  procedureInterest: string | null;
  source: string | null;
  stage: string;
  stageLabel: string;
  score: number;
  priority: string | null;
  priorityLabel: string;
  predictedProcedure: string | null;
  predictedProcedureLabel: string;
  updatedAt: string;
};

export type LeadFlowOperatorActivityRow = {
  id: string;
  activityType: string;
  activityLabel: string;
  leadName: string | null;
  metadataSummary: string;
  createdAt: string;
};

export type LeadFlowOperatorSanitizedFailedEvent = {
  id: string;
  provider: string;
  eventType: string;
  externalId: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
};

export type LeadFlowOperatorHubSpotStatus = {
  connected: boolean;
  label: string | null;
};

export type LeadFlowOperatorDashboardPayload = {
  tenantId: string;
  summary: LeadFlowOperatorSummaryMetrics;
  pipeline: LeadFlowOperatorPipelineColumn[];
  priorityCounts: Record<LeadPriorityBand, number>;
  predictedProcedureCounts: Record<PredictedProcedure, number>;
  highPriorityLeads: LeadFlowOperatorHighPriorityLead[];
  recentActivity: LeadFlowOperatorActivityRow[];
  queueHealth: LeadFlowQueueHealth;
  failedDiagnostics: LeadFlowOperatorSanitizedFailedEvent[];
  hubspot: LeadFlowOperatorHubSpotStatus;
};

export type { LeadFlowQueueHealth };
