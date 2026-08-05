/**
 * FI-CALENDAR-PATIENT-LINK-1A — create (or reuse) a patient from Google hydration and link it.
 * Idempotent on Google external_event_id — reopening must not create a duplicate.
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
} from "@/src/lib/calendar/calendarWritebackAudit";
import {
  readPersistedGooglePatientHydration,
  type GooglePatientHydration,
} from "@/src/lib/calendar/calendarGooglePatientHydration";
import { linkCalendarOsEventPatient } from "@/src/lib/calendar/calendarOsPatientLink.server";
import { resolveOrCreatePerson } from "@/src/lib/fi/foundation/resolvePerson";
import { resolveOrCreatePatient } from "@/src/lib/fi/foundation/resolvePatient";
import { logStructured } from "@/src/lib/server/structuredLog";

export const GOOGLE_EVENT_PATIENT_SOURCE_SYSTEM = "google_calendar_event" as const;

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
};

export type CreateAndLinkPatientFromGoogleHydrationInput = {
  tenantId: string;
  eventId: string;
  /** Must be true — never auto-create without confirmation. */
  confirmed: boolean;
  actingUserId?: string | null;
  actingUserLabel?: string | null;
};

export type CreateAndLinkPatientFromGoogleHydrationResult =
  | {
      ok: true;
      eventId: string;
      patientId: string;
      personId: string;
      created: boolean;
      classification: CalendarEventClassification;
      googleEventId: string | null;
      calendarId: string;
      hydration: GooglePatientHydration;
      auditId: string;
    }
  | {
      ok: false;
      error: string;
      code:
        | "not_found"
        | "not_confirmed"
        | "missing_hydration"
        | "create_failed"
        | "link_failed"
        | "already_linked";
      patientId?: string;
    };

function splitDisplayName(displayName: string | null): { first: string; last: string } {
  const parts = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0]!, last: "" };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

/**
 * Create-or-reuse a FiOS patient from Google-hydrated contact fields and link the calendar event.
 * Idempotent: source mapping key = Google external_event_id (tenant-scoped).
 */
