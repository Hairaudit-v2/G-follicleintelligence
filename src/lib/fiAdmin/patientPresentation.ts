/**
 * PatientOS — clinic-facing presentation helpers (UI copy only; no loader changes).
 */

import type { PatientDirectorySummary } from "@/src/lib/patients/patientDirectoryLoader";
import type {
  PatientOsJourneyRow,
  PatientOsOverviewModel,
  PatientOsRecentPatientRow,
  PatientOsTimelineHighlight,
  PatientOsUpcomingBookingRow,
} from "@/src/lib/patients/patientOsDashboardLoader.server";

export const patientOsLinkButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-[#141C33]/60 px-3 py-2 text-sm font-medium text-[#E2E8F0] transition hover:border-cyan-400/35 hover:text-cyan-300 disabled:pointer-events-none disabled:opacity-40";

export type PatientHealthCard = {
  id: string;
  label: string;
  value: string;
  detail: string;
  href?: string;
};

export type PatientAttentionItem = {
  id: string;
  headline: string;
  detail?: string;
  href?: string;
  severity: "critical" | "warning" | "info";
  priorityScore: number;
};

export type PatientJourneyStageId =
  | "enquiry_converted"
  | "consultation_stage"
  | "treatment_planning"
  | "surgery_preparation"
  | "post_procedure_followup"
  | "outcome_audit_tracking";

export type ActivePatientJourneyItem = {
  id: string;
  patientId: string;
  displayName: string;
  journeyStage: PatientJourneyStageId;
  journeyStageLabel: string;
  nextStepLabel: string;
  clinicalStatus: string;
  operationalBlocker: string | null;
  linkedConsultation: boolean;
  linkedSurgery: boolean;
  linkedAudit: boolean;
  linkedMedia: boolean;
  patientHref: string;
  twinHref: string;
  bookingHref: string | null;
  consultationHref: string;
  caseHref: string | null;
  auditHref: string;
  primaryActionLabel: string;
  sortKey: string;
};

export type JourneyStageOverviewRow = {
  id: PatientJourneyStageId;
  label: string;
  count: number;
  interpretation: string;
};

export type FollowUpContinuityItem = {
  id: string;
  label: string;
  count: number;
  detail: string;
  href?: string;
};

export type PatientActivityItem = {
  id: string;
  patientName: string;
  activityLabel: string;
  occurredAt: string;
  whenLabel: string;
  href: string | null;
  sortKey: string;
};

const JOURNEY_STAGE_LABEL: Record<PatientJourneyStageId, string> = {
  enquiry_converted: "Enquiry converted",
  consultation_stage: "Consultation stage",
  treatment_planning: "Treatment planning",
  surgery_preparation: "Surgery preparation",
  post_procedure_followup: "Post-procedure follow-up",
  outcome_audit_tracking: "Outcome / audit tracking",
};

const AUDIT_EVENT_KIND_RE = /audit|outcome|report/i;

function plural(count: number, singular: string, pluralForm?: string): string {
  if (count === 1) return `1 ${singular}`;
  return `${count} ${pluralForm ?? `${singular}s`}`;
}

function patientsWithoutNextAppointment(summary: PatientDirectorySummary): number {
  return Math.max(
    0,
    summary.withActiveCase - Math.min(summary.withActiveCase, summary.withFutureBooking)
  );
}

function countMissingContactRecords(recentPatients: readonly PatientOsRecentPatientRow[]): number {
  return recentPatients.filter((p) => !p.email?.trim() && !p.phone?.trim()).length;
}

function countSurgeryPrepGaps(journeys: readonly PatientOsJourneyRow[]): number {
  return journeys.filter((j) => {
    const st = j.caseStatus.trim().toLowerCase();
    return st === "submitted" || st === "processing";
  }).length;
}

function countTreatmentPlanning(journeys: readonly PatientOsJourneyRow[]): number {
  return journeys.filter((j) => j.caseStatus.trim().toLowerCase() === "draft").length;
}

function countPostOpChecks(journeys: readonly PatientOsJourneyRow[]): number {
  return journeys.filter((j) => j.caseStatus.trim().toLowerCase() === "processing").length;
}

function countOutcomeAuditSignals(highlights: readonly PatientOsTimelineHighlight[]): number {
  return highlights.filter(
    (h) => AUDIT_EVENT_KIND_RE.test(h.eventKind) || AUDIT_EVENT_KIND_RE.test(h.title ?? "")
  ).length;
}

function upcomingBookingForPatient(
  patientId: string,
  bookings: readonly PatientOsUpcomingBookingRow[]
): PatientOsUpcomingBookingRow | null {
  return bookings.find((b) => b.patientId === patientId) ?? null;
}

function deriveJourneyStage(
  journey: PatientOsJourneyRow,
  booking: PatientOsUpcomingBookingRow | null
): PatientJourneyStageId {
  const st = journey.caseStatus.trim().toLowerCase();
  if (st === "draft") return booking ? "consultation_stage" : "treatment_planning";
  if (st === "submitted") return "surgery_preparation";
  if (st === "processing") return "post_procedure_followup";
  return "treatment_planning";
}

function nextStepForJourney(
  journey: PatientOsJourneyRow,
  booking: PatientOsUpcomingBookingRow | null
): string {
  if (booking) {
    return `Next visit: ${formatPatientWhen(booking.startAt)}${booking.title ? ` — ${booking.title}` : ""}`;
  }
  const st = journey.caseStatus.trim().toLowerCase();
  if (st === "draft") return "Complete treatment planning and confirm the next consultation.";
  if (st === "submitted") return "Finish surgery preparation and confirm pre-operative steps.";
  if (st === "processing") return "Schedule post-procedure follow-up and care continuity checks.";
  return "Review the patient journey and book the next step.";
}

function operationalBlockerForJourney(
  journey: PatientOsJourneyRow,
  booking: PatientOsUpcomingBookingRow | null
): string | null {
  if (!booking && journey.caseStatus.trim().toLowerCase() !== "complete") {
    return "No next appointment scheduled";
  }
  const st = journey.caseStatus.trim().toLowerCase();
  if (st === "submitted") return "Surgery preparation steps may be incomplete";
  return null;
}

function timelineActivityLabel(highlight: PatientOsTimelineHighlight): string {
  const kind = highlight.eventKind.trim().toLowerCase();
  if (kind.includes("consultation")) return "Consultation activity recorded";
  if (kind.includes("surgery") || kind.includes("case")) return "Surgery case activity recorded";
  if (kind.includes("audit") || kind.includes("report")) return "Audit report activity recorded";
  if (kind.includes("media") || kind.includes("photo") || kind.includes("image"))
    return "Photos uploaded";
  if (kind.includes("prescription") || kind.includes("medication")) return "Prescription issued";
  if (kind.includes("booking") || kind.includes("appointment") || kind.includes("follow")) {
    return "Follow-up booked";
  }
  return highlight.title?.trim() || "Patient journey activity recorded";
}

export function formatPatientWhen(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(d)
  );
}

