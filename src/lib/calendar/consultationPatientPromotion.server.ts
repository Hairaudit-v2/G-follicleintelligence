/**
 * FI-CALENDAR-IDENTITY-LINK-1B — idempotent consultation → canonical patient promotion.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveOrCreatePatient } from "@/src/lib/fi/foundation/resolvePatient";
import { logStructured } from "@/src/lib/server/structuredLog";

export const CONSULTATION_PROMOTION_SOURCE_SYSTEM = "consultation_promotion" as const;

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
};

export type PromoteConsultationToPatientInput = {
  tenantId: string;
  consultationId: string;
  /** Idempotency key — defaults to consultation id. */
  idempotencyKey?: string | null;
  actingUserId?: string | null;
  actingUserLabel?: string | null;
  /** Optional calendar event to attach patient_id after promotion. */
  calendarEventId?: string | null;
  /** Optional FiOS booking / appointment to attach patient_id. */
  appointmentId?: string | null;
};

export type PromoteConsultationToPatientResult =
  | {
      ok: true;
      patientId: string;
      personId: string;
      consultationId: string;
      created: boolean;
      auditId: string;
    }
  | {
      ok: false;
      error: string;
      code: "not_found" | "missing_person" | "cross_tenant" | "promote_failed";
    };

/**
 * Promote a consultation contact identity to one canonical `fi_patients` row.
 *
 * Idempotent via `fi_patient_source_ids` (tenant_id, consultation_promotion, consultationId)
 * and `fi_patients` unique (tenant_id, person_id). Repeated calls return the same patient UUID.
 */
