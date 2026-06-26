import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { NormalizedCalendarEvent } from "@/src/lib/calendar/providers/calendarProviderAdapter";
import {
  deriveCalendarEventOwnershipSource,
  isRiskyGoogleChangeForFiOwnedEvent,
  type CalendarEventOwnershipSource,
} from "@/src/lib/calendar/providers/calendarProviderAdapter";
import {
  buildGoogleSyncUpdateMetadata,
  isGoogleEventCancelled,
} from "@/src/lib/googleCalendar/googleCalendarCore";
import { stageGoogleCalendarSyncReviewIfConflict, emptyReviewSyncCounters } from "@/src/lib/googleCalendar/googleCalendarSyncReview.server";
import type { FiCalendarEvent } from "@/src/lib/googleCalendar/googleCalendarTypes";

import { createGoogleCalendarWebhookAlertIfNeeded } from "./googleCalendarWebhookAlerts.server";
import {
  shouldProcessEventVersion,
  upsertCalendarEventVersion,
  type EventVersionRow,
} from "./googleCalendarEventVersions.server";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
};

export type ReconcileGoogleCalendarEventChangeInput = {
  tenantId: string;
  integrationId: string;
  googleCalendarId: string;
  googleEvent: NormalizedCalendarEvent;
  localEvent: FiCalendarEvent | null;
  existingVersion?: EventVersionRow | null;
};

export type ReconcileDecision =
  | "updated_allowed_fields"
  | "staged_review"
  | "skipped_no_change"
  | "skipped_duplicate_version"
  | "mirrored_google_owned"
  | "staged_cancelled_unmatched";

export type ReconcileGoogleCalendarEventChangeResult = {
  decision: ReconcileDecision;
  reviewItemCreated?: boolean;
  versionStatus: "synced" | "pending_local" | "pending_external" | "conflict";
};

async function logReconciliationDecision(
  input: ReconcileGoogleCalendarEventChangeInput,
  decision: ReconcileDecision,
  ownershipSource: CalendarEventOwnershipSource,
  opts: ServerOpts,
  extra?: Record<string, unknown>
): Promise<void> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const now = new Date().toISOString();

  await supabase.from("fi_calendar_reconciliation_logs").insert({
    tenant_id: input.tenantId.trim(),
    integration_id: input.integrationId,
    provider: "google",
    google_calendar_id: input.googleCalendarId,
    external_event_id: input.googleEvent.externalEventId,
    local_event_id: input.localEvent?.id ?? null,
    decision,
    conflict_type: extra?.conflictType ?? null,
    ownership_source: ownershipSource,
    external_etag: input.googleEvent.etag,
    metadata: {
      externalUpdatedAt: input.googleEvent.updatedAt,
      ...(extra ?? {}),
    },
    created_at: now,
  });

  if (decision === "staged_review" || extra?.conflictType === "update_conflict") {
    await createGoogleCalendarWebhookAlertIfNeeded(
      {
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        eventType: "calendar_reconciliation_conflict",
        title: "Google Calendar reconciliation conflict",
        message: `Event ${input.googleEvent.externalEventId} requires admin review.`,
        idempotencyKey: `gcal-reconcile-conflict:${input.tenantId}:${input.googleEvent.externalEventId}:${input.googleEvent.etag ?? "none"}`,
        metadata: { decision, externalEventId: input.googleEvent.externalEventId },
      },
      opts
    );
  }
}