export function formatPatientDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const d = Date.parse(iso.length === 10 ? `${iso}T12:00:00.000Z` : iso);
  if (!Number.isFinite(d)) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(d));
}

export function buildPatientJourneyHealthCards(
  base: string,
  overview: PatientOsOverviewModel,
  summary: PatientDirectorySummary
): PatientHealthCard[] {
  const { kpis } = overview;
  const missingContact = countMissingContactRecords(overview.recentPatients);
  const recordsAttention = missingContact + patientsWithoutNextAppointment(summary);

  return [
    {
      id: "active",
      label: "Active patients",
      value: String(summary.activePatients),
      detail:
        summary.activePatients > 0
          ? "Patients with an active care record in this clinic"
          : "No active patient journeys yet",
      href: `${base}/patients?view=list&status=active`,
    },
    {
      id: "recent",
      label: "Recently added",
      value: String(kpis.recentlyAddedPatients),
      detail:
        kpis.recentlyAddedPatients > 0
          ? "New patient records added in the last 30 days"
          : "No new patients in the last 30 days",
      href: `${base}/patients?view=list&sort=created_desc`,
    },
    {
      id: "consultations_pending",
      label: "Consultations pending",
      value: String(overview.upcomingBookings.length),
      detail:
        overview.upcomingBookings.length > 0
          ? "Upcoming patient visits on the calendar"
          : "No upcoming consultation or visit bookings",
      href: `${base}/consultations`,
    },
    {
      id: "surgery_pathway",
      label: "Surgery pathway patients",
      value: String(kpis.patientsWithActiveCases),
      detail:
        kpis.patientsWithActiveCases > 0
          ? "Patients with an open surgery case"
          : "No patients currently on the surgery pathway",
      href: `${base}/cases`,
    },
    {
      id: "followups",
      label: "Follow-ups due",
      value: String(kpis.patientsNeedingFollowUp),
      detail:
        kpis.patientsNeedingFollowUp > 0
          ? "Patients with overdue case follow-up dates"
          : "No overdue follow-ups right now",
      href: `${base}/doctor`,
    },
    {
      id: "records_attention",
      label: "Records needing attention",
      value: String(recordsAttention),
      detail:
        recordsAttention > 0
          ? "Missing contact details or active journeys without a next appointment"
          : "Patient records look complete for day-to-day coordination",
      href: `${base}/patients?view=list`,
    },
  ];
}

