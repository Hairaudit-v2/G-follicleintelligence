/**
 * OnboardingOS Phase F1 — External connector engine (pure; no server-only).
 * Universal connector architecture for legacy system coexistence without immediate migration.
 */

import type {
  ExternalConnectorCatalogEntry,
  ExternalConnectorConfigurationInput,
  ExternalConnectorHealthBand,
  ExternalConnectorHealthStatus,
  ExternalConnectorMappingPlan,
  ExternalConnectorProvider,
  ExternalConnectorStatus,
  ExternalConnectorSyncHealth,
  ExternalConnectorSyncHealthInput,
  ExternalConnectorValidationResult,
  ExternalSyncStatus,
} from "./externalConnectorTypes";
import {
  EXTERNAL_CONNECTOR_CATEGORY_LABELS,
  EXTERNAL_CONNECTOR_PROVIDER_LABELS,
  isExternalConnectorProvider,
  isExternalConnectorStatus,
} from "./externalConnectorTypes";

const PROVIDER_CATEGORY_MAP: Record<ExternalConnectorProvider, ExternalConnectorCatalogEntry["category"]> = {
  pabau: "crm",
  cliniko: "crm",
  hubspot: "crm",
  google_calendar: "calendar",
  microsoft_outlook: "calendar",
  stripe: "finance",
  xero: "finance",
  meta_ads: "marketing",
  google_ads: "marketing",
};

const BASE_MAPPING_PLANS: Record<
  ExternalConnectorProvider,
  ExternalConnectorMappingPlan["entries"]
> = {
  pabau: [
    {
      sourceEntity: "client",
      targetEntity: "fi_person",
      label: "Clients → FI persons",
      fields: [
        { sourceField: "id", targetField: "external_id", required: true },
        { sourceField: "email", targetField: "email", required: false },
        { sourceField: "first_name", targetField: "given_name", required: true },
        { sourceField: "last_name", targetField: "family_name", required: true },
      ],
    },
    {
      sourceEntity: "appointment",
      targetEntity: "fi_appointment",
      label: "Appointments → FI calendar",
      fields: [
        { sourceField: "id", targetField: "external_id", required: true },
        { sourceField: "client_id", targetField: "person_id", required: true },
        { sourceField: "start_at", targetField: "starts_at", required: true },
      ],
    },
  ],
  cliniko: [
    {
      sourceEntity: "patient",
      targetEntity: "fi_person",
      label: "Patients → FI persons",
      fields: [
        { sourceField: "id", targetField: "external_id", required: true },
        { sourceField: "email", targetField: "email", required: false },
        { sourceField: "first_name", targetField: "given_name", required: true },
      ],
    },
    {
      sourceEntity: "appointment",
      targetEntity: "fi_appointment",
      label: "Appointments → FI calendar",
      fields: [
        { sourceField: "id", targetField: "external_id", required: true },
        { sourceField: "patient_id", targetField: "person_id", required: true },
      ],
    },
  ],
  hubspot: [
    {
      sourceEntity: "contact",
      targetEntity: "fi_crm_lead",
      label: "Contacts → CRM leads",
      fields: [
        { sourceField: "id", targetField: "external_id", required: true },
        { sourceField: "email", targetField: "email", required: false },
        { sourceField: "lifecyclestage", targetField: "stage", required: false },
      ],
    },
    {
      sourceEntity: "deal",
      targetEntity: "fi_crm_opportunity",
      label: "Deals → CRM opportunities",
      fields: [
        { sourceField: "id", targetField: "external_id", required: true },
        { sourceField: "dealstage", targetField: "pipeline_stage", required: true },
      ],
    },
  ],
  google_calendar: [
    {
      sourceEntity: "event",
      targetEntity: "fi_appointment",
      label: "Calendar events → FI appointments",
      fields: [
        { sourceField: "id", targetField: "external_id", required: true },
        { sourceField: "summary", targetField: "title", required: true },
        { sourceField: "start.dateTime", targetField: "starts_at", required: true },
      ],
    },
  ],
  microsoft_outlook: [
    {
      sourceEntity: "event",
      targetEntity: "fi_appointment",
      label: "Outlook events → FI appointments",
      fields: [
        { sourceField: "id", targetField: "external_id", required: true },
        { sourceField: "subject", targetField: "title", required: true },
        { sourceField: "start.dateTime", targetField: "starts_at", required: true },
      ],
    },
  ],
  stripe: [
    {
      sourceEntity: "customer",
      targetEntity: "fi_billing_customer",
      label: "Stripe customers → FI billing",
      fields: [
        { sourceField: "id", targetField: "external_id", required: true },
        { sourceField: "email", targetField: "email", required: false },
      ],
    },
    {
      sourceEntity: "invoice",
      targetEntity: "fi_invoice",
      label: "Invoices → FI invoices",
      fields: [
        { sourceField: "id", targetField: "external_id", required: true },
        { sourceField: "amount_due", targetField: "amount_cents", required: true },
      ],
    },
  ],
  xero: [
    {
      sourceEntity: "contact",
      targetEntity: "fi_billing_customer",
      label: "Xero contacts → FI billing",
      fields: [
        { sourceField: "ContactID", targetField: "external_id", required: true },
        { sourceField: "EmailAddress", targetField: "email", required: false },
      ],
    },
    {
      sourceEntity: "invoice",
      targetEntity: "fi_invoice",
      label: "Xero invoices → FI invoices",
      fields: [
        { sourceField: "InvoiceID", targetField: "external_id", required: true },
        { sourceField: "Total", targetField: "amount_cents", required: true },
      ],
    },
  ],
  meta_ads: [
    {
      sourceEntity: "campaign",
      targetEntity: "fi_marketing_campaign",
      label: "Meta campaigns → FI marketing",
      fields: [
        { sourceField: "id", targetField: "external_id", required: true },
        { sourceField: "name", targetField: "name", required: true },
        { sourceField: "status", targetField: "status", required: false },
      ],
    },
  ],
  google_ads: [
    {
      sourceEntity: "campaign",
      targetEntity: "fi_marketing_campaign",
      label: "Google Ads campaigns → FI marketing",
      fields: [
        { sourceField: "id", targetField: "external_id", required: true },
        { sourceField: "name", targetField: "name", required: true },
      ],
    },
  ],
};