/** Reconcile a single Google Calendar event change with ownership-aware rules. */
export async function reconcileGoogleCalendarEventChange(
  input: ReconcileGoogleCalendarEventChangeInput,
  opts: ServerOpts = {}
): Promise<ReconcileGoogleCalendarEventChangeResult> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { tenantId, integrationId, googleCalendarId, googleEvent, localEvent } = input;
  const extId = googleEvent.externalEventId.trim();
  const ownership = localEvent
    ? deriveCalendarEventOwnershipSource(localEvent)
    : ("google_external" as CalendarEventOwnershipSource);

  if (
    input.existingVersion &&
    !shouldProcessEventVersion(input.existingVersion, googleEvent.etag, googleEvent.updatedAt)
  ) {
    await logReconciliationDecision(input, "skipped_duplicate_version", ownership, opts);
    return { decision: "skipped_duplicate_version", versionStatus: "synced" };
  }

  if (isGoogleEventCancelled(googleEvent.raw)) {
    if (!localEvent) {
      const staged = await stageGoogleCalendarSyncReviewIfConflict(
        {
          tenantId,
          integrationId,
          googleCalendarId,
          googleCalendarSummary: null,
          googleEvent: googleEvent.raw,
          accessRole: null,
          existingByExternalId: null,
          localEvents: [],
          counters: emptyReviewSyncCounters(),
        },
        opts
      );
      await logReconciliationDecision(input, "staged_cancelled_unmatched", ownership, opts, {
        conflictType: "cancelled_unmatched",
      });
      await upsertCalendarEventVersion(
        {
          tenantId,
          googleCalendarId,
          externalEventId: extId,
          localEventId: null,
          externalEtag: googleEvent.etag,
          externalUpdatedAt: googleEvent.updatedAt,
          ownershipSource: ownership,
          versionStatus: "conflict",
        },
        opts
      );
      return {
        decision: "staged_cancelled_unmatched",
        reviewItemCreated: staged,
        versionStatus: "conflict",
      };
    }

    if (ownership === "fi_system") {
      const staged = await stageGoogleCalendarSyncReviewIfConflict(
        {
          tenantId,
          integrationId,
          googleCalendarId,
          googleCalendarSummary: null,
          googleEvent: googleEvent.raw,
          accessRole: null,
          existingByExternalId: localEvent,
          localEvents: [localEvent],
          counters: emptyReviewSyncCounters(),
        },
        opts
      );
      await logReconciliationDecision(input, "staged_review", ownership, opts, {
        conflictType: "cancelled_unmatched",
      });
      await upsertCalendarEventVersion(
        {
          tenantId,
          googleCalendarId,
          externalEventId: extId,
          localEventId: localEvent.id,
          externalEtag: googleEvent.etag,
          externalUpdatedAt: googleEvent.updatedAt,
          localUpdatedAt: localEvent.updatedAt,
          ownershipSource: ownership,
          versionStatus: "conflict",
        },
        opts
      );
      return {
        decision: "staged_review",
        reviewItemCreated: staged,
        versionStatus: "conflict",
      };
    }
  }

  if (localEvent && ownership === "fi_system") {
    if (isRiskyGoogleChangeForFiOwnedEvent(localEvent, googleEvent)) {
      const staged = await stageGoogleCalendarSyncReviewIfConflict(
        {
          tenantId,
          integrationId,
          googleCalendarId,
          googleCalendarSummary: null,
          googleEvent: googleEvent.raw,
          accessRole: null,
          existingByExternalId: localEvent,
          localEvents: [localEvent],
          counters: emptyReviewSyncCounters(),
        },
        opts
      );
      await logReconciliationDecision(input, "staged_review", ownership, opts, {
        conflictType: "update_conflict",
      });
      await upsertCalendarEventVersion(
        {
          tenantId,
          googleCalendarId,
          externalEventId: extId,
          localEventId: localEvent.id,
          externalEtag: googleEvent.etag,
          externalUpdatedAt: googleEvent.updatedAt,
          localUpdatedAt: localEvent.updatedAt,
          ownershipSource: ownership,
          versionStatus: "conflict",
        },
        opts
      );
      return {
        decision: "staged_review",
        reviewItemCreated: staged,
        versionStatus: "conflict",
      };
    }

    const syncNow = new Date().toISOString();
    await supabase
      .from("fi_calendar_events")
      .update({
        location: googleEvent.location,
        google_meet_url: googleEvent.googleMeetUrl ?? localEvent.googleMeetUrl,
        metadata: buildGoogleSyncUpdateMetadata(localEvent.metadata ?? {}, syncNow, {
          calendarId: googleCalendarId,
          summary: null,
        }),
        updated_at: syncNow,
      })
      .eq("id", localEvent.id)
      .eq("tenant_id", tenantId);

    await upsertCalendarEventVersion(
      {
        tenantId,
        googleCalendarId,
        externalEventId: extId,
        localEventId: localEvent.id,
        externalEtag: googleEvent.etag,
        externalUpdatedAt: googleEvent.updatedAt,
        localUpdatedAt: syncNow,
        ownershipSource: ownership,
        versionStatus: "synced",
      },
      opts
    );
    await logReconciliationDecision(input, "updated_allowed_fields", ownership, opts);
    return { decision: "updated_allowed_fields", versionStatus: "synced" };
  }

  if (localEvent && (ownership === "google_external" || ownership === "imported_external")) {
    const syncNow = new Date().toISOString();
    await supabase
      .from("fi_calendar_events")
      .update({
        title: googleEvent.title,
        description: googleEvent.description,
        location: googleEvent.location,
        start_time: googleEvent.startTime,
        end_time: googleEvent.endTime,
        google_meet_url: googleEvent.googleMeetUrl ?? localEvent.googleMeetUrl,
        metadata: buildGoogleSyncUpdateMetadata(localEvent.metadata ?? {}, syncNow, {
          calendarId: googleCalendarId,
          summary: null,
        }),
        updated_at: syncNow,
      })
      .eq("id", localEvent.id)
      .eq("tenant_id", tenantId);

    await upsertCalendarEventVersion(
      {
        tenantId,
        googleCalendarId,
        externalEventId: extId,
        localEventId: localEvent.id,
        externalEtag: googleEvent.etag,
        externalUpdatedAt: googleEvent.updatedAt,
        localUpdatedAt: syncNow,
        ownershipSource: ownership,
        versionStatus: "synced",
      },
      opts
    );
    await logReconciliationDecision(input, "mirrored_google_owned", ownership, opts);
    return { decision: "mirrored_google_owned", versionStatus: "synced" };
  }

  await logReconciliationDecision(input, "skipped_no_change", ownership, opts);
  return { decision: "skipped_no_change", versionStatus: "synced" };
}
