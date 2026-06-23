import type { ConsultationConversionKpis } from "@/src/lib/consultations/consultationConversionBoardModel";
import type { CrmKanbanLeadCard, FiCrmPipelineStageRow } from "@/src/lib/crm/types";
import type { FiImportBatchRow } from "@/src/lib/crm/hubspotImport/hubspotImportBatchLoad.server";
import type {
  CrmPipelineLeadVolumePayload,
  StaleLeadItem,
  TaskDueItem,
  TenantActionCentre,
  TenantClinicToday,
  TenantLaunchControl,
  TenantQuickStats,
} from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

export type LeadFlowActivityRow = {
  id: string;
  leadId: string | null;
  activityKind: string;
  title: string | null;
  occurredAt: string;
};

export type LeadFlowHubspotDiagnostics = {
  latestBatch: FiImportBatchRow | null;
  stagingRowCount: number;
  duplicateEmailCount: number;
  duplicatePhoneCount: number;
  duplicateRecordIdCount: number;
};

export type LeadFlowDashboardPayload = {
  staleLeads: StaleLeadItem[];
  tasksDue: TaskDueItem[];
  quickStats: TenantQuickStats;
  actionCentre: TenantActionCentre;
  launchControl: TenantLaunchControl;
  clinicToday: TenantClinicToday;
  crmPipelineLeadVolume: CrmPipelineLeadVolumePayload;
  crmPipelineStages: FiCrmPipelineStageRow[];
  conversionKpis: ConsultationConversionKpis;
  conversionLostCount: number;
  enrichedLeads: CrmKanbanLeadCard[];
  recentActivity: LeadFlowActivityRow[];
  hubspotImport: LeadFlowHubspotDiagnostics;
  staleLeadThresholdDays: number;
};
