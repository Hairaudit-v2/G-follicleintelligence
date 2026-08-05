/**
 * FI-CALENDAR-WRITEBACK-1A — operational write-back for google_linked_fios events.
 *
 * Never reports success until both FiOS mirror and Google are reconciled
 * (or the failure / conflict is explicitly surfaced).
 */
import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  classifyFiCalendarEventOverlapRow,
  type CalendarEventClassification,
} from "@/src/lib/calendar/calendarEventClassification";
import {
  buildCalendarMutationAuditRecord,
  calendarAuditToActivityEntry,
  type CalendarInteractionSource,
  type CalendarWritebackStatus,
} from "@/src/lib/calendar/calendarWritebackAudit";
import { deriveCalendarEventOwnershipSource } from "@/src/lib/calendar/providers/calendarProviderAdapter";
import {
  loadCalendarEventVersion,
  upsertCalendarEventVersion,
} from "@/src/lib/googleCalendar/googleCalendarEventVersions.server";
import { updateGoogleCalendarEvent } from "@/src/lib/googleCalendar/googleCalendarService.server";
import type { FiCalendarEvent } from "@/src/lib/googleCalendar/googleCalendarTypes";
import { logStructured } from "@/src/lib/server/structuredLog";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  fetchOverride?: typeof fetch;
  integrationId?: string;
};

export type CalendarOsWritebackPatch = {
  title?: string;
  description?: string | null;
  location?: string | null;
  startTime?: string;
  endTime?: string;
  eventType?: string | null;
  assignedStaffId?: string | null;
  clinicId?: string | null;
  roomId?: string | null;
  bookingStatus?: string | null;
  notes?: string | null;
};

export type CalendarOsWritebackInput = {
  tenantId: string;
  eventId: string;
  patch: CalendarOsWritebackPatch;
  interactionSource: CalendarInteractionSource;
  actingUserId?: string | null;
  actingUserLabel?: string | null;
  /** When true, require stored etag for If-Match (preferred for production write-back). */
  requireEtagMatch?: boolean;
};

export type CalendarOsWritebackSuccess = {
  ok: true;
  event: FiCalendarEvent;
  classification: CalendarEventClassification;
  writebackStatus: Extract<CalendarWritebackStatus, "synced">;
  googleEtag: string | null;
  auditId: string;
};

export type CalendarOsWritebackFailure = {
  ok: false;
  error: string;
  code:
    | "not_found"
    | "classification_blocked"
    | "etag_required"
    | "concurrent_edit"
    | "google_writeback_failed"
    | "pending_reconciliation";
  writebackStatus: CalendarWritebackStatus;
  googleEventId: string | null;
  auditId: string | null;
};

async function loadEventRow(
  supabase: SupabaseClient,
  tenantId: string,
  eventId: string
): Promise<{
  id: string;
  tenant_id: string;
  external_event_id: string | null;
  calendar_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  event_type: string | null;
  patient_id: string | null;
  lead_id: string | null;
  metadata: Record<string, unknown>;
} | null> {
  const { data, error } = await supabase
    .from("fi_calendar_events")
    .select(
      "id, tenant_id, external_event_id, calendar_id, title, description, location, start_time, end_time, event_type, patient_id, lead_id, metadata"
    )
    .eq("id", eventId.trim())
    .eq("tenant_id", tenantId.trim())
    .maybeSingle();
  if (error || !data) return null;
  return data as {
    id: string;
    tenant_id: string;
    external_event_id: string | null;
    calendar_id: string;
    title: string;
    description: string | null;
    location: string | null;
    start_time: string | null;
    end_time: string | null;
    event_type: string | null;
    patient_id: string | null;
    lead_id: string | null;
    metadata: Record<string, unknown>;
  };
}

