import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import { loadConsultationsForPatient } from "@/src/lib/consultations/consultationLoaders.server";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { FiCrmLeadRow } from "@/src/lib/crm/types";
import {
  countCompletedProcedures,
  formatPatientLifetimeValueGbp,
  pickLastVisitAt,
  pickNextAppointment,
  sumPatientLifetimeValueGbp,
  type PatientDirectoryBookingLike,
} from "./patientDirectoryMetrics";
import { mapPatientConsultationListItems, type PatientConsultationListItem } from "./patientConsultations";
import { formatClinicalScalesSummary } from "./hairLossScales";
import {
  loadPatientPersonLeadHistory,
  loadPersonCrmActivityForLeads,
  pickPrimaryLeadForPatient,
  type PatientPersonCrmActivityItem,
  type PatientPersonLeadHistoryItem,
} from "./patientLeadHistory";
import { normalizePatientStatus, type PatientStatusValue } from "./patientPolicy";
import { isActiveCaseStatus } from "./patientProfileSummary";

export type PatientSlideOverPayload = {
  patientId: string;
  personId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  patientStatus: PatientStatusValue;
  createdAt: string;
  clinicalScalesSummary: string | null;
  nextAppointmentAt: string | null;
  nextAppointmentId: string | null;
  lastVisitAt: string | null;
  totalProcedures: number;
  lifetimeValueLabel: string;
  linkedLeadCount: number;
  activeCaseCount: number;
  upcomingBookingCount: number;
  primaryLead: FiCrmLeadRow | null;
  bookingRows: FiBookingRow[];
  groupingNowIso: string;
  consultations: PatientConsultationListItem[];
  personLeadHistory: PatientPersonLeadHistoryItem[];
  personCrmActivity: PatientPersonCrmActivityItem[];
};

function personMetaContact(meta: Record<string, unknown>): { email: string | null; phone: string | null } {
  const email =
    typeof meta.email === "string"
      ? meta.email.trim() || null
      : typeof meta.email_normalized === "string"
        ? meta.email_normalized.trim() || null
        : null;
  const phone = typeof meta.phone === "string" ? meta.phone.trim() || null : null;
  return { email, phone };
}

function mapBookingRow(raw: Record<string, unknown>): FiBookingRow {
  const meta = raw.metadata;
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    lead_id: raw.lead_id != null ? String(raw.lead_id) : null,
    person_id: raw.person_id != null ? String(raw.person_id) : null,
    patient_id: raw.patient_id != null ? String(raw.patient_id) : null,
    case_id: raw.case_id != null ? String(raw.case_id) : null,
    clinic_id: raw.clinic_id != null ? String(raw.clinic_id) : null,
    assigned_staff_id: raw.assigned_staff_id != null ? String(raw.assigned_staff_id) : null,
    assigned_user_id: raw.assigned_user_id != null ? String(raw.assigned_user_id) : null,
    booking_type: String(raw.booking_type),
    booking_status: String(raw.booking_status),
    title: raw.title != null ? String(raw.title) : null,
    description: raw.description != null ? String(raw.description) : null,
    start_at: String(raw.start_at),
    end_at: String(raw.end_at),
    timezone: raw.timezone != null ? String(raw.timezone) : null,
    location: raw.location != null ? String(raw.location) : null,
    metadata: meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {},
    cancelled_at: raw.cancelled_at != null ? String(raw.cancelled_at) : null,
    cancelled_by_user_id: raw.cancelled_by_user_id != null ? String(raw.cancelled_by_user_id) : null,
    cancellation_reason: raw.cancellation_reason != null ? String(raw.cancellation_reason) : null,
    created_by_user_id: raw.created_by_user_id != null ? String(raw.created_by_user_id) : null,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  };
}

