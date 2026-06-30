import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import { logStructured } from "@/src/lib/server/structuredLog";

import { createConnectorSyncEvent } from "./externalConnector.server";
import {
  calculateCalendarSyncHealth,
  coerceEventType,
  coerceSyncRunStatus,
  detectDuplicateExternalEvent,
  normalizeGoogleCalendarEvent,
  resolveCalendarImportStatus,
} from "./googleCalendarConnectorCore";
import {
  buildGoogleCalendarListQueryParams,
  GOOGLE_CALENDAR_SYNC_MAX_PAGES,
  parseGoogleCalendarListResponse,
} from "@/src/lib/googleCalendar/googleCalendarCore";
import type {
  ExternalCalendarImportAuditAction,
  ExternalCalendarStagingEvent,
  ExternalCalendarSyncRun,
  GoogleCalendarApiEvent,
  GoogleCalendarConnectorSnapshot,
} from "./googleCalendarConnectorTypes";
import {
  isExternalCalendarImportStatus,
  isExternalCalendarSyncRunStatus,
} from "./googleCalendarConnectorTypes";
import {
  decryptExternalConnectorSecret,
  deriveExternalConnectorMasterKey,
} from "./externalConnectorSecretCrypto.server";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  actorAuthUserId?: string | null;
  skipAuthCheck?: boolean;
  allowTenantMemberRead?: boolean;
  /** Test hook — inject events instead of calling Google API. */
  fetchEventsOverride?: (
    calendarId: string,
    accessToken: string
  ) => Promise<GoogleCalendarApiEvent[]>;
};

type StagingRow = {
  id: string;
  integration_id: string;
  tenant_id: string;
  sync_run_id: string | null;
  google_event_id: string;
  calendar_id: string;
  event_title: string;
  start_at: string | null;
  end_at: string | null;
  attendee_emails: string[] | unknown;
  raw_payload: Record<string, unknown>;
  normalized_event_type: string;
  import_status: string;
  imported_at: string | null;
  created_at: string;
  updated_at: string;
};

