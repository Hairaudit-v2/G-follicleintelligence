import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logStructured } from "@/src/lib/server/structuredLog";
import type { GoogleCalendarApiEvent } from "@/src/lib/onboarding-os/googleCalendarConnectorTypes";

import { buildGoogleSyncInsertMetadata } from "./googleCalendarCore";
import {
  buildGoogleCalendarSyncReviewRowPayload,
  detectGoogleCalendarSyncConflict,
  emptyReviewSyncCounters,
  incrementReviewCounter,
  reviewItemRowToClient,
  type DetectGoogleCalendarSyncConflictInput,
  type GoogleCalendarSyncConflictDetection,
  type GoogleCalendarSyncReviewClientItem,
  type GoogleCalendarSyncReviewCounters,
  type GoogleCalendarSyncReviewPageModel,
  type GoogleCalendarSyncReviewUpsertInput,
  type ReviewItemDbRow,
} from "./googleCalendarSyncReviewCore";
import type { FiCalendarEvent } from "./googleCalendarTypes";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
};

const REVIEW_SELECT =
  "id, tenant_id, integration_id, provider, google_calendar_id, google_calendar_summary, external_event_id, event_summary, event_start_at, event_end_at, event_location, event_description, event_status, raw_event, mapped_fields, matched_local_event_id, matched_local_event_type, conflict_type, conflict_reason, severity, status, resolution, resolved_by, resolved_at, metadata, created_at, updated_at";

async function resolveFiUserId(
  supabase: SupabaseClient,
  tenantId: string,
  actorAuthUserId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", actorAuthUserId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id: string } | null)?.id ?? null;
}

/** Upsert a review queue row for an ambiguous inbound Google event (idempotent per conflict type). */
export async function upsertGoogleCalendarSyncReviewItem(
  input: GoogleCalendarSyncReviewUpsertInput,
  opts: ServerOpts = {}
): Promise<{ ok: true; created: boolean; item: GoogleCalendarSyncReviewClientItem } | { ok: false; error: string }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const now = new Date().toISOString();
  const payload = buildGoogleCalendarSyncReviewRowPayload(input, now);

  const { data: existing, error: loadError } = await supabase
    .from("fi_calendar_sync_review_items")
    .select("id, status")
    .eq("tenant_id", input.tenantId.trim())
    .eq("provider", "google")
    .eq("google_calendar_id", input.googleCalendarId ?? "")
    .eq("external_event_id", input.externalEventId.trim())
    .eq("conflict_type", input.detection.conflictType)
    .maybeSingle();

  if (loadError) return { ok: false, error: loadError.message };

  if (existing) {
    const existingRow = existing as { id: string; status: string };
    const terminal = ["linked", "imported", "dismissed", "ignored"].includes(existingRow.status);
    if (terminal) {
      const { data: row, error } = await supabase
        .from("fi_calendar_sync_review_items")
        .select(REVIEW_SELECT)
        .eq("id", existingRow.id)
        .single();
      if (error || !row) return { ok: false, error: error?.message ?? "Review item not found." };
      return { ok: true, created: false, item: reviewItemRowToClient(row as ReviewItemDbRow) };
    }

    const { data: updated, error: updateError } = await supabase
      .from("fi_calendar_sync_review_items")
      .update({
        ...payload,
        status: existingRow.status === "failed" ? "open" : existingRow.status,
      })
      .eq("id", existingRow.id)
      .select(REVIEW_SELECT)
      .single();

    if (updateError || !updated) {
      return { ok: false, error: updateError?.message ?? "Failed to update review item." };
    }

    logStructured("info", "google_calendar_sync_review_item_updated", {
      tenantId: input.tenantId,
      integrationId: input.integrationId,
      reviewItemId: existingRow.id,
      externalEventId: input.externalEventId,
      conflictType: input.detection.conflictType,
    });

    return { ok: true, created: false, item: reviewItemRowToClient(updated as ReviewItemDbRow) };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("fi_calendar_sync_review_items")
    .insert({ ...payload, created_at: now })
    .select(REVIEW_SELECT)
    .single();

  if (insertError || !inserted) {
    return { ok: false, error: insertError?.message ?? "Failed to create review item." };
  }

  logStructured("info", "google_calendar_sync_review_item_created", {
    tenantId: input.tenantId,
    integrationId: input.integrationId,
    reviewItemId: (inserted as ReviewItemDbRow).id,
    externalEventId: input.externalEventId,
    conflictType: input.detection.conflictType,
  });

  return { ok: true, created: true, item: reviewItemRowToClient(inserted as ReviewItemDbRow) };
}

