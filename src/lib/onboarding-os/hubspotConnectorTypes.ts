/**
 * OnboardingOS Phase F4 — HubSpot read-only lead connector types (safe for core unit tests; no server-only).
 */

export const HUBSPOT_LEAD_TYPES = [
  "hair_transplant",
  "trichology",
  "prp",
  "exosomes",
  "follow_up",
  "review",
  "unknown",
] as const;
export type HubspotLeadType = (typeof HUBSPOT_LEAD_TYPES)[number];

export const HUBSPOT_IMPORT_STATUSES = [
  "staged",
  "reviewed",
  "approved",
  "rejected",
  "imported",
] as const;
export type HubspotImportStatus = (typeof HUBSPOT_IMPORT_STATUSES)[number];

export const HUBSPOT_SYNC_RUN_STATUSES = ["started", "completed", "partial", "failed"] as const;
export type HubspotSyncRunStatus = (typeof HUBSPOT_SYNC_RUN_STATUSES)[number];

export const HUBSPOT_PIPELINE_MAPPING_STATUSES = ["pending", "approved", "rejected", "linked"] as const;
export type HubspotPipelineMappingStatus = (typeof HUBSPOT_PIPELINE_MAPPING_STATUSES)[number];

export const HUBSPOT_IMPORT_AUDIT_ACTIONS = [
  "sync_started",
  "sync_completed",
  "sync_failed",
  "contact_staged",
  "deal_staged",
  "contact_duplicate",
  "deal_duplicate",
  "contact_approved",
  "contact_rejected",
  "deal_approved",
  "deal_rejected",
  "pipeline_mapped",
] as const;
export type HubspotImportAuditAction = (typeof HUBSPOT_IMPORT_AUDIT_ACTIONS)[number];

export const HUBSPOT_SYNC_HEALTH_BANDS = ["healthy", "degraded", "unhealthy", "unknown"] as const;
export type HubspotSyncHealthBand = (typeof HUBSPOT_SYNC_HEALTH_BANDS)[number];

/** Raw HubSpot CRM contact shape (subset used for normalization). */
export type HubspotApiContact = {
  id?: string;
  properties?: Record<string, string | null | undefined>;
  createdAt?: string;
  updatedAt?: string;
};

/** Raw HubSpot CRM deal shape (subset used for normalization). */
export type HubspotApiDeal = {
  id?: string;
  properties?: Record<string, string | null | undefined>;
  createdAt?: string;
  updatedAt?: string;
};

/** HubSpot pipeline metadata from read-only API. */
export type HubspotApiPipeline = {
  id?: string;
  label?: string;
  stages?: readonly { id?: string; label?: string }[];
};

export type NormalizedHubspotContact = {
  hubspotContactId: string;
  email: string | null;
  phone: string | null;
  leadSource: string | null;
  normalizedLeadType: HubspotLeadType;
  duplicateRisk: boolean;
  rawPayload: Record<string, unknown>;
};

export type NormalizedHubspotDeal = {
  hubspotDealId: string;
  hubspotContactId: string | null;
  email: string | null;
  phone: string | null;
  leadSource: string | null;
  pipelineName: string | null;
  dealStage: string | null;
  normalizedLeadType: HubspotLeadType;
  duplicateRisk: boolean;
  rawPayload: Record<string, unknown>;
};

export type HubspotStagingContact = {
  id: string;
  integrationId: string;
  tenantId: string;
  syncRunId: string | null;
  hubspotContactId: string;
  email: string | null;
  phone: string | null;
  leadSource: string | null;
  duplicateRisk: boolean;
  normalizedLeadType: HubspotLeadType;
  rawPayload: Record<string, unknown>;
  importStatus: HubspotImportStatus;
  importedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HubspotStagingDeal = {
  id: string;
  integrationId: string;
  tenantId: string;
  syncRunId: string | null;
  hubspotDealId: string;
  hubspotContactId: string | null;
  email: string | null;
  phone: string | null;
  leadSource: string | null;
  pipelineName: string | null;
  dealStage: string | null;
  duplicateRisk: boolean;
  normalizedLeadType: HubspotLeadType;
  rawPayload: Record<string, unknown>;
  importStatus: HubspotImportStatus;
  importedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HubspotSyncRun = {
  id: string;
  integrationId: string;
  tenantId: string;
  status: HubspotSyncRunStatus;
  contactsDiscovered: number;
  contactsStaged: number;
  contactsSkipped: number;
  dealsDiscovered: number;
  dealsStaged: number;
  dealsSkipped: number;
  duplicateRisksDetected: number;
  healthScore: number;
  detail: Record<string, unknown>;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
};

export type HubspotPipelineMapping = {
  id: string;
  integrationId: string;
  tenantId: string;
  hubspotPipelineId: string;
  pipelineName: string;
  fiPipelineId: string | null;
  mappingStatus: HubspotPipelineMappingStatus;
  detail: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type HubspotImportAuditEntry = {
  id: string;
  integrationId: string;
  tenantId: string;
  stagingContactId: string | null;
  stagingDealId: string | null;
  syncRunId: string | null;
  action: HubspotImportAuditAction;
  actorLabel: string | null;
  detail: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
};

export type HubspotSyncPreview = {
  integrationId: string;
  contactsDiscovered: number;
  contactsToStage: number;
  contactDuplicateCount: number;
  dealsDiscovered: number;
  dealsToStage: number;
  dealDuplicateCount: number;
  duplicateRiskCount: number;
  sampleContacts: readonly NormalizedHubspotContact[];
  sampleDeals: readonly NormalizedHubspotDeal[];
  warnings: readonly string[];
};

export type HubspotSyncHealth = {
  healthScore: number;
  healthBand: HubspotSyncHealthBand;
  lastSyncAt: string | null;
  lastSyncStatus: HubspotSyncRunStatus | null;
  contactsPendingReview: number;
  dealsPendingReview: number;
  duplicateRiskCount: number;
  approvedCount: number;
  rejectedCount: number;
  summary: string;
  blockers: readonly string[];
  warnings: readonly string[];
};

export type HubspotConnectorSnapshot = {
  tenantId: string;
  integrationId: string;
  syncHealth: HubspotSyncHealth;
  latestSyncRun: HubspotSyncRun | null;
  recentSyncRuns: readonly HubspotSyncRun[];
  contactQueue: readonly HubspotStagingContact[];
  dealQueue: readonly HubspotStagingDeal[];
  calculatedAt: string;
};

export const HUBSPOT_IMPORT_STATUS_BADGES: Record<
  HubspotImportStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  staged: { label: "Pending review", tone: "info" },
  reviewed: { label: "Reviewed", tone: "neutral" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  imported: { label: "Imported", tone: "success" },
};

export const HUBSPOT_LEAD_TYPE_LABELS: Record<HubspotLeadType, string> = {
  hair_transplant: "Hair transplant",
  trichology: "Trichology",
  prp: "PRP",
  exosomes: "Exosomes",
  follow_up: "Follow-up",
  review: "Review",
  unknown: "Unknown",
};

export function isHubspotLeadType(value: string): value is HubspotLeadType {
  return (HUBSPOT_LEAD_TYPES as readonly string[]).includes(value);
}

export function isHubspotImportStatus(value: string): value is HubspotImportStatus {
  return (HUBSPOT_IMPORT_STATUSES as readonly string[]).includes(value);
}

export function isHubspotSyncRunStatus(value: string): value is HubspotSyncRunStatus {
  return (HUBSPOT_SYNC_RUN_STATUSES as readonly string[]).includes(value);
}
