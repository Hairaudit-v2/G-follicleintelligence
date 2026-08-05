/**
 * FI-CALENDAR-WRITEBACK-1A / FI-CALENDAR-IDENTITY-LINK-1B —
 * link patient or consultation identity to a CalendarOS event (audited, confirmation required).
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
import { promoteConsultationToPatient } from "@/src/lib/calendar/consultationPatientPromotion.server";
import { readPersistedGooglePatientHydration } from "@/src/lib/calendar/calendarGooglePatientHydration";
import { logStructured } from "@/src/lib/server/structuredLog";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
};

export type LinkCalendarOsPatientInput = {
  tenantId: string;
  eventId: string;
  /** Canonical patient id when linking an existing patient. */
  patientId?: string | null;
  /** Consultation identity to link (and optionally promote). */
  consultationId?: string | null;
  /** Enquiry / CRM lead identity. */
  enquiryId?: string | null;
  /** Must be true — never auto-link. */
  confirmed: boolean;
  /**
   * When consultation has no patient: promote to patient then link.
   * When false, attach consultation_id only (consultation_identity_linked).
   */
  promoteToPatient?: boolean;
  actingUserId?: string | null;
  actingUserLabel?: string | null;
  /** Explicit acknowledgment of ambiguous/duplicate review. */
  reviewPossibleDuplicate?: boolean;
};

export type LinkCalendarOsPatientResult =
  | {
      ok: true;
      eventId: string;
      patientId: string | null;
      consultationId: string | null;
      enquiryId: string | null;
      identityState: string;
      classification: CalendarEventClassification;
      auditId: string;
      promoted: boolean;
    }
  | {
      ok: false;
      error: string;
      code:
        | "not_found"
        | "not_confirmed"
        | "invalid_patient"
        | "invalid_consultation"
        | "identity_conflict"
        | "update_failed"
        | "promote_failed";
    };

/** Load optional match suggestions for the link-patient drawer. */
export async function loadCalendarOsPatientMatchSuggestions(
  input: {
    tenantId: string;
    eventId: string;
  },
  opts: ServerOpts = {}
): Promise<
  | {
      ok: true;
      suggestions: CalendarPatientMatchCandidate[];
      hydration: import("@/src/lib/calendar/calendarGooglePatientHydration").GooglePatientHydration;
    }
  | { ok: false; error: string }
> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const tenantId = input.tenantId.trim();
  const { data: event, error } = await supabase
    .from("fi_calendar_events")
    .select("id, external_event_id, title, description, location, metadata, patient_id")
    .eq("id", input.eventId.trim())
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error || !event) return { ok: false, error: error?.message ?? "Event not found." };

  const meta = (event.metadata ?? {}) as Record<string, unknown>;
  const hydration = readPersistedGooglePatientHydration(meta, {
    title: (event as { title?: string }).title,
    description: (event as { description?: string | null }).description,
    location: (event as { location?: string | null }).location,
  });
  const eventEmail = hydration.email;
  const eventPhone = hydration.phone;
  const eventDisplayName = hydration.displayName;

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
    eventDisplayName,
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

  return { ok: true, suggestions, hydration };
}

