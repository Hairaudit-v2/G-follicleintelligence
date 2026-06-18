import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertFiPlatformAdminSystemAccess } from "@/src/lib/fiOs/fiOsPlatformSystemGate.server";
import { TIMELY_WEBHOOK_ROUTES } from "@/src/lib/integrations/timely/timelyWebhookAudit.server";

/**
 * Platform-wide IntegrationOS monitoring snapshot (read-only).
 *
 * Aggregates Timely webhook health, HubSpot import outcomes, recent webhook events, and derived
 * system-health signals across all tenants for the FI platform system console. Uses the Supabase
 * service role AFTER {@link assertFiPlatformAdminSystemAccess} (the page layout already enforces
 * this; we repeat it here for defense in depth). Performs no writes.
 *
 * Privacy: the recent-events list deliberately omits the raw `payload` column so patient-bearing
 * webhook bodies are never surfaced in the console — only metadata + `payload_hash`.
 */

const WEBHOOK_TABLE = "fi_integration_webhook_events";
const STALE_TIMELY_HOURS = 24;
const RECEIVED_STUCK_MINUTES = 5;
const RECENT_EVENTS_LIMIT = 100;
const HUBSPOT_BATCH_SCAN_LIMIT = 500;

export type TimelyIntegrationStatus = {
  lastWebhookReceived: string | null;
  lastSuccessfulSync: string | null;
  failedSyncCount: number;
  appointmentCreatedCount: number;
  appointmentUpdatedCount: number;
  appointmentCancelledCount: number;
  appointmentCompletedCount: number;
};

export type HubspotIntegrationStatus = {
  importedLeads: number;
  failedImports: number;
  duplicateRecords: number;
  lastImportAt: string | null;
  completedBatches: number;
};

export type IntegrationWebhookEventRow = {
  id: string;
  tenant_id: string;
  provider: string;
  event_type: string;
  route: string;
  status: string;
  payload_hash: string | null;
  error_message: string | null;
  created_at: string;
};

export type SystemHealthSeverity = "ok" | "warn" | "alert";

export type SystemHealthStatus = {
  apiFailuresTotal: number;
  apiFailures24h: number;
  /** `received` rows never finalized (stuck >5m) — candidates for Zapier redelivery. */
  retryStuckReceived: number;
  /** `error` rows — Zapier retries these per its at-least-once policy. */
  retryErrored: number;
  staleAlerts: { label: string; detail: string; severity: SystemHealthSeverity }[];
};

export type IntegrationOsMonitoring = {
  generatedAt: string;
  timely: TimelyIntegrationStatus;
  hubspot: HubspotIntegrationStatus;
  recentWebhookEvents: IntegrationWebhookEventRow[];
  systemHealth: SystemHealthStatus;
  /** Non-fatal per-section load errors; the page renders whatever succeeded. */
  errors: string[];
};

type Supa = ReturnType<typeof supabaseAdmin>;

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

// The PostgREST builder chain types are awkward to thread through a closure (the same problem
// handled structurally by src/lib/cases/activeCaseFilter.ts). Every call site only uses read-only
// `.eq/.gte/.lt` filters before awaiting.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WebhookQueryBuilder = any;
type WebhookFilter = (q: WebhookQueryBuilder) => WebhookQueryBuilder;

