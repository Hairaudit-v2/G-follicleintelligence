/**
 * Sprint 8 — Staff-facing presentation helpers (pure, no I/O).
 * Humanizes labels, urgency, and journey progress for operational UI.
 */

import type { PatientJourneyState } from "@/src/lib/patientJourney/patientJourneyStateCore";
import type {
  ReceptionBoardActionAlert,
  ReceptionBoardAppointmentCard,
} from "@/src/lib/receptionBoard/receptionBoardTypes";

export type StaffUxPriority = "ready" | "attention" | "critical";

export const STAFF_UX_PRIORITY_STYLES: Record<
  StaffUxPriority,
  { border: string; badge: string; label: string }
> = {
  ready: {
    border: "border-emerald-500/35",
    badge: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
    label: "Ready",
  },
  attention: {
    border: "border-amber-500/35",
    badge: "bg-amber-500/15 text-amber-200 border-amber-500/30",
    label: "Needs attention",
  },
  critical: {
    border: "border-rose-500/40",
    badge: "bg-rose-500/15 text-rose-200 border-rose-500/35",
    label: "Critical blocker",
  },
};

export const PATIENT_JOURNEY_PIPELINE = [
  { id: "lead", label: "Lead" },
  { id: "consult", label: "Consult" },
  { id: "deposit", label: "Deposit" },
  { id: "surgery", label: "Surgery" },
  { id: "follow_up", label: "Follow-up" },
  { id: "completed", label: "Completed" },
] as const;

const JOURNEY_STATE_PIPELINE_INDEX: Partial<Record<PatientJourneyState, number>> = {
  lead: 0,
  consult_booked: 1,
  consult_completed: 1,
  treatment_recommended: 1,
  quote_sent: 2,
  quote_accepted: 2,
  deposit_paid: 2,
  surgery_booked: 3,
  pre_op_incomplete: 3,
  pre_op_ready: 3,
  procedure_day: 3,
  procedure_completed: 4,
  post_op_follow_up_due: 4,
  three_month_review_due: 4,
  six_month_review_due: 4,
  twelve_month_audit_due: 4,
  completed: 5,
  lost: 0,
  inactive: 0,
};

export function patientJourneyPipelineIndex(state: PatientJourneyState): number {
  return JOURNEY_STATE_PIPELINE_INDEX[state] ?? 0;
}

export function patientJourneyProgressPercent(state: PatientJourneyState): number {
  const idx = patientJourneyPipelineIndex(state);
  const max = PATIENT_JOURNEY_PIPELINE.length - 1;
  return Math.round((idx / max) * 100);
}

export function deriveReceptionAppointmentPriority(
  appt: Pick<
    ReceptionBoardAppointmentCard,
    "paymentStatus" | "confirmationStatus" | "status" | "appointmentType"
  >
): StaffUxPriority {
  if (appt.paymentStatus === "overdue") return "critical";
  const isSurgery = appt.appointmentType.toLowerCase().includes("surgery");
  if (isSurgery && appt.confirmationStatus === "unconfirmed") return "critical";
  if (appt.paymentStatus === "due") return "attention";
  if (appt.confirmationStatus === "unconfirmed") return "attention";
  if (appt.status === "waiting") return "attention";
  return "ready";
}

export type ReceptionNextAction = {
  label: string;
  href: string;
  variant: "primary" | "secondary";
};

export function deriveReceptionAppointmentNextAction(
  appt: ReceptionBoardAppointmentCard
): ReceptionNextAction | null {
  if (appt.paymentStatus === "overdue" || appt.paymentStatus === "due") {
    return {
      label: appt.paymentStatus === "overdue" ? "Collect payment now" : "Collect payment",
      href: appt.hrefs.patient ?? appt.hrefs.calendar,
      variant: "primary",
    };
  }
  if (
    appt.status === "scheduled" ||
    appt.status === "confirmed" ||
    appt.status === "arrived"
  ) {
    return {
      label: "Check in patient",
      href: appt.hrefs.calendar,
      variant: "primary",
    };
  }
  if (appt.confirmationStatus === "unconfirmed") {
    return {
      label: "Confirm appointment",
      href: appt.hrefs.calendar,
      variant: "secondary",
    };
  }
  return {
    label: "Open in calendar",
    href: appt.hrefs.calendar,
    variant: "secondary",
  };
}