/**
 * Link a CalendarOS event to a FiOS patient and/or consultation identity after confirmation.
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
  let patientId = input.patientId?.trim() || null;
  let consultationId = input.consultationId?.trim() || null;
  const enquiryId = input.enquiryId?.trim() || null;
  const promoteToPatient = Boolean(input.promoteToPatient);

  if (!patientId && !consultationId && !enquiryId) {
    return {
      ok: false,
      error: "Select a patient, consultation, or enquiry identity.",
      code: "invalid_patient",
    };
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const auditId = randomUUID();

  const { data: event, error: eventErr } = await supabase
    .from("fi_calendar_events")
    .select("id, external_event_id, patient_id, lead_id, consultation_id, person_id, metadata")
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
    consultation_id: string | null;
    person_id: string | null;
    metadata: Record<string, unknown>;
  };

  const previousPatientId = row.patient_id;
  const previousConsultationId = row.consultation_id;
  let promoted = false;
  let personId: string | null = row.person_id;

  // Do not silently overwrite an existing explicit patient mapping with a different patient.
  if (
    previousPatientId?.trim() &&
    patientId &&
    previousPatientId.trim() !== patientId &&
    !input.reviewPossibleDuplicate
  ) {
    return {
      ok: false,
      error: "Event already has an explicit patient mapping. Confirm override to continue.",
      code: "identity_conflict",
    };
  }

  if (consultationId) {
    const { data: consultation, error: cErr } = await supabase
      .from("fi_consultations")
      .select("id, patient_id, person_id, lead_id")
      .eq("id", consultationId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (cErr || !consultation) {
      return { ok: false, error: "Consultation not found for this tenant.", code: "invalid_consultation" };
    }
    const cr = consultation as {
      id: string;
      patient_id: string | null;
      person_id: string | null;
      lead_id: string | null;
    };
    personId = cr.person_id?.trim() || personId;

    if (promoteToPatient || patientId) {
      if (!patientId && cr.patient_id?.trim()) {
        patientId = cr.patient_id.trim();
      } else if (!patientId && promoteToPatient) {
        const promo = await promoteConsultationToPatient(
          {
            tenantId,
            consultationId,
            calendarEventId: eventId,
            actingUserId: input.actingUserId,
            actingUserLabel: input.actingUserLabel,
          },
          opts
        );
        if (!promo.ok) {
          return { ok: false, error: promo.error, code: "promote_failed" };
        }
        patientId = promo.patientId;
        personId = promo.personId;
        promoted = promo.created || true;
      }
    } else if (cr.patient_id?.trim()) {
      patientId = cr.patient_id.trim();
    }
  }

  if (patientId) {
    const { data: patient, error: patientErr } = await supabase
      .from("fi_patients")
      .select("id, person_id")
      .eq("id", patientId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (patientErr || !patient) {
      return { ok: false, error: "Patient not found for this tenant.", code: "invalid_patient" };
    }
    personId = (patient as { person_id: string }).person_id?.trim() || personId;
  }

  if (enquiryId) {
    const { data: lead } = await supabase
      .from("fi_crm_leads")
      .select("id, person_id, patient_id")
      .eq("id", enquiryId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!lead) {
      return { ok: false, error: "Enquiry/lead not found for this tenant.", code: "invalid_patient" };
    }
    const lr = lead as { person_id: string | null; patient_id: string | null };
    personId = lr.person_id?.trim() || personId;
    if (!patientId && lr.patient_id?.trim()) patientId = lr.patient_id.trim();
  }

  const now = new Date().toISOString();
  const identityState = patientId
    ? "patient_linked"
    : consultationId
      ? "consultation_identity_linked"
      : enquiryId
        ? "enquiry_identity_linked"
        : "external_identity_only";

  const nextMeta: Record<string, unknown> = {
    ...(row.metadata ?? {}),
    patient_linked_at: now,
    patient_linked_by_user_id: input.actingUserId ?? null,
    patient_linked_by_label: input.actingUserLabel ?? null,
    ownership: patientId || consultationId ? "fi_system" : (row.metadata ?? {}).ownership,
    person_identity_state: identityState,
    ...(consultationId ? { consultation_id: consultationId } : {}),
    ...(enquiryId ? { enquiry_id: enquiryId } : {}),
    ...(promoted ? { consultation_promoted_to_patient: true } : {}),
  };

  const { error: updateErr } = await supabase
    .from("fi_calendar_events")
    .update({
      patient_id: patientId,
      lead_id: enquiryId ?? row.lead_id,
      consultation_id: consultationId,
      person_id: personId,
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
    lead_id: enquiryId ?? row.lead_id,
    external_event_id: row.external_event_id,
  });

  const audit = buildCalendarMutationAuditRecord({
    id: auditId,
    tenantId,
    actingUserId: input.actingUserId,
    actingUserLabel: input.actingUserLabel,
    interactionSource: "calendar_patient_link",
    classification,
    googleEventId: row.external_event_id,
    localCalendarEventId: eventId,
    previousValues: {
      patient_id: previousPatientId,
      consultation_id: previousConsultationId,
      identity_state: (row.metadata ?? {}).person_identity_state ?? null,
    },
    nextValues: {
      patient_id: patientId,
      consultation_id: consultationId,
      identity_state: identityState,
    },
    writebackStatus: "not_required",
    metadata: {
      ownership_after: deriveCalendarEventOwnershipSource({
        metadata: nextMeta,
        patientId,
        leadId: enquiryId ?? row.lead_id,
      }),
      promoted,
      match_method: promoted
        ? "consultation_to_patient_promotion"
        : patientId
          ? "manual_override"
          : "consultation_contact",
      interaction_source: "calendar_patient_link",
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
    consultationId,
    enquiryId,
    identityState,
    promoted,
    actingUserId: input.actingUserId,
    auditId,
    classification,
    interactionSource: "calendar_patient_link",
  });

  return {
    ok: true,
    eventId,
    patientId,
    consultationId,
    enquiryId,
    identityState,
    classification,
    auditId,
    promoted,
  };
}