async function countWebhookEvents(supabase: Supa, build: WebhookFilter): Promise<number> {
  const base = supabase.from(WEBHOOK_TABLE).select("id", { count: "exact", head: true });
  const { count, error } = await build(base);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function latestTimestamp(supabase: Supa, build: WebhookFilter): Promise<string | null> {
  const base = supabase.from(WEBHOOK_TABLE).select("created_at").order("created_at", { ascending: false }).limit(1);
  const { data, error } = await build(base).maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { created_at?: string } | null;
  return row?.created_at ? String(row.created_at) : null;
}

async function loadTimelyStatus(supabase: Supa): Promise<TimelyIntegrationStatus> {
  const appt = TIMELY_WEBHOOK_ROUTES.appointment;

  const [
    lastWebhookReceived,
    lastSuccessfulSync,
    failedSyncCount,
    appointmentCreatedCount,
    appointmentUpdatedCount,
    appointmentCancelledCount,
    appointmentCompletedCount,
  ] = await Promise.all([
    latestTimestamp(supabase, (q) => q.eq("provider", "timely")),
    latestTimestamp(supabase, (q) => q.eq("provider", "timely").eq("route", appt).eq("status", "processed")),
    countWebhookEvents(supabase, (q) => q.eq("provider", "timely").eq("route", appt).eq("status", "error")),
    countWebhookEvents(supabase, (q) => q.eq("provider", "timely").eq("event_type", "appointment_created")),
    countWebhookEvents(supabase, (q) => q.eq("provider", "timely").eq("event_type", "appointment_updated")),
    countWebhookEvents(supabase, (q) => q.eq("provider", "timely").eq("event_type", "appointment_cancelled")),
    countWebhookEvents(supabase, (q) => q.eq("provider", "timely").eq("event_type", "appointment_completed")),
  ]);

  return {
    lastWebhookReceived,
    lastSuccessfulSync,
    failedSyncCount,
    appointmentCreatedCount,
    appointmentUpdatedCount,
    appointmentCancelledCount,
    appointmentCompletedCount,
  };
}

const DUPLICATE_ERROR_PATTERN = /already imported/i;

async function loadHubspotStatus(supabase: Supa): Promise<HubspotIntegrationStatus> {
  const { data, error } = await supabase
    .from("fi_import_batches")
    .select("status, imported_row_count, imported_at, metadata")
    .eq("source_system", "hubspot")
    .order("created_at", { ascending: false })
    .limit(HUBSPOT_BATCH_SCAN_LIMIT);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    status: string;
    imported_row_count: number | null;
    imported_at: string | null;
    metadata: unknown;
  }[];

  let importedLeads = 0;
  let failedImports = 0;
  let duplicateRecords = 0;
  let completedBatches = 0;
  let lastImportAt: string | null = null;

  for (const row of rows) {
    importedLeads += row.imported_row_count ?? 0;
    if (row.status === "import_completed") completedBatches += 1;
    if (row.status === "import_failed") failedImports += 1;
    if (row.imported_at && (!lastImportAt || row.imported_at > lastImportAt)) {
      lastImportAt = row.imported_at;
    }

    // Per-row outcomes are recorded in metadata.import_stage1_errors. Duplicate skips carry
    // "already imported"; everything else is a genuine row failure.
    const meta = row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};
    const errs = Array.isArray(meta.import_stage1_errors) ? (meta.import_stage1_errors as unknown[]) : [];
    for (const e of errs) {
      const msg = typeof e === "string" ? e : "";
      if (DUPLICATE_ERROR_PATTERN.test(msg)) duplicateRecords += 1;
      else failedImports += 1;
    }
  }

  return { importedLeads, failedImports, duplicateRecords, lastImportAt, completedBatches };
}

async function loadRecentWebhookEvents(supabase: Supa): Promise<IntegrationWebhookEventRow[]> {
  // NOTE: `payload` is intentionally NOT selected — it can contain patient data.
  const { data, error } = await supabase
    .from(WEBHOOK_TABLE)
    .select("id, tenant_id, provider, event_type, route, status, payload_hash, error_message, created_at")
    .order("created_at", { ascending: false })
    .limit(RECENT_EVENTS_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []) as IntegrationWebhookEventRow[];
}

