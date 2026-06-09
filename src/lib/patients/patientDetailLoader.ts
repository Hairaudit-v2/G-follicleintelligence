import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadConsultationsForPatient } from "@/src/lib/consultations/consultationLoaders.server";
import { loadClinicalNotesForPatient, type PatientClinicalNoteSummary } from "@/src/lib/clinicalNotes/clinicalNotesLoaders.server";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { loadCrmShellScopePickerOptions, loadCrmShellStaffPickerOptions } from "@/src/lib/crm/crmShellLoaders";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import {
  formatPatientLifetimeValueGbp,
  pickNextAppointment,
  sumPatientLifetimeValueGbp,
  type PatientDirectoryBookingLike,
} from "./patientDirectoryMetrics";
import { mapPatientConsultationListItems, type PatientConsultationListItem } from "./patientConsultations";
import {
  loadPatientPersonLeadHistory,
  loadPersonCrmActivityForLeads,
  pickPrimaryLeadForPatient,
  type PatientPersonCrmActivityItem,
  type PatientPersonLeadHistoryItem,
} from "./patientLeadHistory";
import { parsePreviousProceduresFromClinical, type PreviousProcedureRow } from "./previousProcedures";
import {
  loadPatientProfile,
  type PatientProfileFoundationData,
  type PatientProfileLoadResult,
} from "./patientProfileLoader";

export type { PatientPersonLeadHistoryItem, PatientPersonCrmActivityItem } from "./patientLeadHistoryShared";
export type { PatientConsultationListItem as PatientDetailConsultationItem } from "./patientConsultations";

export type PatientDetailNextAppointment = {
  id: string;
  startAt: string;
  title: string | null;
  bookingType: string;
  bookingStatus: string;
};

export type PatientDetailPayload = {
  profile: PatientProfileFoundationData;
  displayName: string;
  personId: string;
  personLeadHistory: PatientPersonLeadHistoryItem[];
  personCrmActivity: PatientPersonCrmActivityItem[];
  primaryLead: ReturnType<typeof pickPrimaryLeadForPatient>;
  consultations: PatientConsultationListItem[];
  previousProcedures: PreviousProcedureRow[];
  nextAppointment: PatientDetailNextAppointment | null;
  treatmentPlanSummary: string | null;
  lifetimeValueGbp: number | null;
  lifetimeValueLabel: string;
  bookingRows: FiBookingRow[];
  groupingNowIso: string;
  assignees: Awaited<ReturnType<typeof loadCrmShellStaffPickerOptions>>;
  clinics: Awaited<ReturnType<typeof loadCrmShellScopePickerOptions>>["clinics"];
  /** Tenant clinic clock for booking forms. */
  calendarTimezone: string;
  /** DoctorOS 1C: voice-derived clinical notes (draft until approved). */
  voiceClinicalNotes: PatientClinicalNoteSummary[];
};

function buildTreatmentPlanSummary(
  profile: PatientProfileFoundationData,
  consultations: PatientConsultationListItem[]
): string | null {
  const parts: string[] = [];
  const clinical = profile.clinicalDetails.row;
  if (clinical?.treatment_interest?.trim()) parts.push(clinical.treatment_interest.trim());
  if (clinical?.primary_concern?.trim()) parts.push(clinical.primary_concern.trim());
  const latestRec = consultations.find((c) => c.recommendation_notes?.trim());
  if (latestRec?.recommendation_notes?.trim()) parts.push(latestRec.recommendation_notes.trim());
  if (parts.length === 0) return null;
  const line = parts.join(" · ");
  return line.length > 280 ? `${line.slice(0, 277)}…` : line;
}

