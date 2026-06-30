/**
 * OnboardingOS Phase F1 — External connector layer types (safe for core unit tests; no server-only).
 */

export const EXTERNAL_CONNECTOR_CATEGORIES = ["crm", "calendar", "finance", "marketing"] as const;
export type ExternalConnectorCategory = (typeof EXTERNAL_CONNECTOR_CATEGORIES)[number];

export const EXTERNAL_CONNECTOR_PROVIDERS = [
  "pabau",
  "cliniko",
  "hubspot",
  "google_calendar",
  "microsoft_outlook",
  "stripe",
  "xero",
  "meta_ads",
  "google_ads",
] as const;
export type ExternalConnectorProvider = (typeof EXTERNAL_CONNECTOR_PROVIDERS)[number];

export const EXTERNAL_CONNECTOR_STATUSES = [
  "draft",
  "configured",
  "active",
  "paused",
  "error",
  "disconnected",
] as const;
export type ExternalConnectorStatus = (typeof EXTERNAL_CONNECTOR_STATUSES)[number];

export const EXTERNAL_CONNECTOR_SYNC_MODES = [
  "manual",
  "scheduled",
  "webhook",
  "disabled",
] as const;
export type ExternalConnectorSyncMode = (typeof EXTERNAL_CONNECTOR_SYNC_MODES)[number];

export const EXTERNAL_SYNC_STATUSES = [
  "idle",
  "pending",
  "syncing",
  "success",
  "partial",
  "failed",
] as const;
export type ExternalSyncStatus = (typeof EXTERNAL_SYNC_STATUSES)[number];

export const EXTERNAL_SYNC_EVENT_KINDS = [
  "connector_created",
  "connector_updated",
  "credential_stored",
  "sync_started",
  "sync_completed",
  "sync_failed",
  "mapping_updated",
  "health_check",
  "connector_paused",
  "connector_resumed",
] as const;
export type ExternalSyncEventKind = (typeof EXTERNAL_SYNC_EVENT_KINDS)[number];

export const EXTERNAL_SYNC_EVENT_STATUSES = ["info", "success", "warning", "error"] as const;
export type ExternalSyncEventStatus = (typeof EXTERNAL_SYNC_EVENT_STATUSES)[number];

export const EXTERNAL_CONNECTOR_CREDENTIAL_KINDS = [
  "api_key",
  "oauth_tokens",
  "webhook_secret",
  "account_id",
] as const;
export type ExternalConnectorCredentialKind = (typeof EXTERNAL_CONNECTOR_CREDENTIAL_KINDS)[number];

export const EXTERNAL_DATA_MAPPING_STATUSES = ["draft", "active", "paused", "deprecated"] as const;
export type ExternalDataMappingStatus = (typeof EXTERNAL_DATA_MAPPING_STATUSES)[number];

export type ExternalConnectorConfigField = {
  key: string;
  label: string;
  required: boolean;
  sensitive?: boolean;
  description?: string;
};

export type ExternalConnectorCatalogEntry = {
  provider: ExternalConnectorProvider;
  category: ExternalConnectorCategory;
  label: string;
  description: string;
  supportedSyncModes: readonly ExternalConnectorSyncMode[];
  configFields: readonly ExternalConnectorConfigField[];
  /** Architecture flag — live API not wired yet. */
  liveSyncAvailable: boolean;
};

export type ExternalConnectorConfigurationInput = {
  provider: ExternalConnectorProvider;
  displayName?: string | null;
  syncMode?: ExternalConnectorSyncMode | null;
  config?: Record<string, unknown> | null;
  credentialPlaintext?: string | null;
  credentialKind?: ExternalConnectorCredentialKind | null;
};

export type ExternalConnectorValidationResult =
  | { ok: true; provider: ExternalConnectorProvider; category: ExternalConnectorCategory }
  | { ok: false; errors: string[] };

export type ExternalConnectorHealthBand = "healthy" | "degraded" | "unhealthy" | "unknown";