export async function listGoogleCalendarSyncReviewItemsForTenant(
  tenantId: string,
  opts: ServerOpts & { status?: string; limit?: number } = {}
): Promise<GoogleCalendarSyncReviewClientItem[]> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const limit = opts.limit ?? 100;

  let query = supabase
    .from("fi_calendar_sync_review_items")
    .select(REVIEW_SELECT)
    .eq("tenant_id", tenantId.trim())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts.status?.trim()) {
    query = query.eq("status", opts.status.trim());
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as ReviewItemDbRow[]).map(reviewItemRowToClient);
}

export async function countOpenGoogleCalendarSyncReviewItems(
  tenantId: string,
  opts: ServerOpts = {}
): Promise<number> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { count, error } = await supabase
    .from("fi_calendar_sync_review_items")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId.trim())
    .eq("status", "open");

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function loadGoogleCalendarSyncReviewPage(
  tenantId: string,
  opts: ServerOpts & { canManage?: boolean; connected?: boolean; integrationId?: string | null } = {}
): Promise<GoogleCalendarSyncReviewPageModel> {
  const tid = tenantId.trim();
  const openCount = opts.connected === false ? 0 : await countOpenGoogleCalendarSyncReviewItems(tid, opts);
  const items =
    opts.connected === false
      ? []
      : await listGoogleCalendarSyncReviewItemsForTenant(tid, { ...opts, status: "open", limit: 50 });

  return {
    tenantId: tid,
    canManage: opts.canManage ?? false,
    connected: opts.connected ?? false,
    integrationId: opts.integrationId ?? null,
    openCount,
    items,
  };
}

type ResolveReviewInput = {
  tenantId: string;
  reviewItemId: string;
  actorAuthUserId: string;
  resolution: string;
  status: "dismissed" | "ignored" | "linked" | "imported";
};