async function loadPatientBookingRows(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<FiBookingRow[]> {
  const { data, error } = await supabase
    .from("fi_bookings")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .order("start_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const meta = r.metadata;
    return {
      id: String(r.id),
      tenant_id: String(r.tenant_id),
      lead_id: r.lead_id != null ? String(r.lead_id) : null,
      person_id: r.person_id != null ? String(r.person_id) : null,
      patient_id: r.patient_id != null ? String(r.patient_id) : null,
      case_id: r.case_id != null ? String(r.case_id) : null,
      clinic_id: r.clinic_id != null ? String(r.clinic_id) : null,
      assigned_staff_id: r.assigned_staff_id != null ? String(r.assigned_staff_id) : null,
      assigned_user_id: r.assigned_user_id != null ? String(r.assigned_user_id) : null,
      room_id: r.room_id != null ? String(r.room_id) : null,
      room_required: r.room_required == null ? true : Boolean(r.room_required),
      booking_type: String(r.booking_type),
      booking_status: String(r.booking_status),
      title: r.title != null ? String(r.title) : null,
      description: r.description != null ? String(r.description) : null,
      start_at: String(r.start_at),
      end_at: String(r.end_at),
      timezone: r.timezone != null ? String(r.timezone) : null,
      location: r.location != null ? String(r.location) : null,
      metadata: meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {},
      cancelled_at: r.cancelled_at != null ? String(r.cancelled_at) : null,
      cancelled_by_user_id: r.cancelled_by_user_id != null ? String(r.cancelled_by_user_id) : null,
      cancellation_reason: r.cancellation_reason != null ? String(r.cancellation_reason) : null,
      created_by_user_id: r.created_by_user_id != null ? String(r.created_by_user_id) : null,
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  });
}

/** Full patient detail page bundle (tabs + slide-overs). Gate via CRM shell session before calling. */
export async function loadPatientDetailPayload(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<PatientDetailPayload | null> {
  const loaded: PatientProfileLoadResult = await loadPatientProfile(tenantId, patientId, client);
  if (!loaded.ok || loaded.mode !== "foundation") return null;

  const profile = loaded.data;
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = profile.foundationPatientId;
  const personId = profile.person.id;
  const nowIso = new Date().toISOString();

  const personLeadHistory = await loadPatientPersonLeadHistory(supabase, tid, personId, pid);

  const [personCrmActivity, consultationsRaw, bookingRows, assignees, scope, calendarSettings, voiceClinicalNotes] =
    await Promise.all([
      loadPersonCrmActivityForLeads(supabase, tid, pid, personLeadHistory),
      loadConsultationsForPatient(tid, pid, personId),
      loadPatientBookingRows(supabase, tid, pid),
      loadCrmShellStaffPickerOptions(tid),
      loadCrmShellScopePickerOptions(tid),
      loadTenantOperationalCalendarSettings(tid),
      loadClinicalNotesForPatient(tid, pid),
    ]);

  const bookingLikes: PatientDirectoryBookingLike[] = bookingRows.map((b) => ({
    id: b.id,
    start_at: b.start_at,
    booking_status: b.booking_status,
    booking_type: b.booking_type,
    title: b.title,
  }));
  const next = pickNextAppointment(bookingLikes, nowIso);

  const leadMetas = personLeadHistory.map(({ lead }) => lead.metadata ?? {});
  const lifetimeValueGbp = sumPatientLifetimeValueGbp(leadMetas);

  const consultations = mapPatientConsultationListItems(consultationsRaw, profile.clinicalDetails.row);
  const previousProcedures = parsePreviousProceduresFromClinical(profile.clinicalDetails.row);
  const primaryLead = pickPrimaryLeadForPatient(personLeadHistory);

  return {
    profile,
    displayName: personMetadataDisplayLabel(profile.person.metadata),
    personId,
    personLeadHistory,
    personCrmActivity,
    primaryLead,
    consultations,
    previousProcedures,
    nextAppointment: next
      ? {
          id: next.id,
          startAt: next.startAt,
          title: next.title,
          bookingType: bookingRows.find((b) => b.id === next.id)?.booking_type ?? "consultation",
          bookingStatus: bookingRows.find((b) => b.id === next.id)?.booking_status ?? "scheduled",
        }
      : null,
    treatmentPlanSummary: buildTreatmentPlanSummary(profile, consultations),
    lifetimeValueGbp,
    lifetimeValueLabel: formatPatientLifetimeValueGbp(lifetimeValueGbp),
    bookingRows,
    groupingNowIso: nowIso,
    assignees,
    clinics: scope.clinics,
    calendarTimezone: calendarSettings.calendarTimezone,
    voiceClinicalNotes,
  };
}