type AttentionCandidate = {
  id: string;
  count: number;
  priorityScore: number;
  severity: PatientAttentionItem["severity"];
  headline: (n: number) => string;
  detail?: string;
  href?: string;
};

export function buildPatientAttentionPriorities(
  base: string,
  overview: PatientOsOverviewModel,
  summary: PatientDirectorySummary,
  maxItems = 5
): PatientAttentionItem[] {
  const { kpis } = overview;
  const missingContact = countMissingContactRecords(overview.recentPatients);
  const withoutNextAppt = patientsWithoutNextAppointment(summary);
  const surgeryPrepGaps = countSurgeryPrepGaps(overview.activeJourneys);
  const draftJourneys = countTreatmentPlanning(overview.activeJourneys);

  const candidates: AttentionCandidate[] = [
    {
      id: "followups_due",
      count: kpis.patientsNeedingFollowUp,
      priorityScore: 96,
      severity: "critical",
      headline: (n) => plural(n, "patient", "patients") + " have follow-ups due",
      detail: "Review post-procedure care and book continuity checks in Doctor Workspace.",
      href: `${base}/doctor`,
    },
    {
      id: "missing_contact",
      count: missingContact,
      priorityScore: 90,
      severity: "warning",
      headline: (n) =>
        plural(n, "patient record", "patient records") + " need contact details updated",
      detail: "Confirm email and phone so the clinic can reach the patient.",
      href: `${base}/patients?view=list`,
    },
    {
      id: "consultation_completion",
      count: draftJourneys,
      priorityScore: 88,
      severity: "warning",
      headline: (n) => plural(n, "patient", "patients") + " need consultation completion",
      detail: "Open Consultations to finish assessment and treatment planning.",
      href: `${base}/consultations?view=list&status=draft`,
    },
    {
      id: "surgery_prep",
      count: surgeryPrepGaps,
      priorityScore: 84,
      severity: "warning",
      headline: (n) =>
        plural(n, "surgery-pathway patient", "surgery-pathway patients") +
        " may need preparation steps",
      detail: "Confirm pre-operative readiness in Surgery before procedure day.",
      href: `${base}/cases`,
    },
    {
      id: "no_next_appointment",
      count: withoutNextAppt,
      priorityScore: 82,
      severity: "info",
      headline: (n) => plural(n, "patient", "patients") + " are without a next appointment",
      detail: "Book the next consultation, review, or follow-up to keep care moving.",
      href: `${base}/bookings/new`,
    },
    {
      id: "upcoming_visits",
      count: overview.upcomingBookings.length,
      priorityScore: 76,
      severity: "info",
      headline: (n) => plural(n, "upcoming visit", "upcoming visits") + " need coordination",
      detail: "Confirm patient preparation before arrival.",
      href: `${base}/calendar`,
    },
  ];

  return candidates
    .filter((c) => c.count > 0)
    .sort((a, b) => b.priorityScore - a.priorityScore || b.count - a.count)
    .slice(0, maxItems)
    .map((c) => ({
      id: c.id,
      headline: c.headline(c.count),
      detail: c.detail,
      href: c.href,
      severity: c.severity,
      priorityScore: c.priorityScore,
    }));
}

export function hasUrgentPatientAttention(items: PatientAttentionItem[]): boolean {
  return items.some((i) => i.severity === "critical" || i.severity === "warning");
}

export function patientAttentionSeverityClass(severity: PatientAttentionItem["severity"]): string {
  if (severity === "critical") return "border-rose-500/25 bg-rose-500/[0.06]";
  if (severity === "warning") return "border-amber-500/20 bg-amber-500/[0.04]";
  return "border-white/[0.08] bg-[#0c1220]/60";
}