/** Compact patient bundle for the directory slide-over. Gate via CRM shell session before calling. */
export async function loadPatientSlideOverPayload(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<PatientSlideOverPayload | null> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  if (!tid || !pid) return null;

  const { data: patRow, error: pe } = await supabase
    .from("fi_patients")
    .select("id, person_id, created_at, patient_status")
    .eq("tenant_id", tid)
    .eq("id", pid)
    .maybeSingle();
  if (pe) throw new Error(pe.message);
  if (!patRow) return null;

  const personId = String((patRow as { person_id: string }).person_id);
  const nowIso = new Date().toISOString();

  const personLeadHistory = await loadPatientPersonLeadHistory(supabase, tid, personId, pid);

  const [{ data: personRow }, { data: clinicalRow }, { data: caseRows }, { data: bookRows }, personCrmActivity, consultationsRaw] =
    await Promise.all([
      supabase.from("fi_persons").select("metadata").eq("tenant_id", tid).eq("id", personId).maybeSingle(),
      supabase
        .from("fi_patient_clinical_details")
        .select("norwood_scale, ludwig_scale, hairline_pattern, primary_concern, primary_hair_concern")
        .eq("tenant_id", tid)
        .eq("patient_id", pid)
        .maybeSingle(),
      supabase.from("fi_cases").select("status").eq("tenant_id", tid).eq("foundation_patient_id", pid),
      supabase.from("fi_bookings").select("*").eq("tenant_id", tid).eq("patient_id", pid),
      loadPersonCrmActivityForLeads(supabase, tid, pid, personLeadHistory, 20),
      loadConsultationsForPatient(tid, pid, personId),
    ]);

  const meta =
    personRow?.metadata && typeof personRow.metadata === "object" && !Array.isArray(personRow.metadata)
      ? (personRow.metadata as Record<string, unknown>)
      : {};
  const { email, phone } = personMetaContact(meta);
  const displayName = personMetadataDisplayLabel(meta);

  let activeCaseCount = 0;
  for (const row of caseRows ?? []) {
    if (isActiveCaseStatus(String((row as { status: string }).status))) activeCaseCount += 1;
  }

  const bookingRows = (bookRows ?? []).map((row) => mapBookingRow(row as Record<string, unknown>));
  const bookings: PatientDirectoryBookingLike[] = bookingRows.map((b) => ({
    id: b.id,
    start_at: b.start_at,
    booking_status: b.booking_status,
    booking_type: b.booking_type,
    title: b.title,
  }));

  let upcomingBookingCount = 0;
  for (const b of bookings) {
    const st = String(b.booking_status ?? "").toLowerCase();
    if (st === "cancelled" || st === "completed" || st === "no_show") continue;
    if (b.start_at >= nowIso) upcomingBookingCount += 1;
  }
  const nextAppt = pickNextAppointment(bookings, nowIso);

  const leadMetas = personLeadHistory.map(({ lead }) => lead.metadata ?? {});
  const lifetimeValueGbp = sumPatientLifetimeValueGbp(leadMetas);

  const cr = clinicalRow as Record<string, unknown> | null;
  const clinicalScalesSummary = cr
    ? formatClinicalScalesSummary({
        norwood_scale: cr.norwood_scale != null ? String(cr.norwood_scale) : null,
        ludwig_scale: cr.ludwig_scale != null ? String(cr.ludwig_scale) : null,
        hairline_pattern: cr.hairline_pattern != null ? String(cr.hairline_pattern) : null,
        primary_concern:
          cr.primary_concern != null
            ? String(cr.primary_concern)
            : cr.primary_hair_concern != null
              ? String(cr.primary_hair_concern)
              : null,
      })
    : null;

  const consultations = mapPatientConsultationListItems(
    consultationsRaw,
    cr
      ? {
          norwood_scale: cr.norwood_scale != null ? String(cr.norwood_scale) : null,
          ludwig_scale: cr.ludwig_scale != null ? String(cr.ludwig_scale) : null,
        }
      : null
  );

  return {
    patientId: pid,
    personId,
    displayName,
    email,
    phone,
    patientStatus: normalizePatientStatus((patRow as { patient_status?: string | null }).patient_status),
    createdAt: String((patRow as { created_at: string }).created_at),
    clinicalScalesSummary,
    nextAppointmentAt: nextAppt?.startAt ?? null,
    nextAppointmentId: nextAppt?.id ?? null,
    lastVisitAt: pickLastVisitAt(bookings, nowIso),
    totalProcedures: countCompletedProcedures(bookings),
    lifetimeValueLabel: formatPatientLifetimeValueGbp(lifetimeValueGbp),
    linkedLeadCount: personLeadHistory.filter((i) => i.linkedToThisPatient).length,
    activeCaseCount,
    upcomingBookingCount,
    primaryLead: pickPrimaryLeadForPatient(personLeadHistory),
    bookingRows,
    groupingNowIso: nowIso,
    consultations,
    personLeadHistory,
    personCrmActivity,
  };
}