const CONFIG_FIELDS: Record<ExternalConnectorProvider, ExternalConnectorCatalogEntry["configFields"]> = {
  pabau: [
    { key: "subdomain", label: "Pabau subdomain", required: true },
    { key: "api_key", label: "API key", required: true, sensitive: true },
  ],
  cliniko: [
    { key: "shard", label: "Cliniko shard", required: true },
    { key: "api_key", label: "API key", required: true, sensitive: true },
  ],
  hubspot: [
    { key: "portal_id", label: "HubSpot portal ID", required: true },
    { key: "api_key", label: "Private app token", required: true, sensitive: true },
  ],
  google_calendar: [
    { key: "calendar_id", label: "Calendar ID", required: true },
    { key: "account_email", label: "Google account email", required: true },
  ],
  microsoft_outlook: [
    { key: "mailbox_email", label: "Mailbox email", required: true },
    { key: "tenant_id", label: "Microsoft tenant ID", required: true },
  ],
  stripe: [
    { key: "account_id", label: "Stripe account ID", required: false },
    { key: "api_key", label: "Secret key", required: true, sensitive: true },
  ],
  xero: [
    { key: "tenant_id", label: "Xero organisation ID", required: true },
    { key: "api_key", label: "API key / token", required: true, sensitive: true },
  ],
  meta_ads: [
    { key: "ad_account_id", label: "Ad account ID", required: true },
    { key: "api_key", label: "Access token", required: true, sensitive: true },
  ],
  google_ads: [
    { key: "customer_id", label: "Google Ads customer ID", required: true },
    { key: "developer_token", label: "Developer token", required: true, sensitive: true },
  ],
};