const RECEPTION_ALERT_HUMAN: Record<string, { title: string; detail?: (d: string) => string }> = {
  missing_consent: {
    title: "Patient cannot proceed — consent form missing",
    detail: (d) => d || "Open the patient record to collect consent before surgery.",
  },
  missing_pre_op_checklist: {
    title: "Pre-op checklist incomplete",
    detail: (d) => d || "Complete the surgery readiness checklist before the procedure.",
  },
  missing_imaging: {
    title: "Clinical photos still needed",
    detail: (d) => d || "Upload before/after photos in the imaging workspace.",
  },
  surgery_readiness_incomplete: {
    title: "Surgery not ready — requirements missing",
    detail: (d) => d || "Review the readiness board and clear blockers.",
  },
  unconfirmed_surgery: {
    title: "Surgery missing assigned clinician",
    detail: (d) => d || "Assign a surgeon or nurse in the calendar.",
  },
  staff_not_assigned: {
    title: "No clinician assigned to this appointment",
    detail: (d) => d || "Assign staff in the calendar before the patient arrives.",
  },
};

export function humanizeReceptionActionAlert(alert: ReceptionBoardActionAlert): {
  title: string;
  detail: string;
  resolveLabel: string;
} {
  const mapped = RECEPTION_ALERT_HUMAN[alert.kind];
  if (mapped) {
    return {
      title: mapped.title,
      detail: mapped.detail?.(alert.detail) ?? alert.detail,
      resolveLabel: alert.href?.includes("readiness")
        ? "Fix in readiness board →"
        : "Resolve in calendar →",
    };
  }
  if (/consent/i.test(alert.title)) {
    return {
      title: "Patient cannot proceed — consent form missing",
      detail: alert.detail,
      resolveLabel: "Resolve in calendar →",
    };
  }
  if (/room/i.test(alert.title)) {
    return {
      title: "Please assign a room before the patient arrives",
      detail: alert.detail,
      resolveLabel: "Assign room in calendar →",
    };
  }
  return {
    title: alert.title,
    detail: alert.detail,
    resolveLabel: "Resolve in calendar →",
  };
}

export const BLOCKER_STAFF_LABELS: Record<string, string> = {
  missing_consent: "Consent form not signed — patient cannot proceed",
  unpaid_deposit: "Waiting for deposit payment",
  no_surgery_date: "Surgery date not scheduled yet",
  missing_images: "Clinical photos incomplete",
  incomplete_pre_op_checklist: "Pre-op checklist incomplete",
  missing_follow_up_booking: "Follow-up appointment not booked",
  missing_medical_clearance: "Medical clearance pending",
};

export function humanizePatientJourneyBlocker(kind: string, fallback: string): string {
  return BLOCKER_STAFF_LABELS[kind] ?? fallback;
}

export const SURGERY_REQUIREMENT_STAFF_LABELS: Record<string, string> = {
  "Select a patient.": "Choose a patient before continuing.",
  "Select a clinic.": "Choose which clinic site this surgery is at.",
  "Enter a procedure type.": "Enter the procedure type before continuing.",
  "Select a surgeon.": "Assign a surgeon before continuing.",
  "Select date and time.": "Pick a surgery date and start time.",
  "Select a procedure room.": "Please assign a surgical room before continuing.",
};

export function humanizeSurgeryBookingRequirement(message: string): string {
  return SURGERY_REQUIREMENT_STAFF_LABELS[message] ?? message;
}

export function calendarBookingTypeAccentClass(bookingType: string): string {
  const t = bookingType.trim().toLowerCase();
  if (t === "surgery") return "border-l-rose-500 bg-rose-950/30";
  if (t === "consultation") return "border-l-indigo-500 bg-indigo-950/25";
  if (t === "prp") return "border-l-emerald-500 bg-emerald-950/25";
  if (t.includes("exosome")) return "border-l-violet-500 bg-violet-950/25";
  if (t.includes("review") || t.includes("follow")) return "border-l-sky-500 bg-sky-950/25";
  return "border-l-slate-500 bg-slate-900/40";
}

export function humanizeStaffErrorMessage(raw: string): string {
  const s = raw.trim();
  if (!s) return "Something went wrong. Please try again.";
  if (/validation failed/i.test(s)) {
    return "This booking cannot continue because required information is missing.";
  }
  if (/crm mutation/i.test(s)) {
    return "We could not save that change. Please refresh and try again.";
  }
  if (/booking status invalid/i.test(s)) {
    return "This appointment status cannot be changed from here.";
  }
  if (/room must be assigned/i.test(s)) {
    return "Please assign a room before continuing.";
  }
  if (/not eligible/i.test(s)) {
    return "This room cannot be used for the selected procedure. Choose another room.";
  }
  if (/overlap/i.test(s)) {
    return "This time conflicts with another appointment. Choose a different time or clinician.";
  }
  return s;
}