async function loadSystemHealth(
  supabase: Supa,
  timely: TimelyIntegrationStatus,
  hubspot: HubspotIntegrationStatus
): Promise<SystemHealthStatus> {
  const [apiFailuresTotal, apiFailures24h, retryStuckReceived, retryErrored] = await Promise.all([
    countWebhookEvents(supabase, (q) => q.eq("status", "error")),
    countWebhookEvents(supabase, (q) => q.eq("status", "error").gte("created_at", isoMinutesAgo(24 * 60))),
    countWebhookEvents(supabase, (q) =>
      q.eq("status", "received").lt("created_at", isoMinutesAgo(RECEIVED_STUCK_MINUTES))
    ),
    countWebhookEvents(supabase, (q) => q.eq("status", "error")),
  ]);

  const staleAlerts: SystemHealthStatus["staleAlerts"] = [];

  // Timely: alert if no successful appointment sync within the staleness window.
  if (!timely.lastSuccessfulSync) {
    staleAlerts.push({
      label: "Timely sync",
      detail: "No successful appointment sync recorded yet.",
      severity: "warn",
    });
  } else {
    const ageMs = Date.now() - new Date(timely.lastSuccessfulSync).getTime();
    const ageHours = ageMs / 3_600_000;
    staleAlerts.push({
      label: "Timely sync",
      detail: `Last successful sync ${formatAge(ageMs)} ago.`,
      severity: ageHours > STALE_TIMELY_HOURS ? "alert" : "ok",
    });
  }

  // Stuck in-flight webhook claims (never finalized) are a health signal regardless of provider.
  if (retryStuckReceived > 0) {
    staleAlerts.push({
      label: "Stuck webhook events",
      detail: `${retryStuckReceived} event(s) stuck in "received" for over ${RECEIVED_STUCK_MINUTES} min.`,
      severity: "alert",
    });
  }

  if (hubspot.lastImportAt) {
    staleAlerts.push({
      label: "HubSpot import",
      detail: `Last import ${formatAge(Date.now() - new Date(hubspot.lastImportAt).getTime())} ago.`,
      severity: "ok",
    });
  }

  return { apiFailuresTotal, apiFailures24h, retryStuckReceived, retryErrored, staleAlerts };
}

export function formatAge(ms: number): string {
  if (ms < 0) ms = 0;
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export async function loadIntegrationOsMonitoring(): Promise<IntegrationOsMonitoring> {
  await assertFiPlatformAdminSystemAccess();
  const supabase = supabaseAdmin();
  const errors: string[] = [];

  const emptyTimely: TimelyIntegrationStatus = {
    lastWebhookReceived: null,
    lastSuccessfulSync: null,
    failedSyncCount: 0,
    appointmentCreatedCount: 0,
    appointmentUpdatedCount: 0,
    appointmentCancelledCount: 0,
    appointmentCompletedCount: 0,
  };
  const emptyHubspot: HubspotIntegrationStatus = {
    importedLeads: 0,
    failedImports: 0,
    duplicateRecords: 0,
    lastImportAt: null,
    completedBatches: 0,
  };

  const [timelyR, hubspotR, eventsR] = await Promise.allSettled([
    loadTimelyStatus(supabase),
    loadHubspotStatus(supabase),
    loadRecentWebhookEvents(supabase),
  ]);

  const timely = timelyR.status === "fulfilled" ? timelyR.value : emptyTimely;
  if (timelyR.status === "rejected") errors.push(`Timely: ${String(timelyR.reason?.message ?? timelyR.reason)}`);

  const hubspot = hubspotR.status === "fulfilled" ? hubspotR.value : emptyHubspot;
  if (hubspotR.status === "rejected") errors.push(`HubSpot: ${String(hubspotR.reason?.message ?? hubspotR.reason)}`);

  const recentWebhookEvents = eventsR.status === "fulfilled" ? eventsR.value : [];
  if (eventsR.status === "rejected") errors.push(`Webhook events: ${String(eventsR.reason?.message ?? eventsR.reason)}`);

  let systemHealth: SystemHealthStatus = {
    apiFailuresTotal: 0,
    apiFailures24h: 0,
    retryStuckReceived: 0,
    retryErrored: 0,
    staleAlerts: [],
  };
  try {
    systemHealth = await loadSystemHealth(supabase, timely, hubspot);
  } catch (e) {
    errors.push(`System health: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    generatedAt: new Date().toISOString(),
    timely,
    hubspot,
    recentWebhookEvents,
    systemHealth,
    errors,
  };
}
