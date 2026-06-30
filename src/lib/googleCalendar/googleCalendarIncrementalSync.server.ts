import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logStructured } from "@/src/lib/server/structuredLog";
import { createGoogleCalendarProviderAdapter } from "@/src/lib/calendar/providers/googleCalendarProviderAdapter.server";

import {
  beginGoogleCalendarSyncRun,
  updateGoogleCalendarSyncHealth,
} from "./googleCalendarSyncHealth.server";
import { syncGoogleCalendarForTenant } from "./googleCalendarSync.server";
import type { FiCalendarEvent } from "./googleCalendarTypes";
import type { EventVersionRow } from "./googleCalendarEventVersions.server";
import { reconcileGoogleCalendarEventChange } from "./googleCalendarReconciliation.server";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  fetchOverride?: typeof fetch;
};

export type IncrementalWebhookSyncInput = {
  tenantId: string;
  integrationId: string;
  googleCalendarId: string;
  syncToken: string | null;
  subscriptionId: string;
};

export type IncrementalWebhookSyncResult =
  | { ok: true; nextSyncToken?: string; eventsProcessed: number; usedFullFallback: boolean }
  | { ok: false; error: string };

function mapLocalEventRow(row: Record<string, unknown>, tenantId: string): FiCalendarEvent {
  return {
    id: String(row.id),
    tenantId,
    externalEventId: (row.external_event_id as string | null) ?? null,
    provider: "google",
    calendarId: String(row.calendar_id),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    startTime: (row.start_time as string | null) ?? null,
    endTime: (row.end_time as string | null) ?? null,
    eventType: (row.event_type as string | null) ?? null,
    googleMeetUrl: (row.google_meet_url as string | null) ?? null,
    patientId: (row.patient_id as string | null) ?? null,
    leadId: (row.lead_id as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** Incremental sync triggered by webhook; falls back to full sync when sync token is invalid. */
export async function syncGoogleCalendarIncrementalForWebhook(
  input: IncrementalWebhookSyncInput,
  opts: ServerOpts = {}
): Promise<IncrementalWebhookSyncResult> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const adapter = createGoogleCalendarProviderAdapter(opts);
  const startedAt = new Date().toISOString();
  const { runId } = await beginGoogleCalendarSyncRun(
    {
      tenantId: input.tenantId,
      integrationId: input.integrationId,
      source: "webhook",
    },
    opts
  );

  if (!input.syncToken) {
    const full = await syncGoogleCalendarForTenant(
      { tenantId: input.tenantId, source: "webhook" },
      opts
    );
    if (full.outcome !== "synced") {
      await updateGoogleCalendarSyncHealth(
        {
          tenantId: input.tenantId,
          integrationId: input.integrationId,
          runId,
          startedAt,
          ok: false,
          error: full.error ?? "Full sync fallback failed.",
        },
        opts
      );
      return { ok: false, error: full.error ?? "Full sync fallback failed." };
    }

    const listResult = await adapter.listEvents({
      tenantId: input.tenantId,
      calendarId: input.googleCalendarId,
      timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      timeMax: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    });

    await updateGoogleCalendarSyncHealth(
      {
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        runId,
        startedAt,
        ok: true,
        result: full.result,
      },
      opts
    );

    return {
      ok: true,
      nextSyncToken: listResult.ok ? listResult.result.nextSyncToken : undefined,
      eventsProcessed: full.result?.eventsFetchedTotal ?? 0,
      usedFullFallback: true,
    };
  }

  const listResult = await adapter.listEvents({
    tenantId: input.tenantId,
    calendarId: input.googleCalendarId,
    syncToken: input.syncToken,
  });

  if (!listResult.ok) {
    if (listResult.syncTokenInvalid) {
      logStructured("warn", "google_calendar_webhook_sync_token_invalid", {
        tenantId: input.tenantId,
        subscriptionId: input.subscriptionId,
      });

      await supabase
        .from("fi_calendar_webhook_subscriptions")
        .update({ sync_token: null, updated_at: new Date().toISOString() })
        .eq("id", input.subscriptionId);

      return syncGoogleCalendarIncrementalForWebhook({ ...input, syncToken: null }, opts);
    }

    await updateGoogleCalendarSyncHealth(
      {
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        runId,
        startedAt,
        ok: false,
        error: listResult.error,
      },
      opts
    );
    return { ok: false, error: listResult.error };
  }

  let eventsProcessed = 0;
  for (const event of listResult.result.events) {
    if (!event.externalEventId) continue;

    const { data: localRow } = await supabase
      .from("fi_calendar_events")
      .select("*")
      .eq("tenant_id", input.tenantId.trim())
      .eq("external_event_id", event.externalEventId)
      .maybeSingle();

    const localEvent = localRow
      ? mapLocalEventRow(localRow as Record<string, unknown>, input.tenantId)
      : null;

    const { data: versionRow } = await supabase
      .from("fi_calendar_event_versions")
      .select("*")
      .eq("tenant_id", input.tenantId.trim())
      .eq("provider", "google")
      .eq("google_calendar_id", input.googleCalendarId)
      .eq("external_event_id", event.externalEventId)
      .maybeSingle();

    await reconcileGoogleCalendarEventChange(
      {
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        googleCalendarId: input.googleCalendarId,
        googleEvent: event,
        localEvent,
        existingVersion: (versionRow as EventVersionRow | null) ?? null,
      },
      opts
    );
    eventsProcessed += 1;
  }

  await updateGoogleCalendarSyncHealth(
    {
      tenantId: input.tenantId,
      integrationId: input.integrationId,
      runId,
      startedAt,
      ok: true,
      result: {
        discovered: eventsProcessed,
        created: 0,
        updated: eventsProcessed,
        skipped: 0,
        deleted: 0,
        calendarsScanned: 1,
        eventsFetchedTotal: eventsProcessed,
      },
    },
    opts
  );

  return {
    ok: true,
    nextSyncToken: listResult.result.nextSyncToken,
    eventsProcessed,
    usedFullFallback: false,
  };
}