export function journeyStageBadgeClass(stage: PatientJourneyStageId): string {
  switch (stage) {
    case "consultation_stage":
      return "bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/30";
    case "treatment_planning":
      return "bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30";
    case "surgery_preparation":
      return "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30";
    case "post_procedure_followup":
      return "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/30";
    case "outcome_audit_tracking":
      return "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30";
    default:
      return "bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-500/30";
  }
}

export function buildActivePatientJourneyItems(
  base: string,
  overview: PatientOsOverviewModel,
  maxItems = 8
): ActivePatientJourneyItem[] {
  const items: ActivePatientJourneyItem[] = [];

  for (const journey of overview.activeJourneys) {
    const booking = upcomingBookingForPatient(journey.patientId, overview.upcomingBookings);
    const stage = deriveJourneyStage(journey, booking);
    const auditLinked = overview.timelineHighlights.some(
      (h) => h.patientId === journey.patientId && AUDIT_EVENT_KIND_RE.test(h.eventKind)
    );
    const mediaLinked = overview.timelineHighlights.some(
      (h) =>
        h.patientId === journey.patientId &&
        /media|photo|image/i.test(h.eventKind + (h.title ?? ""))
    );

    items.push({
      id: `${journey.patientId}-${journey.caseId}`,
      patientId: journey.patientId,
      displayName: journey.displayName,
      journeyStage: stage,
      journeyStageLabel: JOURNEY_STAGE_LABEL[stage],
      nextStepLabel: nextStepForJourney(journey, booking),
      clinicalStatus: journey.caseStatusLabel,
      operationalBlocker: operationalBlockerForJourney(journey, booking),
      linkedConsultation: stage === "consultation_stage" || stage === "treatment_planning",
      linkedSurgery: true,
      linkedAudit: auditLinked,
      linkedMedia: mediaLinked,
      patientHref: `${base}/patients/${journey.patientId}`,
      twinHref: `${base}/patients/${journey.patientId}/twin`,
      bookingHref: booking ? `${base}/appointments/${booking.bookingId}` : null,
      consultationHref: `${base}/consultations`,
      caseHref: `${base}/cases/${journey.caseId}`,
      auditHref: `${base}/audit`,
      primaryActionLabel: booking ? "Open appointment" : "Open patient",
      sortKey: journey.updatedAt,
    });
  }

  return items.sort((a, b) => b.sortKey.localeCompare(a.sortKey)).slice(0, maxItems);
}

export function buildJourneyStageOverview(
  overview: PatientOsOverviewModel,
  summary: PatientDirectorySummary
): JourneyStageOverviewRow[] {
  const enquiryConverted = Math.max(0, summary.activePatients - summary.withActiveCase);
  const consultationStage = overview.kpis.patientsWithUpcomingBookings;
  const treatmentPlanning = countTreatmentPlanning(overview.activeJourneys);
  const surgeryPreparation = countSurgeryPrepGaps(overview.activeJourneys);
  const postProcedure =
    overview.kpis.patientsNeedingFollowUp + countPostOpChecks(overview.activeJourneys);
  const outcomeAudit = countOutcomeAuditSignals(overview.timelineHighlights);

  return [
    {
      id: "enquiry_converted",
      label: JOURNEY_STAGE_LABEL.enquiry_converted,
      count: enquiryConverted,
      interpretation:
        enquiryConverted > 0
          ? "Patients engaged but not yet on an active surgery pathway"
          : "Most active patients are linked to a case or visit",
    },
    {
      id: "consultation_stage",
      label: JOURNEY_STAGE_LABEL.consultation_stage,
      count: consultationStage,
      interpretation:
        consultationStage > 0
          ? "Patients with a consultation or visit scheduled next"
          : "No consultation-stage patients with upcoming bookings",
    },
    {
      id: "treatment_planning",
      label: JOURNEY_STAGE_LABEL.treatment_planning,
      count: treatmentPlanning,
      interpretation:
        treatmentPlanning > 0
          ? "Cases in planning before surgery preparation"
          : "No open treatment-planning cases right now",
    },
    {
      id: "surgery_preparation",
      label: JOURNEY_STAGE_LABEL.surgery_preparation,
      count: surgeryPreparation,
      interpretation:
        surgeryPreparation > 0
          ? "Patients moving toward procedure day"
          : "No patients flagged for surgery preparation",
    },
    {
      id: "post_procedure_followup",
      label: JOURNEY_STAGE_LABEL.post_procedure_followup,
      count: postProcedure,
      interpretation:
        postProcedure > 0
          ? "Post-procedure checks and follow-up continuity to coordinate"
          : "Post-procedure follow-up queue is clear",
    },
    {
      id: "outcome_audit_tracking",
      label: JOURNEY_STAGE_LABEL.outcome_audit_tracking,
      count: outcomeAudit,
      interpretation:
        outcomeAudit > 0
          ? "Recent outcome or audit activity across patient journeys"
          : "Outcome tracking will appear as reports and media are linked",
    },
  ];
}