type SyncRunRow = {
  id: string;
  integration_id: string;
  tenant_id: string;
  status: string;
  events_discovered: number;
  events_staged: number;
  events_skipped: number;
  health_score: number;
  detail: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

type IntegrationRow = {
  id: string;
  tenant_id: string;
  provider: string;
  config: Record<string, unknown>;
  status: string;
};

type AuthSessionRow = {
  auth_status: string;
};

const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const SYNC_LOOKBACK_DAYS = 30;
const SYNC_LOOKAHEAD_DAYS = 90;

export type GoogleCalendarActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export type RunGoogleCalendarSyncResult =
  | { ok: true; syncRun: ExternalCalendarSyncRun; snapshot: GoogleCalendarConnectorSnapshot }
  | { ok: false; error: string };

function resolveMasterKey(): Buffer | null {
  return deriveExternalConnectorMasterKey(process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY);
}

async function resolvePlatformAdminAuth(
  opts: ServerOpts
): Promise<{ ok: true; actorAuthUserId: string } | { ok: false; error: string }> {
  const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
  if (!authId) return { ok: false, error: "Authentication required." };
  if (opts.skipAuthCheck && opts.actorAuthUserId) {
    return { ok: true, actorAuthUserId: authId };
  }
  const os = await loadFiOsIdentity(authId);
  if (!isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
    return { ok: false, error: "Platform administrator access is required." };
  }
  return { ok: true, actorAuthUserId: authId };
}

async function resolveTenantAdminAuth(
  tenantId: string,
  opts: ServerOpts
): Promise<
  | { ok: true; actorAuthUserId: string; fiUserId: string; actorLabel: string }
  | { ok: false; error: string }
> {
  const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
  if (!authId) return { ok: false, error: "Authentication required." };

  const os = await loadFiOsIdentity(authId);
  if (isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
    if (opts.skipAuthCheck) {
      return { ok: true, actorAuthUserId: authId, fiUserId: "", actorLabel: "Platform admin" };
    }
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, email")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Tenant membership required." };

  const adminProf = await loadActiveTenantAdminProfileForSession(tenantId, authId);
  if (adminProf?.adminRole !== "clinic_admin" && adminProf?.adminRole !== "operations_admin") {
    if (!opts.skipAuthCheck) {
      const platform = await resolvePlatformAdminAuth(opts);
      if (!platform.ok) return { ok: false, error: "Tenant admin access is required." };
      return { ok: true, actorAuthUserId: authId, fiUserId: "", actorLabel: "Platform admin" };
    }
    return { ok: false, error: "Tenant admin access is required." };
  }

  const row = data as { id: string; email: string | null };
  return {
    ok: true,
    actorAuthUserId: authId,
    fiUserId: String(row.id),
    actorLabel: row.email ?? "Tenant admin",
  };
}

async function resolveWriteAuth(
  tenantId: string,
  opts: ServerOpts
): Promise<
  | { ok: true; actorAuthUserId: string; fiUserId: string | null; actorLabel: string }
  | { ok: false; error: string }
> {
  const platform = await resolvePlatformAdminAuth({ ...opts, skipAuthCheck: false });
  if (platform.ok) {
    return {
      ok: true,
      actorAuthUserId: platform.actorAuthUserId,
      fiUserId: null,
      actorLabel: "Platform admin",
    };
  }
  const tenant = await resolveTenantAdminAuth(tenantId, opts);
  if (!tenant.ok) return tenant;
  return {
    ok: true,
    actorAuthUserId: tenant.actorAuthUserId,
    fiUserId: tenant.fiUserId || null,
    actorLabel: tenant.actorLabel,
  };
}

async function resolveReadAuth(
  tenantId: string,
  opts: ServerOpts
): Promise<{ ok: true } | { ok: false; error: string }> {
  const platform = await resolvePlatformAdminAuth({ ...opts, skipAuthCheck: false });
  if (platform.ok) return { ok: true };

  if (opts.allowTenantMemberRead) {
    const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
    if (!authId) return { ok: false, error: "Authentication required." };
    const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
    const { data: member } = await supabase
      .from("fi_users")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("auth_user_id", authId)
      .maybeSingle();
    if (member) return { ok: true };
  }

  const tenant = await resolveTenantAdminAuth(tenantId, { ...opts, skipAuthCheck: true });
  if (tenant.ok) return { ok: true };
  return { ok: false, error: "Access denied." };
}

function mapStagingRow(row: StagingRow): ExternalCalendarStagingEvent {
  const attendeeRaw = row.attendee_emails;
  const attendeeEmails = Array.isArray(attendeeRaw) ? attendeeRaw.map(String) : [];
  const importStatus = isExternalCalendarImportStatus(row.import_status)
    ? row.import_status
    : "staged";

  return {
    id: row.id,
    integrationId: row.integration_id,
    tenantId: row.tenant_id,
    syncRunId: row.sync_run_id,
    googleEventId: row.google_event_id,
    calendarId: row.calendar_id,
    eventTitle: row.event_title,
    startAt: row.start_at,
    endAt: row.end_at,
    attendeeEmails,
    rawPayload: row.raw_payload ?? {},
    normalizedEventType: coerceEventType(row.normalized_event_type),
    importStatus,
    importedAt: row.imported_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSyncRunRow(row: SyncRunRow): ExternalCalendarSyncRun {
  const status = isExternalCalendarSyncRunStatus(row.status)
    ? row.status
    : coerceSyncRunStatus(row.status);
  return {
    id: row.id,
    integrationId: row.integration_id,
    tenantId: row.tenant_id,
    status,
    eventsDiscovered: row.events_discovered,
    eventsStaged: row.events_staged,
    eventsSkipped: row.events_skipped,
    healthScore: row.health_score,
    detail: row.detail ?? {},
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

function parseAccessTokenFromCredentialPayload(serialized: string): string | null {
  try {
    const parsed = JSON.parse(serialized) as { secret?: string; kind?: string };
    const secret = parsed.secret?.trim();
    if (!secret) return null;

    if (secret.startsWith("{")) {
      const tokenObj = JSON.parse(secret) as { access_token?: string; accessToken?: string };
      return tokenObj.access_token?.trim() || tokenObj.accessToken?.trim() || null;
    }
    return secret;
  } catch {
    return null;
  }
}

async function loadGoogleCalendarAccessToken(
  supabase: SupabaseClient,
  integrationId: string
): Promise<string | null> {
  const masterKey = resolveMasterKey();
  if (!masterKey) return null;

  const { data } = await supabase
    .from("fi_external_connector_credentials")
    .select("credentials_encrypted, credential_kind")
    .eq("integration_id", integrationId)
    .in("credential_kind", ["oauth_tokens", "api_key"])
    .order("credential_kind", { ascending: true })
    .limit(2);

  for (const row of (data ?? []) as { credentials_encrypted: string }[]) {
    try {
      const decrypted = decryptExternalConnectorSecret(row.credentials_encrypted, masterKey);
      const token = parseAccessTokenFromCredentialPayload(decrypted);
      if (token) return token;
    } catch {
      continue;
    }
  }
  return null;
}

async function loadAuthVerified(supabase: SupabaseClient, integrationId: string): Promise<boolean> {
  const { data } = await supabase
    .from("fi_external_connector_auth_sessions")
    .select("auth_status")
    .eq("integration_id", integrationId)
    .maybeSingle();
  const row = data as AuthSessionRow | null;
  return row?.auth_status === "verified";
}

async function loadIntegration(
  supabase: SupabaseClient,
  integrationId: string,
  tenantId: string
): Promise<IntegrationRow | null> {
  const { data, error } = await supabase
    .from("fi_tenant_external_integrations")
    .select("id, tenant_id, provider, config, status")
    .eq("id", integrationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as IntegrationRow | null) ?? null;
}

/** Read-only Google Calendar events list (GET only — never writes to Google). */
export async function fetchGoogleCalendarEventsReadOnly(
  calendarId: string,
  accessToken: string,
  opts?: { timeMin?: string; timeMax?: string }
): Promise<GoogleCalendarApiEvent[]> {
  const now = Date.now();
  const timeMin =
    opts?.timeMin ?? new Date(now - SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const timeMax =
    opts?.timeMax ?? new Date(now + SYNC_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const encodedCalendarId = encodeURIComponent(calendarId);
  const all: GoogleCalendarApiEvent[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  while (pages < GOOGLE_CALENDAR_SYNC_MAX_PAGES) {
    const params = buildGoogleCalendarListQueryParams({ timeMin, timeMax, pageToken });
    const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodedCalendarId}/events?${params.toString()}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Google Calendar API error (${res.status}): ${body.slice(0, 300)}`);
    }

    const { items, nextPageToken } = parseGoogleCalendarListResponse(await res.json());
    all.push(...items);
    pages += 1;
    if (!nextPageToken) break;
    pageToken = nextPageToken;
  }

  return all;
}

async function appendCalendarImportAudit(
  supabase: SupabaseClient,
  entry: {
    integrationId: string;
    tenantId: string;
    stagingEventId?: string | null;
    syncRunId?: string | null;
    action: ExternalCalendarImportAuditAction;
    actorAuthUserId?: string | null;
    actorFiUserId?: string | null;
    actorLabel?: string | null;
    detail?: Record<string, unknown>;
  }
): Promise<void> {
  await supabase.from("fi_external_calendar_import_audit").insert({
    integration_id: entry.integrationId,
    tenant_id: entry.tenantId,
    staging_event_id: entry.stagingEventId ?? null,
    sync_run_id: entry.syncRunId ?? null,
    action: entry.action,
    actor_auth_user_id: entry.actorAuthUserId ?? null,
    actor_fi_user_id: entry.actorFiUserId ?? null,
    actor_label: entry.actorLabel ?? null,
    detail: entry.detail ?? {},
  });
}

async function loadExistingStagingForDedup(
  supabase: SupabaseClient,
  integrationId: string
): Promise<ExternalCalendarStagingEvent[]> {
  const { data } = await supabase
    .from("fi_external_calendar_event_staging")
    .select(
      "id, integration_id, tenant_id, sync_run_id, google_event_id, calendar_id, event_title, start_at, end_at, attendee_emails, raw_payload, normalized_event_type, import_status, imported_at, created_at, updated_at"
    )
    .eq("integration_id", integrationId);

  return ((data ?? []) as StagingRow[]).map(mapStagingRow);
}

/** Run read-only Google Calendar sync into staging tables. */
export async function runGoogleCalendarSync(
  integrationId: string,
  tenantId: string,
  opts: ServerOpts = {}
): Promise<RunGoogleCalendarSyncResult> {
  const auth = await resolveWriteAuth(tenantId, opts);
  if (!auth.ok) return auth;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const integration = await loadIntegration(supabase, integrationId, tenantId);
  if (!integration) return { ok: false, error: "Connector not found." };
  if (integration.provider !== "google_calendar") {
    return { ok: false, error: "Integration is not a Google Calendar connector." };
  }

  const authVerified = await loadAuthVerified(supabase, integrationId);
  if (!authVerified) {
    return { ok: false, error: "Verify Google Calendar credentials before syncing." };
  }

  const calendarId = String(integration.config?.calendar_id ?? "").trim();
  if (!calendarId) {
    return { ok: false, error: "Calendar ID is required in connector configuration." };
  }

  const accessToken = await loadGoogleCalendarAccessToken(supabase, integrationId);
  if (!accessToken && !opts.fetchEventsOverride) {
    return {
      ok: false,
      error: "OAuth access token not available — store connector credentials first.",
    };
  }

  const now = new Date().toISOString();
  const { data: syncRunInserted, error: syncRunErr } = await supabase
    .from("fi_external_calendar_sync_runs")
    .insert({
      integration_id: integrationId,
      tenant_id: tenantId,
      status: "started",
      detail: { calendar_id: calendarId, read_only: true },
      started_at: now,
    })
    .select("*")
    .single();

  if (syncRunErr || !syncRunInserted) {
    return { ok: false, error: syncRunErr?.message ?? "Failed to start sync run." };
  }

  const syncRunRow = syncRunInserted as SyncRunRow;

  await appendCalendarImportAudit(supabase, {
    integrationId,
    tenantId,
    syncRunId: syncRunRow.id,
    action: "sync_started",
    actorAuthUserId: auth.actorAuthUserId,
    actorFiUserId: auth.fiUserId,
    actorLabel: auth.actorLabel,
    detail: { calendar_id: calendarId },
  });

  await createConnectorSyncEvent(
    integrationId,
    tenantId,
    {
      eventKind: "sync_started",
      status: "info",
      detail: { provider: "google_calendar", calendar_id: calendarId, read_only: true },
      actorAuthUserId: auth.actorAuthUserId,
      actorFiUserId: auth.fiUserId,
      actorLabel: auth.actorLabel,
    },
    { ...opts, skipAuthCheck: true }
  );

  let discoveredEvents: GoogleCalendarApiEvent[] = [];
  let eventsStaged = 0;
  let eventsSkipped = 0;
  let syncStatus: ExternalCalendarSyncRun["status"] = "completed";
  let syncError: string | null = null;

  try {
    discoveredEvents = opts.fetchEventsOverride
      ? await opts.fetchEventsOverride(calendarId, accessToken ?? "")
      : await fetchGoogleCalendarEventsReadOnly(calendarId, accessToken!);

    const existingStaging = await loadExistingStagingForDedup(supabase, integrationId);

    const toStage = discoveredEvents
      .map((e) => normalizeGoogleCalendarEvent(e, calendarId))
      .filter((e): e is NonNullable<typeof e> => Boolean(e));

    const dedupContext = existingStaging.map((s) => ({
      googleEventId: s.googleEventId,
      eventTitle: s.eventTitle,
      startAt: s.startAt,
      importStatus: s.importStatus,
    }));

    for (const event of toStage) {
      if (detectDuplicateExternalEvent(event, dedupContext)) {
        eventsSkipped += 1;
        await appendCalendarImportAudit(supabase, {
          integrationId,
          tenantId,
          syncRunId: syncRunRow.id,
          action: "event_duplicate",
          actorAuthUserId: auth.actorAuthUserId,
          actorFiUserId: auth.fiUserId,
          actorLabel: auth.actorLabel,
          detail: { google_event_id: event.googleEventId, event_title: event.eventTitle },
        });
        continue;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("fi_external_calendar_event_staging")
        .insert({
          integration_id: integrationId,
          tenant_id: tenantId,
          sync_run_id: syncRunRow.id,
          google_event_id: event.googleEventId,
          calendar_id: event.calendarId,
          event_title: event.eventTitle,
          start_at: event.startAt,
          end_at: event.endAt,
          attendee_emails: [...event.attendeeEmails],
          raw_payload: event.rawPayload,
          normalized_event_type: event.normalizedEventType,
          import_status: "staged",
        })
        .select("id")
        .single();

      if (insertErr) {
        if (insertErr.code === "23505") {
          eventsSkipped += 1;
          continue;
        }
        throw new Error(insertErr.message);
      }

      const stagingId = String((inserted as { id: string }).id);
      eventsStaged += 1;

      await supabase.from("fi_external_calendar_event_mappings").insert({
        integration_id: integrationId,
        tenant_id: tenantId,
        staging_event_id: stagingId,
        google_event_id: event.googleEventId,
        mapping_status: "pending",
        detail: { read_only_staging: true, fi_booking_id: null },
      });

      await appendCalendarImportAudit(supabase, {
        integrationId,
        tenantId,
        stagingEventId: stagingId,
        syncRunId: syncRunRow.id,
        action: "event_staged",
        actorAuthUserId: auth.actorAuthUserId,
        actorFiUserId: auth.fiUserId,
        actorLabel: auth.actorLabel,
        detail: {
          google_event_id: event.googleEventId,
          normalized_event_type: event.normalizedEventType,
        },
      });

      existingStaging.push({
        id: stagingId,
        integrationId,
        tenantId,
        syncRunId: syncRunRow.id,
        googleEventId: event.googleEventId,
        calendarId: event.calendarId,
        eventTitle: event.eventTitle,
        startAt: event.startAt,
        endAt: event.endAt,
        attendeeEmails: event.attendeeEmails,
        rawPayload: event.rawPayload,
        normalizedEventType: event.normalizedEventType,
        importStatus: "staged",
        importedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      dedupContext.push({
        googleEventId: event.googleEventId,
        eventTitle: event.eventTitle,
        startAt: event.startAt,
        importStatus: "staged",
      });
    }

    if (
      eventsStaged === 0 &&
      discoveredEvents.length > 0 &&
      eventsSkipped >= discoveredEvents.length
    ) {
      syncStatus = "partial";
    }
  } catch (e) {
    syncStatus = "failed";
    syncError = e instanceof Error ? e.message : "Google Calendar sync failed.";
  }

  const stagingForHealth = await loadExistingStagingForDedup(supabase, integrationId);
  const health = calculateCalendarSyncHealth({
    latestSyncRun: {
      ...mapSyncRunRow(syncRunRow),
      status: syncStatus,
      eventsDiscovered: discoveredEvents.length,
      eventsStaged,
      eventsSkipped,
    },
    recentSyncRuns: [],
    stagingEvents: stagingForHealth,
    authVerified: true,
  });

  const completedAt = new Date().toISOString();
  const { data: updatedRun, error: updateErr } = await supabase
    .from("fi_external_calendar_sync_runs")
    .update({
      status: syncStatus,
      events_discovered: discoveredEvents.length,
      events_staged: eventsStaged,
      events_skipped: eventsSkipped,
      health_score: health.healthScore,
      completed_at: completedAt,
      detail: {
        calendar_id: calendarId,
        read_only: true,
        error: syncError,
        warnings: health.warnings,
      },
    })
    .eq("id", syncRunRow.id)
    .select("*")
    .single();

  if (updateErr || !updatedRun) {
    return { ok: false, error: updateErr?.message ?? "Failed to finalize sync run." };
  }

  await appendCalendarImportAudit(supabase, {
    integrationId,
    tenantId,
    syncRunId: syncRunRow.id,
    action: syncStatus === "failed" ? "sync_failed" : "sync_completed",
    actorAuthUserId: auth.actorAuthUserId,
    actorFiUserId: auth.fiUserId,
    actorLabel: auth.actorLabel,
    detail: {
      events_discovered: discoveredEvents.length,
      events_staged: eventsStaged,
      events_skipped: eventsSkipped,
      error: syncError,
    },
  });

  await supabase.from("fi_external_sync_status").upsert(
    {
      integration_id: integrationId,
      tenant_id: tenantId,
      status: syncStatus === "failed" ? "failed" : syncStatus === "partial" ? "partial" : "success",
      health_score: health.healthScore,
      last_sync_at: completedAt,
      last_success_at: syncStatus === "failed" ? null : completedAt,
      last_error: syncError,
      records_synced: eventsStaged,
      records_failed: syncStatus === "failed" ? discoveredEvents.length : eventsSkipped,
      detail: { provider: "google_calendar", read_only: true },
      updated_at: completedAt,
    },
    { onConflict: "integration_id" }
  );

  await createConnectorSyncEvent(
    integrationId,
    tenantId,
    {
      eventKind: syncStatus === "failed" ? "sync_failed" : "sync_completed",
      status: syncStatus === "failed" ? "error" : "success",
      detail: {
        events_discovered: discoveredEvents.length,
        events_staged: eventsStaged,
        events_skipped: eventsSkipped,
        read_only: true,
      },
      actorAuthUserId: auth.actorAuthUserId,
      actorFiUserId: auth.fiUserId,
      actorLabel: auth.actorLabel,
    },
    { ...opts, skipAuthCheck: true }
  );

  logStructured(syncStatus === "failed" ? "warn" : "info", "google_calendar_sync_completed", {
    tenant_id: tenantId,
    integration_id: integrationId,
    status: syncStatus,
    events_staged: eventsStaged,
  });

  if (syncStatus === "failed") {
    return { ok: false, error: syncError ?? "Google Calendar sync failed." };
  }

  const snapshot = await buildConnectorSnapshot(supabase, integrationId, tenantId);
  return {
    ok: true,
    syncRun: mapSyncRunRow(updatedRun as SyncRunRow),
    snapshot,
  };
}

/** Load staged external calendar events for review. */
export async function loadExternalCalendarStagingEvents(
  integrationId: string,
  tenantId: string,
  opts: ServerOpts & { importStatus?: string | null } = {}
): Promise<{ ok: true; events: ExternalCalendarStagingEvent[] } | { ok: false; error: string }> {
  const read = await resolveReadAuth(tenantId, opts);
  if (!read.ok) return read;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  let query = supabase
    .from("fi_external_calendar_event_staging")
    .select("*")
    .eq("integration_id", integrationId)
    .eq("tenant_id", tenantId)
    .order("start_at", { ascending: true, nullsFirst: false });

  if (opts.importStatus) {
    query = query.eq("import_status", opts.importStatus);
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };

  return { ok: true, events: ((data ?? []) as StagingRow[]).map(mapStagingRow) };
}

async function reviewStagingEvent(
  stagingEventId: string,
  integrationId: string,
  tenantId: string,
  action: "approve" | "reject",
  opts: ServerOpts
): Promise<{ ok: true; event: ExternalCalendarStagingEvent } | { ok: false; error: string }> {
  const auth = await resolveWriteAuth(tenantId, opts);
  if (!auth.ok) return auth;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data: existing, error: loadErr } = await supabase
    .from("fi_external_calendar_event_staging")
    .select("*")
    .eq("id", stagingEventId)
    .eq("integration_id", integrationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (loadErr || !existing) return { ok: false, error: "Staged event not found." };

  const row = existing as StagingRow;
  const nextStatus = resolveCalendarImportStatus(row.import_status, action);
  if (!nextStatus) {
    return {
      ok: false,
      error: "Event is not eligible for review — only staged events can be approved or rejected.",
    };
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabase
    .from("fi_external_calendar_event_staging")
    .update({
      import_status: nextStatus,
      imported_at: action === "approve" ? now : null,
      updated_at: now,
    })
    .eq("id", stagingEventId)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return { ok: false, error: updateErr?.message ?? "Failed to update staged event." };
  }

  await supabase
    .from("fi_external_calendar_event_mappings")
    .update({
      mapping_status: nextStatus === "approved" ? "approved" : "rejected",
      updated_at: now,
      detail: { reviewed_at: now, fi_booking_id: null, automatic_import: false },
    })
    .eq("staging_event_id", stagingEventId);

  await appendCalendarImportAudit(supabase, {
    integrationId,
    tenantId,
    stagingEventId,
    action: action === "approve" ? "event_approved" : "event_rejected",
    actorAuthUserId: auth.actorAuthUserId,
    actorFiUserId: auth.fiUserId,
    actorLabel: auth.actorLabel,
    detail: {
      google_event_id: row.google_event_id,
      event_title: row.event_title,
      normalized_event_type: row.normalized_event_type,
      no_fi_booking_created: true,
    },
  });

  return { ok: true, event: mapStagingRow(updated as StagingRow) };
}

/** Approve a staged external calendar event (staging only — no FI booking creation). */
export async function approveExternalCalendarEvent(
  stagingEventId: string,
  integrationId: string,
  tenantId: string,
  opts: ServerOpts = {}
): Promise<{ ok: true; event: ExternalCalendarStagingEvent } | { ok: false; error: string }> {
  return reviewStagingEvent(stagingEventId, integrationId, tenantId, "approve", opts);
}

/** Reject a staged external calendar event. */
export async function rejectExternalCalendarEvent(
  stagingEventId: string,
  integrationId: string,
  tenantId: string,
  opts: ServerOpts = {}
): Promise<{ ok: true; event: ExternalCalendarStagingEvent } | { ok: false; error: string }> {
  return reviewStagingEvent(stagingEventId, integrationId, tenantId, "reject", opts);
}

/** Load sync runs for a Google Calendar integration. */
export async function loadCalendarSyncRuns(
  integrationId: string,
  tenantId: string,
  opts: ServerOpts & { limit?: number } = {}
): Promise<{ ok: true; runs: ExternalCalendarSyncRun[] } | { ok: false; error: string }> {
  const read = await resolveReadAuth(tenantId, opts);
  if (!read.ok) return read;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const limit = opts.limit ?? 10;

  const { data, error } = await supabase
    .from("fi_external_calendar_sync_runs")
    .select("*")
    .eq("integration_id", integrationId)
    .eq("tenant_id", tenantId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) return { ok: false, error: error.message };
  return { ok: true, runs: ((data ?? []) as SyncRunRow[]).map(mapSyncRunRow) };
}

async function buildConnectorSnapshot(
  supabase: SupabaseClient,
  integrationId: string,
  tenantId: string
): Promise<GoogleCalendarConnectorSnapshot> {
  const authVerified = await loadAuthVerified(supabase, integrationId);

  const { data: stagingRows } = await supabase
    .from("fi_external_calendar_event_staging")
    .select("*")
    .eq("integration_id", integrationId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);

  const stagingQueue = ((stagingRows ?? []) as StagingRow[]).map(mapStagingRow);

  const { data: runRows } = await supabase
    .from("fi_external_calendar_sync_runs")
    .select("*")
    .eq("integration_id", integrationId)
    .eq("tenant_id", tenantId)
    .order("started_at", { ascending: false })
    .limit(10);

  const recentSyncRuns = ((runRows ?? []) as SyncRunRow[]).map(mapSyncRunRow);
  const latestSyncRun = recentSyncRuns[0] ?? null;

  const syncHealth = calculateCalendarSyncHealth({
    latestSyncRun,
    recentSyncRuns,
    stagingEvents: stagingQueue,
    authVerified,
  });

  return {
    tenantId,
    integrationId,
    syncHealth,
    latestSyncRun,
    recentSyncRuns,
    stagingQueue,
    calculatedAt: new Date().toISOString(),
  };
}

/** Load full Google Calendar connector snapshot for UI. */
export async function loadGoogleCalendarConnectorSnapshot(
  integrationId: string,
  tenantId: string,
  opts: ServerOpts = {}
): Promise<{ ok: true; snapshot: GoogleCalendarConnectorSnapshot } | { ok: false; error: string }> {
  const read = await resolveReadAuth(tenantId, { ...opts, allowTenantMemberRead: true });
  if (!read.ok) return read;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const integration = await loadIntegration(supabase, integrationId, tenantId);
  if (!integration) return { ok: false, error: "Connector not found." };
  if (integration.provider !== "google_calendar") {
    return { ok: false, error: "Integration is not a Google Calendar connector." };
  }

  const snapshot = await buildConnectorSnapshot(supabase, integrationId, tenantId);
  return { ok: true, snapshot };
}
