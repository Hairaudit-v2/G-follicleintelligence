import type { PatientConsultationListItem } from "@/src/lib/patients/patientConsultations";
import type { PatientDetailNextAppointment } from "@/src/lib/patients/patientDetailLoader";
import type { PreviousProcedureRow } from "@/src/lib/patients/previousProcedures";

export type JourneyStatusTone = "neutral" | "info" | "warning" | "success";

export type PatientJourneyStatus = {
  label: string;
  tone: JourneyStatusTone;
  description: string;
};

/**
 * Deterministic mapping from available patient data to a clinical journey stage.
 * No AI, no fabricated values — reads real record state only.
 */
export function derivePatientJourneyStatus({
  totalLeads,
  consultations,
  nextAppointment,
  treatmentPlanSummary,
  previousProcedures,
  upcomingBookings,
  completedBookings,
}: {
  totalLeads: number;
  consultations: PatientConsultationListItem[];
  nextAppointment: PatientDetailNextAppointment | null;
  treatmentPlanSummary: string | null;
  previousProcedures: PreviousProcedureRow[];
  upcomingBookings: number;
  completedBookings: number;
}): PatientJourneyStatus {
  const hasProcedures = previousProcedures.length > 0;
  const statuses = new Set(consultations.map((c) => c.status));

  // Post-procedure patients — most advanced stage
  if (hasProcedures) {
    if (upcomingBookings > 0) {
      return {
        label: "Active treatment",
        tone: "success",
        description: "Patient has had procedures and upcoming appointments scheduled.",
      };
    }
    if (completedBookings > 0) {
      return {
        label: "Monitoring / follow-up",
        tone: "info",
        description: "Procedures completed — patient is in the follow-up phase.",
      };
    }
    return {
      label: "Post-procedure",
      tone: "neutral",
      description: "Previous procedures recorded. No upcoming appointments.",
    };
  }

  if (statuses.has("converted_to_case")) {
    return {
      label: "Procedure scheduled",
      tone: "success",
      description: "Consultation accepted and converted to case.",
    };
  }

  if (statuses.has("accepted")) {
    return {
      label: "Surgery readiness pending",
      tone: "info",
      description: "Consultation accepted — run surgery readiness before scheduling.",
    };
  }

  if (statuses.has("quoted")) {
    return {
      label: "Treatment planning",
      tone: "info",
      description: "Quote issued — patient considering treatment options.",
    };
  }

  if (statuses.has("completed")) {
    if (treatmentPlanSummary) {
      return {
        label: "Treatment planning",
        tone: "info",
        description: "Consultation completed and treatment direction documented.",
      };
    }
    return {
      label: "Consultation completed",
      tone: "success",
      description: "Initial consultation completed. Treatment plan not yet documented.",
    };
  }

  if (statuses.has("in_progress") || statuses.has("draft")) {
    return {
      label: "Consultation in progress",
      tone: "info",
      description: "Consultation opened but not yet completed.",
    };
  }

  if (nextAppointment) {
    return {
      label: "Appointment booked",
      tone: "info",
      description: "Upcoming appointment scheduled.",
    };
  }

  if (totalLeads > 0) {
    return {
      label: "Consultation pending",
      tone: "warning",
      description: "Enquiry received — consultation not yet booked.",
    };
  }

  if (completedBookings > 0) {
    return {
      label: "Dormant",
      tone: "neutral",
      description: "Patient has past visits but no recent activity.",
    };
  }

  return {
    label: "New enquiry",
    tone: "neutral",
    description: "Patient record created. No consultations or appointments on file.",
  };
}