export function buildFollowUpContinuityItems(
  base: string,
  overview: PatientOsOverviewModel,
  summary: PatientDirectorySummary
): FollowUpContinuityItem[] {
  const withoutNextAppt = patientsWithoutNextAppointment(summary);
  const postOpChecks = countPostOpChecks(overview.activeJourneys);
  const medicationSignals = overview.timelineHighlights.filter((h) =>
    /prescription|medication|treatment review/i.test(h.eventKind + (h.title ?? ""))
  ).length;

  return [
    {
      id: "followups_due",
      label: "Follow-ups due",
      count: overview.kpis.patientsNeedingFollowUp,
      detail: "Overdue case follow-ups needing clinical review",
      href: `${base}/doctor`,
    },
    {
      id: "post_op_checks",
      label: "Post-op checks pending",
      count: postOpChecks,
      detail: "Active cases in post-procedure monitoring",
      href: `${base}/cases`,
    },
    {
      id: "medication_reviews",
      label: "Medication / treatment reviews due",
      count: medicationSignals,
      detail: "Recent prescribing activity to review for care continuity",
      href: `${base}/doctor`,
    },
    {
      id: "no_next_appointment",
      label: "Patients without next appointment",
      count: withoutNextAppt,
      detail: "Active journeys that still need a booked next step",
      href: `${base}/bookings/new`,
    },
  ].filter((item) => item.count > 0);
}

export function buildRecentPatientActivityItems(
  base: string,
  overview: PatientOsOverviewModel,
  maxItems = 8
): PatientActivityItem[] {
  const items: PatientActivityItem[] = [];

  for (const p of overview.recentPatients.slice(0, 4)) {
    items.push({
      id: `created-${p.patientId}`,
      patientName: p.displayName,
      activityLabel: "Patient record created or updated",
      occurredAt: p.lastActivityAt,
      whenLabel: formatPatientWhen(p.lastActivityAt),
      href: `${base}/patients/${p.patientId}`,
      sortKey: p.lastActivityAt,
    });
  }

  for (const h of overview.timelineHighlights) {
    items.push({
      id: `timeline-${h.id}`,
      patientName: h.patientDisplayName ?? "Patient",
      activityLabel: timelineActivityLabel(h),
      occurredAt: h.occurredAt,
      whenLabel: formatPatientWhen(h.occurredAt),
      href: h.patientId
        ? `${base}/patients/${h.patientId}`
        : h.caseId
          ? `${base}/cases/${h.caseId}`
          : null,
      sortKey: h.occurredAt,
    });
  }

  return items.sort((a, b) => b.sortKey.localeCompare(a.sortKey)).slice(0, maxItems);
}

export function patientDiagnosticCounts(
  overview: PatientOsOverviewModel,
  summary: PatientDirectorySummary
): {
  totalPatients: number;
  activePatients: number;
  recentPatientsLoaded: number;
  activeJourneysLoaded: number;
  upcomingBookingsLoaded: number;
  timelineHighlightsLoaded: number;
  withUpcomingBooking: number;
  withActiveCase: number;
  followUpsDue: number;
} {
  return {
    totalPatients: summary.totalPatients,
    activePatients: summary.activePatients,
    recentPatientsLoaded: overview.recentPatients.length,
    activeJourneysLoaded: overview.activeJourneys.length,
    upcomingBookingsLoaded: overview.upcomingBookings.length,
    timelineHighlightsLoaded: overview.timelineHighlights.length,
    withUpcomingBooking: summary.withFutureBooking,
    withActiveCase: summary.withActiveCase,
    followUpsDue: overview.kpis.patientsNeedingFollowUp,
  };
}

export function resolvePatientTwinShortcutHref(
  base: string,
  overview: PatientOsOverviewModel
): string {
  const patientId =
    overview.activeJourneys[0]?.patientId ?? overview.recentPatients[0]?.patientId ?? null;
  return patientId ? `${base}/patients/${patientId}/twin` : `${base}/patients?view=list`;
}