export async function createAndLinkPatientFromGoogleHydration(
  input: CreateAndLinkPatientFromGoogleHydrationInput,
  opts: ServerOpts = {}
): Promise<CreateAndLinkPatientFromGoogleHydrationResult> {
  if (!input.confirmed) {
    return {
      ok: false,
      error: "Confirm creating/linking the patient from Google hydration.",
      code: "not_confirmed",
    };
  }

  const tenantId = input.tenantId.trim();
  const eventId = input.eventId.trim();
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const auditId = randomUUID();

  const { data: event, error } = await supabase
    .from("fi_calendar_events")
    .select(
      "id, tenant_id, external_event_id, calendar_id, title, description, location, patient_id, lead_id, metadata"
    )
    .eq("id", eventId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !event) {
    return { ok: false, error: "Calendar event not found.", code: "not_found" };
  }

  const row = event as {
    id: string;
    tenant_id: string;
    external_event_id: string | null;
    calendar_id: string;
    title: string;
    description: string | null;
    location: string | null;
    patient_id: string | null;
    lead_id: string | null;
    metadata: Record<string, unknown>;
  };

  const googleEventId = row.external_event_id?.trim() || null;
  const calendarId = row.calendar_id;

  // Reopen: already linked — return existing patient, do not create another.
  if (row.patient_id?.trim()) {
    const classification = classifyFiCalendarEventOverlapRow({
      metadata: { ...(row.metadata ?? {}), ownership: "fi_system", source: "fi_appointment_create" },
      patient_id: row.patient_id,
      lead_id: row.lead_id,
      external_event_id: googleEventId,
    });
    return {
      ok: true,
      eventId: row.id,
      patientId: row.patient_id.trim(),
      personId: "",
      created: false,
      classification,
      googleEventId,
      calendarId,
      hydration: readPersistedGooglePatientHydration(row.metadata, {
        title: row.title,
        description: row.description,
        location: row.location,
      }),
      auditId,
    };
  }

  const hydration = readPersistedGooglePatientHydration(row.metadata, {
    title: row.title,
    description: row.description,
    location: row.location,
  });

  if (!hydration.displayName && !hydration.email && !hydration.phone) {
    return {
      ok: false,
      error: "No Google-hydrated patient fields available to create a patient.",
      code: "missing_hydration",
    };
  }

  const sourceKey = googleEventId || row.id;
  const names = splitDisplayName(hydration.displayName);

  try {
    const personResult = await resolveOrCreatePerson(
      {
        tenant_id: tenantId,
        source_system: GOOGLE_EVENT_PATIENT_SOURCE_SYSTEM,
        source_person_id: sourceKey,
        display_name: hydration.displayName,
        email: hydration.email,
        phone: hydration.phone,
        metadata: {
          first_name: names.first || null,
          last_name: names.last || null,
          surname: names.last || null,
          email: hydration.email,
          phone: hydration.phone,
          google_calendar_event_id: googleEventId,
          google_calendar_id: calendarId,
          hydrated_from: "google_event",
        },
      },
      supabase
    );

    const patientResult = await resolveOrCreatePatient(
      {
        tenant_id: tenantId,
        person_id: personResult.person.id,
        source_system: GOOGLE_EVENT_PATIENT_SOURCE_SYSTEM,
        source_patient_id: sourceKey,
        metadata: {
          first_name: names.first || null,
          last_name: names.last || null,
          surname: names.last || null,
          display_name: hydration.displayName,
          email: hydration.email,
          email_normalized: hydration.email,
          phone: hydration.phone,
          google_calendar_event_id: googleEventId,
          google_calendar_id: calendarId,
          hydrated_from: "google_event",
        },
      },
      supabase
    );

    const patientId = patientResult.patient.id;
    const created = personResult.created || patientResult.created;

    const link = await linkCalendarOsEventPatient(
      {
        tenantId,
        eventId: row.id,
        patientId,
        confirmed: true,
        actingUserId: input.actingUserId,
        actingUserLabel: input.actingUserLabel,
      },
      opts
    );

    if (!link.ok) {
      return { ok: false, error: link.error, code: "link_failed", patientId };
    }

    // Ensure FI ownership + google_linked_fios classification; preserve Google ids.
    const now = new Date().toISOString();
    const nextMeta: Record<string, unknown> = {
      ...(row.metadata ?? {}),
      ownership: "fi_system",
      source: "fi_appointment_create",
      person_identity_state: "patient_linked",
      google_patient_hydration_linked_at: now,
      google_patient_created: created,
      google_event_id_preserved: googleEventId,
      google_calendar_id: calendarId,
      calendar_event_classification: link.classification,
    };

    // Force classification when we have patient + external id.
    const classification = classifyFiCalendarEventOverlapRow({
      metadata: nextMeta,
      patient_id: patientId,
      lead_id: row.lead_id,
      external_event_id: googleEventId,
    });
    nextMeta.calendar_event_classification = classification;

    const audit = buildCalendarMutationAuditRecord({
      id: auditId,
      tenantId,
      actingUserId: input.actingUserId,
      actingUserLabel: input.actingUserLabel,
      interactionSource: "calendar_patient_link",
      classification,
      googleEventId,
      localCalendarEventId: row.id,
      previousValues: { patient_id: null },
      nextValues: { patient_id: patientId, classification },
      writebackStatus: "not_required",
      metadata: {
        created_from_google_hydration: true,
        patient_created: created,
        google_calendar_id: calendarId,
      },
    });

    const activityRaw = nextMeta.appointment_activity;
    const activity = Array.isArray(activityRaw) ? [...activityRaw] : [];
    activity.push(calendarAuditToActivityEntry(audit));
    nextMeta.appointment_activity = activity;

    await supabase
      .from("fi_calendar_events")
      .update({
        patient_id: patientId,
        person_id: personResult.person.id,
        metadata: nextMeta,
        // Never clear external_event_id / calendar_id.
        updated_at: now,
      })
      .eq("id", row.id)
      .eq("tenant_id", tenantId);

    // Attach to converted FiOS appointment if present.
    const bookingId =
      typeof nextMeta.fios_appointment_id === "string"
        ? nextMeta.fios_appointment_id.trim()
        : typeof nextMeta.fi_booking_id === "string"
          ? nextMeta.fi_booking_id.trim()
          : "";
    if (bookingId) {
      await supabase
        .from("fi_bookings")
        .update({
          patient_id: patientId,
          person_id: personResult.person.id,
          updated_at: now,
        })
        .eq("id", bookingId)
        .eq("tenant_id", tenantId)
        .is("patient_id", null);
    }

    logStructured("info", "calendar_os_patient_created_from_google_hydration", {
      tenantId,
      eventId: row.id,
      patientId,
      personId: personResult.person.id,
      created,
      googleEventId,
      calendarId,
      classification,
      auditId,
      interactionSource: "calendar_patient_link",
    });

    return {
      ok: true,
      eventId: row.id,
      patientId,
      personId: personResult.person.id,
      created,
      classification,
      googleEventId,
      calendarId,
      hydration,
      auditId,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create patient from Google hydration.",
      code: "create_failed",
    };
  }
}
