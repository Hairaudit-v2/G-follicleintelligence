/**
 * FI-CALENDAR-WRITEBACK-1A — link patient to CalendarOS event (audited, confirmation required).
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
  suggestCalendarPatientMatches,
  type CalendarPatientMatchCandidate,
} from "@/src/lib/calendar/calendarPatientMatchSuggestions";
import { deriveCalendarEventOwnershipSource } from "@/src/lib/calendar/providers/calendarProviderAdapter";
import { logStructured } from "@/src/lib/server/structuredLog";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
};

export type LinkCalendarOsPatientInput = {
  tenantId: string;
  eventId: string;
  patientId: string;
  /** Must be true — never auto-link. */
  confirmed: boolean;
  actingUserId?: string | null;
  actingUserLabel?: string | null;
};

export type LinkCalendarOsPatientResult =
  | {
      ok: true;
      eventId: string;
      patientId: string;
      classification: CalendarEventClassification;
      auditId: string;
    }
  | { ok: false; error: string; code: "not_found" | "not_confirmed" | "invalid_patient" | "update_failed" };

/** Load optional match suggestions for the link-patient drawer. */
export async function loadCalendarOsPatientMatchSuggestions(
  input: {
    tenantId: string;
    eventId: string;
  },
  opts: ServerOpts = {}
): Promise<{ ok: true; suggestions: CalendarPatientMatchCandidate[] } | { ok: false; error: string }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const tenantId = input.tenantId.trim();
  const { data: event, error } = await supabase
    .from("fi_calendar_events")
    .select("id, external_event_id, title, description, metadata, patient_id")
    .eq("id", input.eventId.trim())
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error || !event) return { ok: false, error: error?.message ?? "Event not found." };

  const meta = (event.metadata ?? {}) as Record<string, unknown>;
  const eventEmail =
    typeof meta.attendee_email === "string"
      ? meta.attendee_email
      : typeof meta.patient_email === "string"
        ? meta.patient_email
        : null;
  const eventPhone =
    typeof meta.attendee_phone === "string"
      ? meta.attendee_phone
      : typeof meta.patient_phone === "string"
        ? meta.patient_phone
        : null;

  const { data: patients } = await supabase
    .from("fi_patients")
    .select("id, metadata")
    .eq("tenant_id", tenantId)
    .limit(200);

  const candidates = ((patients ?? []) as Array<{ id: string; metadata: Record<string, unknown> | null }>).map(
    (p) => {
      const m = p.metadata ?? {};
      const first = typeof m.first_name === "string" ? m.first_name : "";
      const last = typeof m.last_name === "string" ? m.last_name : typeof m.surname === "string" ? m.surname : "";
      const displayName =
        [first, last].filter(Boolean).join(" ").trim() ||
        (typeof m.display_name === "string" ? m.display_name : null);
      return {
        id: p.id,
        displayName,
        email: typeof m.email === "string" ? m.email : typeof m.email_normalized === "string" ? m.email_normalized : null,
        phone: typeof m.phone === "string" ? m.phone : null,
      };
    }
  );

  const verifiedRaw = Array.isArray(meta.verified_patient_mappings)
    ? (meta.verified_patient_mappings as Array<Record<string, unknown>>)
    : [];

  const suggestions = suggestCalendarPatientMatches({
    eventEmail,
    eventPhone,
    externalEventId: (event as { external_event_id: string | null }).external_event_id,
    patients: candidates,
    verifiedMappings: verifiedRaw
      .map((row) => ({
        externalId: String(row.external_id ?? row.externalId ?? ""),
        patientId: String(row.patient_id ?? row.patientId ?? ""),
        displayName: typeof row.display_name === "string" ? row.display_name : null,
        email: typeof row.email === "string" ? row.email : null,
        phone: typeof row.phone === "string" ? row.phone : null,
      }))
      .filter((m) => m.externalId && m.patientId),
  });

  return { ok: true, suggestions };
}