const PROVIDER_DESCRIPTIONS: Record<ExternalConnectorProvider, string> = {
  pabau: "Connect Pabau CRM and booking data for coexistence during migration.",
  cliniko: "Connect Cliniko patients and appointments without immediate cutover.",
  hubspot: "Bridge HubSpot contacts and deals into FI CRM workflows.",
  google_calendar: "Mirror Google Calendar events alongside FI scheduling.",
  microsoft_outlook: "Mirror Outlook calendar events alongside FI scheduling.",
  stripe: "Reference Stripe billing data while FI FinancialOS is primary.",
  xero: "Reference Xero invoices and contacts during finance transition.",
  meta_ads: "Track Meta ad campaigns for attribution alongside FI marketing.",
  google_ads: "Track Google Ads campaigns for attribution alongside FI marketing.",
};

/** Build the supported connector catalog (architecture foundation — no live sync). */
export function buildSupportedConnectorCatalog(): readonly ExternalConnectorCatalogEntry[] {
  return (Object.keys(PROVIDER_CATEGORY_MAP) as ExternalConnectorProvider[]).map((provider) => ({
    provider,
    category: PROVIDER_CATEGORY_MAP[provider],
    label: EXTERNAL_CONNECTOR_PROVIDER_LABELS[provider],
    description: PROVIDER_DESCRIPTIONS[provider],
    supportedSyncModes: ["manual", "disabled"] as const,
    configFields: CONFIG_FIELDS[provider],
    liveSyncAvailable: false,
  }));
}

export function getConnectorCatalogEntry(
  provider: ExternalConnectorProvider
): ExternalConnectorCatalogEntry | null {
  return buildSupportedConnectorCatalog().find((e) => e.provider === provider) ?? null;
}

/** Validate connector configuration before persistence. */
export function validateConnectorConfiguration(
  input: ExternalConnectorConfigurationInput
): ExternalConnectorValidationResult {
  const errors: string[] = [];
  const providerRaw = String(input.provider ?? "").trim();

  if (!isExternalConnectorProvider(providerRaw)) {
    errors.push(`Unknown connector provider: ${providerRaw || "(empty)"}.`);
    return { ok: false, errors };
  }

  const entry = getConnectorCatalogEntry(providerRaw);
  if (!entry) {
    errors.push(`Provider ${providerRaw} is not in the supported catalog.`);
    return { ok: false, errors };
  }

  const config = (input.config ?? {}) as Record<string, unknown>;
  for (const field of entry.configFields) {
    if (!field.required) continue;
    if (field.sensitive && input.credentialPlaintext?.trim()) continue;
    const val = config[field.key];
    if (val == null || String(val).trim() === "") {
      errors.push(`${field.label} is required.`);
    }
  }

  if (input.syncMode && !entry.supportedSyncModes.includes(input.syncMode)) {
    errors.push(`Sync mode "${input.syncMode}" is not supported for ${entry.label} yet.`);
  }

  const hasSensitiveField = entry.configFields.some((f) => f.sensitive);
  if (hasSensitiveField && !input.credentialPlaintext?.trim() && !configHasSensitiveValue(config, entry)) {
    errors.push("Credential or API key material is required for this connector.");
  }

  if (errors.length) return { ok: false, errors };

  return { ok: true, provider: providerRaw, category: entry.category };
}

function configHasSensitiveValue(
  config: Record<string, unknown>,
  entry: ExternalConnectorCatalogEntry
): boolean {
  for (const field of entry.configFields) {
    if (!field.sensitive) continue;
    const val = config[field.key];
    if (val != null && String(val).trim() !== "") return true;
  }
  return false;
}

function resolveHealthBand(score: number): ExternalConnectorHealthBand {
  if (score >= 80) return "healthy";
  if (score >= 50) return "degraded";
  if (score > 0) return "unhealthy";
  return "unknown";
}