async function loadOpenReviewItem(
  supabase: SupabaseClient,
  tenantId: string,
  reviewItemId: string
): Promise<ReviewItemDbRow | null> {
  const { data, error } = await supabase
    .from("fi_calendar_sync_review_items")
    .select(REVIEW_SELECT)
    .eq("id", reviewItemId.trim())
    .eq("tenant_id", tenantId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as ReviewItemDbRow | null;
  if (!row || row.status !== "open") return null;
  return row;
}

/** Resolve a review item with a terminal status (dismiss, ignore, link, import). */
export async function resolveGoogleCalendarSyncReviewItem(
  input: ResolveReviewInput,
  opts: ServerOpts = {}
): Promise<
  | { ok: true; item: GoogleCalendarSyncReviewClientItem; importedEventId?: string }
  | { ok: false; error: string }
> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const tenantId = input.tenantId.trim();
  const reviewItemId = input.reviewItemId.trim();
  const now = new Date().toISOString();

  const row = await loadOpenReviewItem(supabase, tenantId, reviewItemId);
  if (!row) return { ok: false, error: "Open review item not found." };

  const resolvedBy = await resolveFiUserId(supabase, tenantId, input.actorAuthUserId);

  if (input.status === "linked") {
    if (!row.matched_local_event_id) {
      return { ok: false, error: "No suggested local match — link is not available for this item." };
    }

    const { data: local, error: localError } = await supabase
      .from("fi_calendar_events")
      .select("id, metadata")
      .eq("id", row.matched_local_event_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (localError) return { ok: false, error: localError.message };
    if (!local) return { ok: false, error: "Suggested local event no longer exists." };

    const localMeta = ((local as { metadata: Record<string, unknown> }).metadata ?? {}) as Record<
      string,
      unknown
    >;
    const { error: linkError } = await supabase
      .from("fi_calendar_events")
      .update({
        external_event_id: row.external_event_id,
        metadata: {
          ...localMeta,
          google_calendar_id: row.google_calendar_id,
          ...(row.google_calendar_summary
            ? { google_calendar_summary: row.google_calendar_summary }
            : {}),
          linked_from_review_item_id: row.id,
          last_synced_at: now,
        },
        updated_at: now,
      })
      .eq("id", row.matched_local_event_id)
      .eq("tenant_id", tenantId);

    if (linkError) return { ok: false, error: linkError.message };
  }

  let importedEventId: string | undefined;
  if (input.status === "imported") {
    const mapped = row.mapped_fields as {
      title?: string;
      description?: string | null;
      location?: string | null;
      startTime?: string | null;
      endTime?: string | null;
      eventType?: string | null;
      googleMeetUrl?: string | null;
      calendarId?: string;
    };

    if (!mapped.startTime || !mapped.endTime) {
      return { ok: false, error: "Review item is missing start/end times required for import." };
    }

    const calendarId = (mapped.calendarId ?? row.google_calendar_id ?? "").trim();
    if (!calendarId) return { ok: false, error: "Review item is missing a calendar id for import." };

    const { data: inserted, error: insertError } = await supabase
      .from("fi_calendar_events")
      .insert({
        tenant_id: tenantId,
        external_event_id: row.external_event_id,
        provider: "google",
        calendar_id: calendarId,
        title: mapped.title ?? row.event_summary ?? "(Untitled event)",
        description: mapped.description ?? row.event_description,
        location: mapped.location ?? row.event_location,
        start_time: mapped.startTime,
        end_time: mapped.endTime,
        event_type: mapped.eventType ?? null,
        google_meet_url: mapped.googleMeetUrl ?? null,
        metadata: {
          ...buildGoogleSyncInsertMetadata(row.integration_id, now, {
            calendarId,
            summary: row.google_calendar_summary,
          }),
          source: "google_sync_review_import",
          review_item_id: row.id,
        },
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return { ok: false, error: insertError?.message ?? "Failed to import review item." };
    }
    importedEventId = (inserted as { id: string }).id;

    logStructured("info", "google_calendar_sync_review_item_imported", {
      tenantId,
      reviewItemId: row.id,
      importedEventId,
      externalEventId: row.external_event_id,
    });
  }

  const { data: updated, error: updateError } = await supabase
    .from("fi_calendar_sync_review_items")
    .update({
      status: input.status,
      resolution: input.resolution,
      resolved_by: resolvedBy,
      resolved_at: now,
      updated_at: now,
      metadata: {
        ...(row.metadata ?? {}),
        ...(importedEventId ? { imported_event_id: importedEventId } : {}),
      },
    })
    .eq("id", reviewItemId)
    .eq("tenant_id", tenantId)
    .select(REVIEW_SELECT)
    .single();

  if (updateError || !updated) {
    return { ok: false, error: updateError?.message ?? "Failed to resolve review item." };
  }

  const auditEvent =
    input.status === "dismissed"
      ? "google_calendar_sync_review_item_dismissed"
      : input.status === "ignored"
        ? "google_calendar_sync_review_item_dismissed"
        : input.status === "linked"
          ? "google_calendar_sync_review_item_linked"
          : "google_calendar_sync_review_item_resolved";

  logStructured("info", auditEvent, {
    tenantId,
    reviewItemId,
    status: input.status,
    resolution: input.resolution,
    actorAuthUserId: input.actorAuthUserId,
    importedEventId: importedEventId ?? null,
  });

  if (input.status !== "imported" && input.status !== "linked") {
    logStructured("info", "google_calendar_sync_review_item_resolved", {
      tenantId,
      reviewItemId,
      status: input.status,
      resolution: input.resolution,
    });
  }

  return {
    ok: true,
    item: reviewItemRowToClient(updated as ReviewItemDbRow),
    importedEventId,
  };
}

export async function dismissGoogleCalendarSyncReviewItem(
  tenantId: string,
  reviewItemId: string,
  actorAuthUserId: string,
  opts: ServerOpts = {}
) {
  return resolveGoogleCalendarSyncReviewItem(
    {
      tenantId,
      reviewItemId,
      actorAuthUserId,
      status: "dismissed",
      resolution: "dismissed_by_admin",
    },
    opts
  );
}

export async function ignoreGoogleCalendarSyncReviewItem(
  tenantId: string,
  reviewItemId: string,
  actorAuthUserId: string,
  opts: ServerOpts = {}
) {
  return resolveGoogleCalendarSyncReviewItem(
    {
      tenantId,
      reviewItemId,
      actorAuthUserId,
      status: "ignored",
      resolution: "ignored_by_admin",
    },
    opts
  );
}

export async function linkGoogleCalendarSyncReviewItem(
  tenantId: string,
  reviewItemId: string,
  actorAuthUserId: string,
  opts: ServerOpts = {}
) {
  return resolveGoogleCalendarSyncReviewItem(
    {
      tenantId,
      reviewItemId,
      actorAuthUserId,
      status: "linked",
      resolution: "linked_to_existing_local_event",
    },
    opts
  );
}

export async function importGoogleCalendarSyncReviewItem(
  tenantId: string,
  reviewItemId: string,
  actorAuthUserId: string,
  opts: ServerOpts = {}
) {
  return resolveGoogleCalendarSyncReviewItem(
    {
      tenantId,
      reviewItemId,
      actorAuthUserId,
      status: "imported",
      resolution: "imported_as_new_local_event",
    },
    opts
  );
}

export type StageGoogleCalendarSyncReviewInput = {
  tenantId: string;
  integrationId: string;
  googleCalendarId: string;
  googleCalendarSummary: string | null;
  googleEvent: GoogleCalendarApiEvent;
  accessRole?: string | null;
  existingByExternalId?: FiCalendarEvent | null;
  localEvents: ReadonlyArray<FiCalendarEvent>;
  counters: GoogleCalendarSyncReviewCounters;
};

/** Detect conflict and upsert review item; returns true when event was staged. */
export async function stageGoogleCalendarSyncReviewIfConflict(
  input: StageGoogleCalendarSyncReviewInput,
  opts: ServerOpts = {}
): Promise<boolean> {
  const detectInput: DetectGoogleCalendarSyncConflictInput = {
    googleEvent: input.googleEvent,
    calendarId: input.googleCalendarId,
    calendarSummary: input.googleCalendarSummary,
    accessRole: input.accessRole,
    existingByExternalId: input.existingByExternalId,
    localEvents: input.localEvents,
  };

  const detection = detectGoogleCalendarSyncConflict(detectInput);
  if (!detection) return false;

  const extId =
    detection.mappedFields.externalEventId?.trim() ||
    input.googleEvent.id?.trim() ||
    `unknown-${Date.now()}`;

  const upsertResult = await upsertGoogleCalendarSyncReviewItem(
    {
      tenantId: input.tenantId,
      integrationId: input.integrationId,
      googleCalendarId: input.googleCalendarId,
      googleCalendarSummary: input.googleCalendarSummary,
      externalEventId: extId,
      googleEvent: input.googleEvent,
      detection,
    },
    opts
  );

  if (!upsertResult.ok) {
    logStructured("warn", "google_calendar_sync_review_item_failed", {
      tenantId: input.tenantId,
      externalEventId: extId,
      conflictType: detection.conflictType,
      error: upsertResult.error,
    });
    return false;
  }

  incrementReviewCounter(input.counters, detection.conflictType, upsertResult.created);
  return true;
}

export { emptyReviewSyncCounters, type GoogleCalendarSyncReviewCounters };