/**
 * Link a CalendarOS event to a FiOS patient after explicit confirmation.
 * Does not auto-match on name. Audits who linked the patient.
 */
export async function linkCalendarOsEventPatient(
  input: LinkCalendarOsPatientInput,
  opts: ServerOpts = {}
): Promise<LinkCalendarOsPatientResult> {
  if (!input.confirmed) {
    return {
      ok: false,
      error: "Confirm patient linkage before saving.",
      code: "not_confirmed",
    };
  }

  const tenantId = input.tenantId.trim();
  const eventId = input.eventId.trim();
  const patientId = input.patientId.trim();
  if (!patientId) {
    return { ok: false, error: "Patient id is required.", code: "invalid_patient" };
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const auditId = randomUUID();

  const { data: patient, error: patientErr } = await supabase
    .from("fi_patients")
    .select("id")
    .eq("id", patientId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (patientErr || !patient) {
    return { ok: false, error: "Patient not found for this tenant.", code: "invalid_patient" };
  }

  const { data: event, error: eventErr } = await supabase
    .from("fi_calendar_events")
    .select("id, external_event_id, patient_id, lead_id, metadata")
    .eq("id", eventId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (eventErr || !event) {
    return { ok: false, error: "Calendar event not found.", code: "not_found" };
  }

  const row = event as {
    id: string;
    external_event_id: string | null;
    patient_id: string | null;
    lead_id: string | null;
    metadata: Record<string, unknown>;
  };

  const previousPatientId = row.patient_id;
  const now = new Date().toISOString();
  const nextMeta: Record<string, unknown> = {
    ...(row.metadata ?? {}),
    patient_linked_at: now,
    patient_linked_by_user_id: input.actingUserId ?? null,
    patient_linked_by_label: input.actingUserLabel ?? null,
    ownership: "fi_system",
  };

  // Patient presence moves ownership toward FI — reclassify after update.
  const { error: updateErr } = await supabase
    .from("fi_calendar_events")
    .update({
      patient_id: patientId,
      metadata: nextMeta,
      updated_at: now,
    })
    .eq("id", eventId)
    .eq("tenant_id", tenantId);

  if (updateErr) {
    return { ok: false, error: updateErr.message, code: "update_failed" };
  }

  const classification = classifyFiCalendarEventOverlapRow({
    metadata: nextMeta,
    patient_id: patientId,
    lead_id: row.lead_id,
    external_event_id: row.external_event_id,
  });

  // Persist classification on the row.
  await supabase
    .from("fi_calendar_events")
    .update({
      metadata: { ...nextMeta, calendar_event_classification: classification },
      updated_at: now,
    })
    .eq("id", eventId)
    .eq("tenant_id", tenantId);

  const audit = buildCalendarMutationAuditRecord({
    id: auditId,
    tenantId,
    actingUserId: input.actingUserId,
    actingUserLabel: input.actingUserLabel,
    interactionSource: "patient_link",
    classification,
    googleEventId: row.external_event_id,
    localCalendarEventId: eventId,
    previousValues: { patient_id: previousPatientId },
    nextValues: { patient_id: patientId },
    writebackStatus: "not_required",
    metadata: {
      ownership_after: deriveCalendarEventOwnershipSource({
        metadata: nextMeta,
        patientId,
        leadId: row.lead_id,
      }),
    },
  });

  const activityRaw = nextMeta.appointment_activity;
  const activity = Array.isArray(activityRaw) ? [...activityRaw] : [];
  activity.push(calendarAuditToActivityEntry(audit));
  await supabase
    .from("fi_calendar_events")
    .update({
      metadata: {
        ...nextMeta,
        calendar_event_classification: classification,
        appointment_activity: activity,
      },
      updated_at: now,
    })
    .eq("id", eventId)
    .eq("tenant_id", tenantId);

  logStructured("info", "calendar_os_patient_linked", {
    tenantId,
    eventId,
    patientId,
    actingUserId: input.actingUserId,
    auditId,
    classification,
  });

  return { ok: true, eventId, patientId, classification, auditId };
}
