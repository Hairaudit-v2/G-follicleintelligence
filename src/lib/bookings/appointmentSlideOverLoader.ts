import "server-only";

import {
  loadSurgeryPlanForCase,
  type CaseSurgeryPlanRow,
} from "@/src/lib/cases/surgeryPlanningLoaders";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import {
  loadCrmShellPipelineStages,
  loadCrmShellScopePickerOptions,
} from "@/src/lib/crm/crmShellLoaders";
import { loadClinicalStaffPickerOptions } from "@/src/lib/staff/clinicalStaffPickerLoader.server";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import {
  loadCrmActivityTimelineForLead,
  loadCrmLeadById,
  loadCrmLeadConversionState,
  loadCrmLeadNotesForLead,
  loadCrmNotesForLead,
  loadCrmTasksForLead,
} from "@/src/lib/crm/server";
import { personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import type {
  CrmLeadConversionState,
  CrmShellClinicOption,
  FiCrmActivityEventRow,
  FiCrmLeadNoteRow,
  FiCrmLeadRow,
  FiCrmNoteRow,
  FiCrmPipelineStageRow,
  FiCrmTaskRow,
} from "@/src/lib/crm/types";
import { loadPatientImagesProfileBundle } from "@/src/lib/patientImages/patientImagesServer";
import type { PatientImagesProfileBundle } from "@/src/lib/patientImages/patientImageTypes";
import {
  loadPatientClinicalDetails,
  type PatientClinicalDetailsRow,
} from "@/src/lib/patients/clinicalDetailsServer";
import { formatClinicalScalesSummary } from "@/src/lib/patients/hairLossScales";
import { loadReminderJobsForAppointment } from "@/src/lib/reminders/reminderJobs.server";
import type { FiReminderJobWithTemplate } from "@/src/lib/reminders/reminderTypes";
import {
  buildAppointmentStatusHistory,
  parseAppointmentProcedureMetadata,
  parseInstructionsSent,
  type AppointmentInstructionsSentMetadata,
  type AppointmentProcedureMetadata,
  type AppointmentStatusHistoryEntry,
} from "./appointmentMetadata";
import { loadBookingsForLead, loadBookingsForPatient, loadBookingForTenant } from "./bookings";
import { appointmentTitleFromBooking } from "./appointmentDisplay";
import {
  parseAppointmentInvoicePreview,
  type AppointmentInvoicePreview,
} from "./appointmentInvoicePreview";
import {
  loadPostOpTrackingForCase,
  type CasePostOpTrackingRow,
} from "@/src/lib/cases/postOpLoaders";
import type { FiBookingRow } from "./types";
import type { ClinicalStaffingSummaryDto } from "@/src/lib/workforce-os/clinicalStaffingSummary.types";
import { loadBookingClinicalStaffingSummary } from "@/src/lib/workforce-os/workforceEventAssignmentBridge.server";

export type AppointmentSlideOverLeadAnchor = {
  lead: FiCrmLeadRow;
  personName: string;
  conversionState: CrmLeadConversionState | null;
};

export type AppointmentSlideOverTimeline = {
  events: FiCrmActivityEventRow[];
  tasks: FiCrmTaskRow[];
  notes: FiCrmNoteRow[];
  leadNotes: FiCrmLeadNoteRow[];
};

export type AppointmentSlideOverPayload = {
  booking: FiBookingRow;
  assignees: ClinicalStaffPickerOption[];
  clinics: CrmShellClinicOption[];
  reminderJobs: FiReminderJobWithTemplate[];
  clinicalScalesSummary: string | null;
  clinicalLine: string | null;
  clinicalDetails: PatientClinicalDetailsRow | null;
  patientImages: PatientImagesProfileBundle | null;
  procedure: AppointmentProcedureMetadata;
  statusHistory: AppointmentStatusHistoryEntry[];
  instructionsSent: AppointmentInstructionsSentMetadata;
  surgeryPlan: CaseSurgeryPlanRow | null;
  leadAnchor: AppointmentSlideOverLeadAnchor | null;
  /** Pipeline stages when the booking is linked to a lead (completion workflow). */
  pipelineStages: FiCrmPipelineStageRow[];
  timeline: AppointmentSlideOverTimeline;
  /** IANA zone for datetime-local fields (tenant clinic clock). */
  calendarTimezone: string;
  /** WorkforceOS Phase 2D — staffing readiness for this appointment. */
  clinicalStaffing: ClinicalStaffingSummaryDto;
};

export type AppointmentShellRelatedAppointmentItem = {
  id: string;
  title: string | null;
  booking_type: string;
  booking_status: string;
  start_at: string;
  end_at: string;
  updated_at: string;
};

export type AppointmentShellDetailPagePayload = AppointmentSlideOverPayload & {
  relatedAppointments: AppointmentShellRelatedAppointmentItem[];
  invoicePreview: AppointmentInvoicePreview;
  postOpTracking: CasePostOpTrackingRow | null;
};

function clinicalLineFromDetails(row: PatientClinicalDetailsRow | null): string | null {
  if (!row) return null;
  const parts: string[] = [];
  const concern = row.primary_concern?.trim() || row.primary_hair_concern?.trim();
  if (concern) parts.push(concern);
  if (row.treatment_interest?.trim()) parts.push(`Interest: ${row.treatment_interest.trim()}`);
  if (row.hair_loss_duration?.trim()) parts.push(`Duration: ${row.hair_loss_duration.trim()}`);
  return parts.length ? parts.join(" · ") : null;
}

async function loadClinicalScalesSummaryForPatient(
  tenantId: string,
  patientId: string
): Promise<string | null> {
  const row = await loadPatientClinicalDetails(tenantId, patientId);
  if (!row) return null;
  return formatClinicalScalesSummary({
    norwood_scale: row.norwood_scale,
    ludwig_scale: row.ludwig_scale,
    hairline_pattern: row.hairline_pattern,
    primary_concern: row.primary_concern ?? row.primary_hair_concern,
  });
}

/** Appointment (= booking) slide-over bundle. Gate via CRM shell session before calling. */
export async function loadAppointmentSlideOverPayload(
  tenantId: string,
  appointmentId: string
): Promise<AppointmentSlideOverPayload | null> {
  const booking = await loadBookingForTenant(tenantId, appointmentId);
  if (!booking) return null;

  const tid = tenantId.trim();
  const leadId = booking.lead_id?.trim() || null;
  const patientId = booking.patient_id?.trim() || null;
  const caseId = booking.case_id?.trim() || null;

  const [
    assignees,
    scope,
    calendarSettings,
    reminderJobs,
    lead,
    conversionState,
    pipelineStages,
    timelineBundle,
    clinicalDetails,
    clinicalScalesSummary,
    patientImages,
    surgeryPlan,
    clinicalStaffing,
  ] = await Promise.all([
    loadClinicalStaffPickerOptions(tid),
    loadCrmShellScopePickerOptions(tid),
    loadTenantOperationalCalendarSettings(tid),
    loadReminderJobsForAppointment(tid, booking.id, leadId),
    leadId ? loadCrmLeadById(leadId, tid) : Promise.resolve(null),
    leadId ? loadCrmLeadConversionState(tid, leadId) : Promise.resolve(null),
    leadId ? loadCrmShellPipelineStages(tid) : Promise.resolve([] as FiCrmPipelineStageRow[]),
    leadId
      ? Promise.all([
          loadCrmActivityTimelineForLead(tid, leadId, { limit: 80 }),
          loadCrmTasksForLead(tid, leadId, { limit: 40 }),
          loadCrmNotesForLead(tid, leadId, { limit: 40 }),
          loadCrmLeadNotesForLead(tid, leadId, { limit: 80 }),
        ]).then(([events, tasks, notes, leadNotes]) => ({ events, tasks, notes, leadNotes }))
      : Promise.resolve({ events: [], tasks: [], notes: [], leadNotes: [] }),
    patientId ? loadPatientClinicalDetails(tid, patientId) : Promise.resolve(null),
    patientId ? loadClinicalScalesSummaryForPatient(tid, patientId) : Promise.resolve(null),
    patientId ? loadPatientImagesProfileBundle(tid, patientId) : Promise.resolve(null),
    caseId ? loadSurgeryPlanForCase(tid, caseId) : Promise.resolve(null),
    loadBookingClinicalStaffingSummary(tid, booking, { syncExistingStaff: true }),
  ]);

  const meta = booking.metadata ?? {};
  let leadAnchor: AppointmentSlideOverLeadAnchor | null = null;
  if (lead) {
    const person = conversionState?.person;
    leadAnchor = {
      lead,
      personName: person ? personMetadataDisplayLabel(person.metadata) : "—",
      conversionState,
    };
  }

  return {
    booking,
    assignees,
    clinics: scope.clinics,
    calendarTimezone: calendarSettings.calendarTimezone,
    reminderJobs,
    clinicalScalesSummary,
    clinicalLine: clinicalLineFromDetails(clinicalDetails),
    clinicalDetails,
    patientImages,
    procedure: parseAppointmentProcedureMetadata(meta),
    statusHistory: buildAppointmentStatusHistory(booking),
    instructionsSent: parseInstructionsSent(meta),
    surgeryPlan,
    leadAnchor,
    pipelineStages,
    timeline: timelineBundle,
    clinicalStaffing,
  };
}

/** Other appointments for the same lead or patient (excludes `excludeAppointmentId`). */
export async function loadAppointmentShellRelatedAppointments(
  tenantId: string,
  booking: FiBookingRow,
  excludeAppointmentId: string,
  limit = 12
): Promise<AppointmentShellRelatedAppointmentItem[]> {
  const tid = tenantId.trim();
  const exclude = excludeAppointmentId.trim();
  let rows: FiBookingRow[] = [];
  const lid = booking.lead_id?.trim();
  const pid = booking.patient_id?.trim();
  if (lid) rows = await loadBookingsForLead(tid, lid);
  else if (pid) rows = await loadBookingsForPatient(tid, pid);

  return rows
    .filter((b) => b.id !== exclude)
    .sort((a, b) => Date.parse(b.start_at) - Date.parse(a.start_at))
    .slice(0, limit)
    .map((b) => ({
      id: b.id,
      title: appointmentTitleFromBooking(b),
      booking_type: b.booking_type,
      booking_status: b.booking_status,
      start_at: b.start_at,
      end_at: b.end_at,
      updated_at: b.updated_at,
    }));
}

/** Full appointment detail page: slide-over bundle + related appointments + invoice stub + post-op. */
export async function loadAppointmentShellDetailPagePayload(
  tenantId: string,
  appointmentId: string
): Promise<AppointmentShellDetailPagePayload | null> {
  const base = await loadAppointmentSlideOverPayload(tenantId, appointmentId);
  if (!base) return null;
  const caseId = base.booking.case_id?.trim() || null;
  const [relatedAppointments, postOpTracking] = await Promise.all([
    loadAppointmentShellRelatedAppointments(tenantId, base.booking, base.booking.id),
    caseId ? loadPostOpTrackingForCase(tenantId, caseId) : Promise.resolve(null),
  ]);
  return {
    ...base,
    relatedAppointments,
    invoicePreview: parseAppointmentInvoicePreview(base.booking),
    postOpTracking,
  };
}