export type ExternalConnectorHealthStatus = {
  integrationId: string;
  provider: ExternalConnectorProvider;
  status: ExternalConnectorStatus;
  syncStatus: ExternalSyncStatus | null;
  healthBand: ExternalConnectorHealthBand;
  healthScore: number;
  summary: string;
  blockers: readonly string[];
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
};

export type ExternalConnectorMappingPlanEntry = {
  sourceEntity: string;
  targetEntity: string;
  label: string;
  fields: readonly { sourceField: string; targetField: string; required: boolean }[];
};

export type ExternalConnectorMappingPlan = {
  provider: ExternalConnectorProvider;
  category: ExternalConnectorCategory;
  entries: readonly ExternalConnectorMappingPlanEntry[];
};

export type ExternalConnectorSyncHealthInput = {
  integrationStatus: ExternalConnectorStatus;
  syncStatus: ExternalSyncStatus | null;
  healthScore: number;
  lastSuccessAt: string | null;
  lastError: string | null;
  recentFailureCount: number;
  credentialConfigured: boolean;
};

export type ExternalConnectorSyncHealth = {
  score: number;
  band: ExternalConnectorHealthBand;
  summary: string;
  recommendations: readonly string[];
};

export type ExternalConnectorIntegrationRow = {
  id: string;
  tenantId: string;
  provider: ExternalConnectorProvider;
  category: ExternalConnectorCategory;
  displayName: string;
  status: ExternalConnectorStatus;
  syncMode: ExternalConnectorSyncMode;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  credentialConfigured: boolean;
  syncStatus: ExternalSyncStatus | null;
  healthScore: number;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
};

export type ExternalConnectorSyncEventRow = {
  id: string;
  integrationId: string;
  tenantId: string;
  eventKind: ExternalSyncEventKind;
  status: ExternalSyncEventStatus;
  actorLabel: string | null;
  detail: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
};

export type TenantExternalConnectorsSnapshot = {
  tenantId: string;
  catalog: readonly ExternalConnectorCatalogEntry[];
  integrations: readonly ExternalConnectorIntegrationRow[];
  healthStatuses: readonly ExternalConnectorHealthStatus[];
  calculatedAt: string;
};

export const EXTERNAL_CONNECTOR_CATEGORY_LABELS: Record<ExternalConnectorCategory, string> = {
  crm: "CRM",
  calendar: "Calendar",
  finance: "Finance",
  marketing: "Marketing",
};

export const EXTERNAL_CONNECTOR_PROVIDER_LABELS: Record<ExternalConnectorProvider, string> = {
  pabau: "Pabau",
  cliniko: "Cliniko",
  hubspot: "HubSpot",
  google_calendar: "Google Calendar",
  microsoft_outlook: "Microsoft Outlook",
  stripe: "Stripe",
  xero: "Xero",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
};

export const EXTERNAL_CONNECTOR_STATUS_BADGES: Record<
  ExternalConnectorStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  draft: { label: "Draft", tone: "neutral" },
  configured: { label: "Configured", tone: "info" },
  active: { label: "Active", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  error: { label: "Error", tone: "danger" },
  disconnected: { label: "Disconnected", tone: "neutral" },
};

export function isExternalConnectorProvider(value: string): value is ExternalConnectorProvider {
  return (EXTERNAL_CONNECTOR_PROVIDERS as readonly string[]).includes(value);
}

export function isExternalConnectorCategory(value: string): value is ExternalConnectorCategory {
  return (EXTERNAL_CONNECTOR_CATEGORIES as readonly string[]).includes(value);
}

export function isExternalConnectorStatus(value: string): value is ExternalConnectorStatus {
  return (EXTERNAL_CONNECTOR_STATUSES as readonly string[]).includes(value);
}

export function isExternalSyncStatus(value: string): value is ExternalSyncStatus {
  return (EXTERNAL_SYNC_STATUSES as readonly string[]).includes(value);
}

export function isExternalSyncEventKind(value: string): value is ExternalSyncEventKind {
  return (EXTERNAL_SYNC_EVENT_KINDS as readonly string[]).includes(value);
}