async function appendMutationActivity(
  supabase: SupabaseClient,
  tenantId: string,
  eventId: string,
  entry: Record<string, unknown>
): Promise<void> {
  const { data: existing } = await supabase
    .from("fi_calendar_events")
    .select("metadata")
    .eq("id", eventId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!existing) return;
  const metadata = (existing.metadata ?? {}) as Record<string, unknown>;
  const activityRaw = metadata.appointment_activity;
  const activity = Array.isArray(activityRaw) ? [...activityRaw] : [];
  activity.push(entry);
  await supabase
    .from("fi_calendar_events")
    .update({
      metadata: { ...metadata, appointment_activity: activity },
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .eq("tenant_id", tenantId);
}

async function markPendingLocal(
  supabase: SupabaseClient,
  tenantId: string,
  eventId: string,
  metaPatch: Record<string, unknown>
): Promise<void> {
  const { data: existing } = await supabase
    .from("fi_calendar_events")
    .select("metadata")
    .eq("id", eventId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!existing) return;
  const metadata = (existing.metadata ?? {}) as Record<string, unknown>;
  await supabase
    .from("fi_calendar_events")
    .update({
      metadata: {
        ...metadata,
        ...metaPatch,
        writeback_status: "pending",
        sync_status: "pending_local",
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .eq("tenant_id", tenantId);
}

/**
 * Apply a Quick Edit / drag patch to a google_linked_fios CalendarOS event
 * with Google write-back + etag concurrency + audit.
 */
export async function writebackCalendarOsEvent(
  input: CalendarOsWritebackInput,
  opts: ServerOpts = {}
): Promise<CalendarOsWritebackSuccess | CalendarOsWritebackFailure> {
  const tenantId = input.tenantId.trim();
  const eventId = input.eventId.trim();
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const auditId = randomUUID();

  const local = await loadEventRow(supabase, tenantId, eventId);
  if (!local) {
    return {
      ok: false,
      error: "Calendar event not found.",
      code: "not_found",
      writebackStatus: "failed",
      googleEventId: null,
      auditId: null,
    };
  }

  const classification = classifyFiCalendarEventOverlapRow(local);
  const googleEventId = local.external_event_id?.trim() || null;

  if (classification !== "google_linked_fios") {
    const audit = buildCalendarMutationAuditRecord({
      id: auditId,
      tenantId,
      actingUserId: input.actingUserId,
      actingUserLabel: input.actingUserLabel,
      interactionSource: input.interactionSource,
      classification,
      googleEventId,
      localCalendarEventId: local.id,
      previousValues: {},
      nextValues: {},
      writebackStatus: "not_required",
      failureDetails: `Write-back blocked for classification ${classification}`,
    });
    await appendMutationActivity(supabase, tenantId, local.id, calendarAuditToActivityEntry(audit));
    return {
      ok: false,
      error: `Event classification "${classification}" does not support Google write-back.`,
      code: "classification_blocked",
      writebackStatus: "not_required",
      googleEventId,
      auditId,
    };
  }

  const previousValues: Record<string, unknown> = {
    title: local.title,
    description: local.description,
    location: local.location,
    start_time: local.start_time,
    end_time: local.end_time,
    event_type: local.event_type,
  };

  const nextValues: Record<string, unknown> = { ...previousValues };
  if (input.patch.title !== undefined) nextValues.title = input.patch.title;
  if (input.patch.description !== undefined) nextValues.description = input.patch.description;
  if (input.patch.location !== undefined) nextValues.location = input.patch.location;
  if (input.patch.startTime !== undefined) nextValues.start_time = input.patch.startTime;
  if (input.patch.endTime !== undefined) nextValues.end_time = input.patch.endTime;
  if (input.patch.eventType !== undefined) nextValues.event_type = input.patch.eventType;

  const version = googleEventId
    ? await loadCalendarEventVersion(
        {
          tenantId,
          googleCalendarId: local.calendar_id,
          externalEventId: googleEventId,
        },
        opts
      )
    : null;

  const metaEtag =
    typeof local.metadata?.google_etag === "string" ? local.metadata.google_etag.trim() : null;
  const expectedEtag = version?.external_etag?.trim() || metaEtag || null;

  // Mark pending before provider call so failures never look like silent success.
  await markPendingLocal(supabase, tenantId, local.id, {
    last_writeback_attempt_at: new Date().toISOString(),
    last_writeback_source: input.interactionSource,
  });

  if (googleEventId) {
    await upsertCalendarEventVersion(
      {
        tenantId,
        googleCalendarId: local.calendar_id,
        externalEventId: googleEventId,
        localEventId: local.id,
        externalEtag: expectedEtag,
        localUpdatedAt: new Date().toISOString(),
        ownershipSource: deriveCalendarEventOwnershipSource({
          metadata: local.metadata,
          patientId: local.patient_id,
          leadId: local.lead_id,
        }),
        versionStatus: "pending_local",
      },
      opts
    ).catch(() => null);
  }

  const fiosAppointmentId =
    typeof local.metadata?.fios_appointment_id === "string"
      ? local.metadata.fios_appointment_id
      : typeof local.metadata?.fi_booking_id === "string"
        ? local.metadata.fi_booking_id
        : null;

  const notesDescription =
    input.patch.notes !== undefined
      ? input.patch.notes
      : input.patch.description !== undefined
        ? input.patch.description
        : undefined;

  const updateResult = await updateGoogleCalendarEvent(
    {
      tenantId,
      eventId: local.id,
      title: input.patch.title,
      description: notesDescription,
      location: input.patch.location,
      startTime: input.patch.startTime,
      endTime: input.patch.endTime,
      eventType: input.patch.eventType,
      expectedEtag,
      requireEtagMatch: Boolean(input.requireEtagMatch),
      metadata: {
        writeback_status: "synced",
        last_writeback_at: new Date().toISOString(),
        last_writeback_source: input.interactionSource,
        calendar_event_classification: classification,
        ...(input.patch.assignedStaffId !== undefined
          ? { assigned_staff_id: input.patch.assignedStaffId }
          : {}),
        ...(input.patch.clinicId !== undefined ? { clinic_id: input.patch.clinicId } : {}),
        ...(input.patch.roomId !== undefined ? { room_id: input.patch.roomId } : {}),
        ...(input.patch.bookingStatus !== undefined
          ? { status: input.patch.bookingStatus, sync_status: input.patch.bookingStatus }
          : {}),
      },
    },
    opts
  );

  if (!updateResult.ok) {
    const writebackStatus: CalendarWritebackStatus =
      updateResult.code === "concurrent_edit" ? "conflict" : "failed";

    if (googleEventId) {
      await upsertCalendarEventVersion(
        {
          tenantId,
          googleCalendarId: local.calendar_id,
          externalEventId: googleEventId,
          localEventId: local.id,
          externalEtag: expectedEtag,
          localUpdatedAt: new Date().toISOString(),
          ownershipSource: deriveCalendarEventOwnershipSource({
            metadata: local.metadata,
            patientId: local.patient_id,
            leadId: local.lead_id,
          }),
          versionStatus: writebackStatus === "conflict" ? "conflict" : "pending_local",
        },
        opts
      ).catch(() => null);
    }

    await markPendingLocal(supabase, tenantId, local.id, {
      writeback_status: writebackStatus,
      writeback_error: updateResult.error,
      writeback_conflict: writebackStatus === "conflict",
    });

    const audit = buildCalendarMutationAuditRecord({
      id: auditId,
      tenantId,
      actingUserId: input.actingUserId,
      actingUserLabel: input.actingUserLabel,
      interactionSource: input.interactionSource,
      classification,
      fiosAppointmentId,
      googleEventId,
      localCalendarEventId: local.id,
      previousValues,
      nextValues,
      writebackStatus,
      conflictDetails: writebackStatus === "conflict" ? updateResult.error : null,
      failureDetails: writebackStatus === "failed" ? updateResult.error : null,
    });
    await appendMutationActivity(supabase, tenantId, local.id, calendarAuditToActivityEntry(audit));

    logStructured("warn", "calendar_os_writeback_failed", {
      tenantId,
      eventId: local.id,
      googleEventId,
      code: updateResult.code,
      writebackStatus,
    });

    return {
      ok: false,
      error: updateResult.error,
      code:
        updateResult.code === "concurrent_edit"
          ? "concurrent_edit"
          : updateResult.code === "etag_required"
            ? "etag_required"
            : "google_writeback_failed",
      writebackStatus,
      googleEventId,
      auditId,
    };
  }

  const googleEtag = updateResult.data.googleEtag;
  if (googleEventId) {
    await upsertCalendarEventVersion(
      {
        tenantId,
        googleCalendarId: local.calendar_id,
        externalEventId: googleEventId,
        localEventId: local.id,
        externalEtag: googleEtag,
        externalUpdatedAt: new Date().toISOString(),
        localUpdatedAt: new Date().toISOString(),
        ownershipSource: deriveCalendarEventOwnershipSource({
          metadata: updateResult.data.event.metadata,
          patientId: updateResult.data.event.patientId,
          leadId: updateResult.data.event.leadId,
        }),
        versionStatus: "synced",
      },
      opts
    ).catch(() => null);
  }

  const audit = buildCalendarMutationAuditRecord({
    id: auditId,
    tenantId,
    actingUserId: input.actingUserId,
    actingUserLabel: input.actingUserLabel,
    interactionSource: input.interactionSource,
    classification,
    fiosAppointmentId,
    googleEventId,
    localCalendarEventId: local.id,
    previousValues,
    nextValues,
    writebackStatus: "synced",
  });
  await appendMutationActivity(supabase, tenantId, local.id, calendarAuditToActivityEntry(audit));

  logStructured("info", "calendar_os_writeback_synced", {
    tenantId,
    eventId: local.id,
    googleEventId,
    interactionSource: input.interactionSource,
    auditId,
  });

  return {
    ok: true,
    event: updateResult.data.event,
    classification,
    writebackStatus: "synced",
    googleEtag,
    auditId,
  };
}