/** Resolve health band and summary for a single integration. */
export function resolveConnectorHealthStatus(opts: {
  integrationId: string;
  provider: ExternalConnectorProvider;
  status: ExternalConnectorStatus | string;
  syncStatus: ExternalSyncStatus | null;
  healthScore: number;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  credentialConfigured: boolean;
}): ExternalConnectorHealthStatus {
  const status = isExternalConnectorStatus(opts.status) ? opts.status : "draft";
  const syncHealth = calculateConnectorSyncHealth({
    integrationStatus: status,
    syncStatus: opts.syncStatus,
    healthScore: opts.healthScore,
    lastSuccessAt: opts.lastSuccessAt,
    lastError: opts.lastError,
    recentFailureCount: opts.lastError ? 1 : 0,
    credentialConfigured: opts.credentialConfigured,
  });

  const blockers: string[] = [...syncHealth.recommendations];
  if (status === "error" && opts.lastError) {
    blockers.unshift(opts.lastError);
  }

  return {
    integrationId: opts.integrationId,
    provider: opts.provider,
    status,
    syncStatus: opts.syncStatus,
    healthBand: syncHealth.band,
    healthScore: syncHealth.score,
    summary: syncHealth.summary,
    blockers,
    lastSyncAt: opts.lastSyncAt,
    lastSuccessAt: opts.lastSuccessAt,
    lastError: opts.lastError,
  };
}

/** Build default entity mapping plan for a provider. */
export function buildConnectorMappingPlan(provider: ExternalConnectorProvider): ExternalConnectorMappingPlan {
  const category = PROVIDER_CATEGORY_MAP[provider];
  return {
    provider,
    category,
    entries: [...(BASE_MAPPING_PLANS[provider] ?? [])],
  };
}

/** Calculate sync health score from integration and sync signals. */
export function calculateConnectorSyncHealth(input: ExternalConnectorSyncHealthInput): ExternalConnectorSyncHealth {
  const recommendations: string[] = [];
  let score = input.healthScore;

  if (!input.credentialConfigured) {
    score = Math.min(score, 20);
    recommendations.push("Store connector credentials before enabling sync.");
  }

  if (input.integrationStatus === "draft") {
    score = Math.min(score, 30);
    recommendations.push("Complete connector configuration.");
  } else if (input.integrationStatus === "paused") {
    score = Math.min(score, 40);
    recommendations.push("Connector is paused — resume when ready to sync.");
  } else if (input.integrationStatus === "disconnected") {
    score = 0;
    recommendations.push("Reconnect the external system.");
  } else if (input.integrationStatus === "error") {
    score = Math.min(score, 25);
    recommendations.push("Resolve connector error state.");
  }

  if (input.syncStatus === "failed") {
    score = Math.min(score, 35);
    recommendations.push("Last sync failed — review error details.");
  } else if (input.syncStatus === "partial") {
    score = Math.min(score, 60);
    recommendations.push("Partial sync — review failed records.");
  }

  if (input.recentFailureCount >= 3) {
    score = Math.min(score, 40);
    recommendations.push(`${input.recentFailureCount} recent sync failures detected.`);
  }

  if (!input.lastSuccessAt && input.integrationStatus !== "draft") {
    score = Math.min(score, 45);
    recommendations.push("No successful sync recorded yet.");
  }

  if (input.lastError) {
    recommendations.push(`Last error: ${input.lastError}`);
  }

  score = Math.max(0, Math.min(100, score));
  const band = resolveHealthBand(score);

  const summary =
    band === "healthy"
      ? "Connector is configured and sync signals are healthy."
      : band === "degraded"
        ? "Connector is operational but needs attention."
        : band === "unhealthy"
          ? "Connector requires configuration or error resolution."
          : "Connector health unknown — complete setup.";

  return {
    score,
    band,
    summary,
    recommendations: [...new Set(recommendations)],
  };
}

/** Group catalog entries by category for onboarding UI. */
export function groupConnectorCatalogByCategory(
  catalog: readonly ExternalConnectorCatalogEntry[]
): Record<string, ExternalConnectorCatalogEntry[]> {
  const grouped: Record<string, ExternalConnectorCatalogEntry[]> = {};
  for (const entry of catalog) {
    const label = EXTERNAL_CONNECTOR_CATEGORY_LABELS[entry.category];
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(entry);
  }
  return grouped;
}

/** Default display name for a new connector registration. */
export function defaultConnectorDisplayName(provider: ExternalConnectorProvider): string {
  return `${EXTERNAL_CONNECTOR_PROVIDER_LABELS[provider]} connector`;
}

/** Resolve integration status after configuration validation passes. */
export function resolveInitialConnectorStatus(
  credentialConfigured: boolean,
  configComplete: boolean
): "draft" | "configured" {
  if (credentialConfigured && configComplete) return "configured";
  return "draft";
}