export async function promoteConsultationToPatient(
  input: PromoteConsultationToPatientInput,
  opts: ServerOpts = {}
): Promise<PromoteConsultationToPatientResult> {
  const tenantId = input.tenantId.trim();
  const consultationId = input.consultationId.trim();
  const idempotencyKey = (input.idempotencyKey?.trim() || consultationId).trim();
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const auditId = randomUUID();

  const { data: consultation, error } = await supabase
    .from("fi_consultations")
    .select("id, tenant_id, person_id, patient_id, lead_id")
    .eq("id", consultationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !consultation) {
    return { ok: false, error: "Consultation not found for this tenant.", code: "not_found" };
  }

  const row = consultation as {
    id: string;
    tenant_id: string;
    person_id: string | null;
    patient_id: string | null;
    lead_id: string | null;
  };

  if (row.tenant_id.trim() !== tenantId) {
    return { ok: false, error: "Cross-tenant consultation match rejected.", code: "cross_tenant" };
  }

  // Already promoted on the consultation.
  if (row.patient_id?.trim()) {
    const patientId = row.patient_id.trim();
    const personId = row.person_id?.trim() || "";
    await attachPatientToRelatedEntities(supabase, {
      tenantId,
      patientId,
      personId: personId || null,
      consultationId,
      calendarEventId: input.calendarEventId,
      appointmentId: input.appointmentId,
    });
    return {
      ok: true,
      patientId,
      personId: personId || (await loadPersonIdForPatient(supabase, tenantId, patientId)) || patientId,
      consultationId,
      created: false,
      auditId,
    };
  }

  // Source-id idempotency key (same consultation → same patient).
  const { data: existingMap } = await supabase
    .from("fi_patient_source_ids")
    .select("patient_id")
    .eq("tenant_id", tenantId)
    .eq("source_system", CONSULTATION_PROMOTION_SOURCE_SYSTEM)
    .eq("source_patient_id", idempotencyKey)
    .maybeSingle();

  if (existingMap?.patient_id) {
    const patientId = String(existingMap.patient_id);
    const { data: patient } = await supabase
      .from("fi_patients")
      .select("id, person_id")
      .eq("id", patientId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (patient) {
      await attachPatientToRelatedEntities(supabase, {
        tenantId,
        patientId,
        personId: String((patient as { person_id: string }).person_id),
        consultationId,
        calendarEventId: input.calendarEventId,
        appointmentId: input.appointmentId,
      });
      return {
        ok: true,
        patientId,
        personId: String((patient as { person_id: string }).person_id),
        consultationId,
        created: false,
        auditId,
      };
    }
  }

  const personId = row.person_id?.trim();
  if (!personId) {
    return {
      ok: false,
      error: "Consultation has no contact person to promote.",
      code: "missing_person",
    };
  }

  try {
    const resolved = await resolveOrCreatePatient(
      {
        tenant_id: tenantId,
        person_id: personId,
        source_system: CONSULTATION_PROMOTION_SOURCE_SYSTEM,
        source_patient_id: idempotencyKey,
        metadata: {
          promoted_from_consultation_id: consultationId,
          promotion_audit_id: auditId,
          promoted_by_user_id: input.actingUserId ?? null,
          promoted_by_label: input.actingUserLabel ?? null,
        },
      },
      supabase
    );

    const patientId = resolved.patient.id;
    const now = new Date().toISOString();

    // Attach patient back to consultation without detaching lead/person history.
    await supabase
      .from("fi_consultations")
      .update({
        patient_id: patientId,
        person_id: personId,
        updated_at: now,
      })
      .eq("id", consultationId)
      .eq("tenant_id", tenantId)
      .is("patient_id", null);

    // If race set patient_id, re-read.
    const { data: after } = await supabase
      .from("fi_consultations")
      .select("patient_id, person_id")
      .eq("id", consultationId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const finalPatientId =
      (after as { patient_id: string | null } | null)?.patient_id?.trim() || patientId;

    await attachPatientToRelatedEntities(supabase, {
      tenantId,
      patientId: finalPatientId,
      personId,
      consultationId,
      calendarEventId: input.calendarEventId,
      appointmentId: input.appointmentId,
    });

    logStructured("info", "consultation_patient_promotion", {
      tenantId,
      consultationId,
      patientId: finalPatientId,
      personId,
      created: resolved.created,
      auditId,
      actingUserId: input.actingUserId,
      interactionSource: "consultation_patient_promotion",
    });

    return {
      ok: true,
      patientId: finalPatientId,
      personId,
      consultationId,
      created: resolved.created,
      auditId,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Promotion failed.",
      code: "promote_failed",
    };
  }
}

async function loadPersonIdForPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("fi_patients")
    .select("person_id")
    .eq("id", patientId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as { person_id?: string } | null)?.person_id?.trim() || null;
}

async function attachPatientToRelatedEntities(
  supabase: SupabaseClient,
  args: {
    tenantId: string;
    patientId: string;
    personId: string | null;
    consultationId: string;
    calendarEventId?: string | null;
    appointmentId?: string | null;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const tid = args.tenantId;
  const patientId = args.patientId;

  await supabase
    .from("fi_consultations")
    .update({
      patient_id: patientId,
      ...(args.personId ? { person_id: args.personId } : {}),
      updated_at: now,
    })
    .eq("id", args.consultationId)
    .eq("tenant_id", tid)
    .is("patient_id", null);

  if (args.calendarEventId?.trim()) {
    const eventId = args.calendarEventId.trim();
    const { data: event } = await supabase
      .from("fi_calendar_events")
      .select("id, patient_id, metadata")
      .eq("id", eventId)
      .eq("tenant_id", tid)
      .maybeSingle();
    if (event) {
      const existingPatient = (event as { patient_id: string | null }).patient_id?.trim();
      // Do not silently overwrite a different explicit patient mapping.
      if (!existingPatient || existingPatient === patientId) {
        const meta = {
          ...((event as { metadata: Record<string, unknown> }).metadata ?? {}),
          consultation_id: args.consultationId,
          person_identity_state: "patient_linked",
          promoted_from_consultation_id: args.consultationId,
        };
        await supabase
          .from("fi_calendar_events")
          .update({
            patient_id: patientId,
            consultation_id: args.consultationId,
            person_id: args.personId,
            metadata: meta,
            updated_at: now,
          })
          .eq("id", eventId)
          .eq("tenant_id", tid);
      }
    }
  }

  if (args.appointmentId?.trim()) {
    const appointmentId = args.appointmentId.trim();
    await supabase
      .from("fi_bookings")
      .update({
        patient_id: patientId,
        ...(args.personId ? { person_id: args.personId } : {}),
        updated_at: now,
      })
      .eq("id", appointmentId)
      .eq("tenant_id", tid)
      .is("patient_id", null);
  }
}
