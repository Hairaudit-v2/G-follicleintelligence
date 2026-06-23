/**
 * Doctor Workspace — clinical cockpit presentation helpers (UI copy only; no loader changes).
 */

import type { DoctorWorkspaceBundle } from "@/src/lib/doctorOs/doctorWorkspaceLoader.server";
import { MEDICATION_REORDER_STATUS_LABELS } from "@/src/lib/medicationReorder/medicationReorderTypes";
import type { FiPatientPrescriptionRow } from "@/src/lib/prescribing/fiPrescribingTypes";
import { PRESCRIPTION_STATUS_LABELS } from "@/src/lib/prescribing/fiPrescribingTypes";

export const doctorWorkspaceLinkButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-[#141C33]/60 px-3 py-2 text-sm font-medium text-[#E2E8F0] transition hover:border-emerald-400/35 hover:text-emerald-300 disabled:pointer-events-none disabled:opacity-40";

export type DoctorSnapshotCard = {
  id: string;
  label: string;
  value: number;
  detail: string;
  href?: string;
};

export type DoctorPriorityItem = {
  id: string;
  headline: string;
  detail?: string;
  href?: string;
  severity: "critical" | "warning" | "info";
  priorityScore: number;
};

export type DoctorPatientReviewItem = {
  id: string;
  patientName: string;
  visitType: string;
  clinicalStatus: string;
  treatmentPlanStatus: string;
  followUpDue: string | null;
  nextAction: string;
  patientHref: string;
  consultationHref: string | null;
  prescriptionHref: string | null;
  procedureHref: string | null;
  sortScore: number;
};

export type DoctorPrescriptionItem = {
  id: string;
  patientLabel: string;
  statusLabel: string;
  detail: string;
  href: string;
  tone: "default" | "warn" | "urgent";
  updatedAt: string;
};

export type DoctorPrescriptionWorkspaceModel = {
  awaitingApproval: DoctorPrescriptionItem[];
  inProgressDrafts: DoctorPrescriptionItem[];
  activePrescriptions: DoctorPrescriptionItem[];
  requiringRenewal: DoctorPrescriptionItem[];
  medicationAlerts: DoctorPrescriptionItem[];
  recentIssued: DoctorPrescriptionItem[];
  hasAnyActions: boolean;
};

export type DoctorTreatmentApprovalItem = {
  id: string;
  label: string;
  count: number;
  href: string;
};

export type DoctorTimelineItem = {
  id: string;
  timeLabel: string;
  label: string;
  href: string | null;
  sortKey: string;
};

function plural(count: number, singular: string, pluralForm?: string): string {
  if (count === 1) return `1 ${singular}`;
  return `${count} ${pluralForm ?? `${singular}s`}`;
}

function formatLocalTime(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return "—";
  return new Date(d).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatShortDate(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return "—";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const ACTIVE_PRESCRIPTION_STATUSES = new Set(["signed", "sent_to_pharmacy", "dispensed", "posted"]);

export function buildDoctorSnapshotCards(base: string, bundle: DoctorWorkspaceBundle): DoctorSnapshotCard[] {
  const patientsAwaitingReview =
    bundle.pendingConsultations.length +
    bundle.voiceNotesPendingApproval.length +
    bundle.prescriptionsAwaitingSignature.length;
  const consultationsToday = bundle.todayPatients.length;
  const prescriptionsPending = bundle.prescriptionsAwaitingSignature.length;
  const followUpsRequiringReview =
    (bundle.includeCrmTasks ? bundle.followUpTasks.length : 0) + bundle.medicationReorders.length;
  const proceduresSignOff = bundle.voiceNotesPendingApproval.length;
  const urgentAlerts =
    bundle.pharmacyQueue.filter((r) => r.status === "failed").length +
    bundle.prescriptionsAwaitingSignature.length +
    bundle.voiceNotesPendingApproval.length;

  return [
    {
      id: "patients_review",
      label: "Patients awaiting doctor review",
      value: patientsAwaitingReview,
      detail: "Consultations, voice notes, and prescriptions needing physician attention",
      href: `${base}/consultations`,
    },
    {
      id: "consultations_today",
      label: "Consultations scheduled today",
      value: consultationsToday,
      detail: "Patients booked for clinical review today",
      href: `${base}/calendar`,
    },
    {
      id: "prescriptions_pending",
      label: "Prescriptions pending approval",
      value: prescriptionsPending,
      detail: "Draft prescriptions ready for prescriber signature",
      href: `${base}/prescriptions`,
    },
    {
      id: "follow_ups",
      label: "Follow-ups requiring review",
      value: followUpsRequiringReview,
      detail: "Medication reorders and follow-up tasks awaiting clinical review",
      href: bundle.includeCrmTasks ? `${base}/crm` : `${base}/medication-reorders`,
    },
    {
      id: "procedures_signoff",
      label: "Procedures requiring sign-off",
      value: proceduresSignOff,
      detail: "Clinical notes and voice drafts awaiting physician approval",
    },
    {
      id: "urgent_alerts",
      label: "Urgent medical alerts",
      value: urgentAlerts,
      detail: "Failed pharmacy transmissions, unsigned prescriptions, and pending note approvals",
      href: `${base}/prescriptions`,
    },
  ];
}

type PriorityCandidate = {
  id: string;
  count: number;
  priorityScore: number;
  severity: DoctorPriorityItem["severity"];
  headline: (n: number) => string;
  detail?: string;
  href?: string;
};

export function buildDoctorPriorities(base: string, bundle: DoctorWorkspaceBundle, maxItems = 5): DoctorPriorityItem[] {
  const failedPharmacy = bundle.pharmacyQueue.filter((r) => r.status === "failed").length;
  const pendingPharmacy = bundle.pharmacyQueue.filter((r) => r.status === "pending").length;
  const reorderReview = bundle.medicationReorders.filter((r) => r.status === "doctor_review_required").length;

  const candidates: PriorityCandidate[] = [
    {
      id: "prescription_sign",
      count: bundle.prescriptionsAwaitingSignature.length,
      priorityScore: 98,
      severity: "critical",
      headline: (n) => plural(n, "prescription", "prescriptions") + " require physician approval",
      detail: "Draft is complete — sign to authorise medication.",
      href: `${base}/prescriptions`,
    },
    {
      id: "pharmacy_failed",
      count: failedPharmacy,
      priorityScore: 95,
      severity: "critical",
      headline: (n) => plural(n, "pharmacy transmission", "pharmacy transmissions") + " failed and need review",
      detail: "Open the prescription to retry or export for manual send.",
      href: `${base}/prescriptions`,
    },
    {
      id: "voice_notes",
      count: bundle.voiceNotesPendingApproval.length,
      priorityScore: 92,
      severity: "warning",
      headline: (n) => plural(n, "clinical note", "clinical notes") + " need physician review",
      detail: "Approve or edit AI voice drafts from the patient or case workspace.",
    },
    {
      id: "consultations",
      count: bundle.pendingConsultations.length,
      priorityScore: 88,
      severity: "warning",
      headline: (n) => plural(n, "consultation report", "consultation reports") + " need review",
      detail: "Complete draft or in-progress consultation documentation.",
      href: `${base}/consultations`,
    },
    {
      id: "medication_reorder",
      count: reorderReview || bundle.medicationReorders.length,
      priorityScore: 85,
      severity: "warning",
      headline: (n) => plural(n, "medication reorder", "medication reorders") + " require clinical review",
      detail: "Review patient medication renewal requests.",
      href: `${base}/medication-reorders`,
    },
    {
      id: "draft_in_progress",
      count: bundle.draftPrescriptionsInProgress.length,
      priorityScore: 78,
      severity: "info",
      headline: (n) => plural(n, "prescription draft", "prescription drafts") + " in progress",
      detail: "Add medication lines or confirm repeat rules before signing.",
      href: `${base}/prescriptions`,
    },
    {
      id: "pharmacy_pending",
      count: pendingPharmacy,
      priorityScore: 72,
      severity: "info",
      headline: (n) => plural(n, "prescription", "prescriptions") + " awaiting pharmacy send",
      detail: "Confirm pharmacy transmission or manual hand-off.",
      href: `${base}/prescriptions`,
    },
    {
      id: "follow_up_tasks",
      count: bundle.includeCrmTasks ? bundle.followUpTasks.length : 0,
      priorityScore: 68,
      severity: "info",
      headline: (n) => plural(n, "follow-up", "follow-ups") + " require review",
      detail: "CRM tasks due within the next two weeks.",
      href: `${base}/crm`,
    },
    {
      id: "today_patients",
      count: bundle.todayPatients.length,
      priorityScore: 55,
      severity: "info",
      headline: (n) => plural(n, "patient", "patients") + " scheduled for clinical review today",
      detail: "Review today's appointment list before rounds.",
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

export function hasUrgentDoctorPriorities(items: readonly DoctorPriorityItem[]): boolean {
  return items.some((i) => i.severity === "critical" || i.severity === "warning");
}

export function doctorAttentionSeverityClass(severity: DoctorPriorityItem["severity"]): string {
  switch (severity) {
    case "critical":
      return "border-rose-500/25 bg-rose-500/[0.06]";
    case "warning":
      return "border-amber-500/20 bg-amber-500/[0.04]";
    default:
      return "border-white/[0.08] bg-[#0c1220]/60";
  }
}

export function buildDoctorPatientReviewQueue(base: string, bundle: DoctorWorkspaceBundle, maxItems = 12): DoctorPatientReviewItem[] {
  const items: DoctorPatientReviewItem[] = [];

  for (const r of bundle.prescriptionsAwaitingSignature) {
    items.push({
      id: `rx-sign-${r.id}`,
      patientName: r.patientLabel,
      visitType: "Prescription",
      clinicalStatus: "Awaiting prescriber signature",
      treatmentPlanStatus: "Medication authorisation pending",
      followUpDue: null,
      nextAction: "Review and sign prescription",
      patientHref: `${base}/patients/${encodeURIComponent(r.patientId)}`,
      consultationHref: null,
      prescriptionHref: `${base}/prescriptions/${encodeURIComponent(r.id)}`,
      procedureHref: null,
      sortScore: 980,
    });
  }

  for (const n of bundle.voiceNotesPendingApproval) {
    items.push({
      id: `voice-${n.id}`,
      patientName: n.patientLabel,
      visitType: "Clinical note",
      clinicalStatus: "Voice draft pending approval",
      treatmentPlanStatus: "Documentation incomplete",
      followUpDue: null,
      nextAction: "Review and approve clinical note",
      patientHref: `${base}/patients/${encodeURIComponent(n.patientId)}`,
      consultationHref: null,
      prescriptionHref: null,
      procedureHref: n.caseId ? `${base}/cases/${encodeURIComponent(n.caseId)}` : null,
      sortScore: 920,
    });
  }

  for (const c of bundle.pendingConsultations) {
    items.push({
      id: `consult-${c.id}`,
      patientName: c.subject_line,
      visitType: c.consultation_type_label,
      clinicalStatus: c.status.replace(/_/g, " "),
      treatmentPlanStatus: "Consultation documentation in progress",
      followUpDue: null,
      nextAction: "Complete consultation report",
      patientHref: c.patient_id ? `${base}/patients/${encodeURIComponent(c.patient_id)}` : `${base}/consultations/${encodeURIComponent(c.id)}`,
      consultationHref: `${base}/consultations/${encodeURIComponent(c.id)}`,
      prescriptionHref: null,
      procedureHref: null,
      sortScore: 880,
    });
  }

  for (const r of bundle.medicationReorders) {
    items.push({
      id: `reorder-${r.id}`,
      patientName: r.patientLabel,
      visitType: "Medication renewal",
      clinicalStatus: MEDICATION_REORDER_STATUS_LABELS[r.status],
      treatmentPlanStatus: "Renewal review pending",
      followUpDue: formatShortDate(r.created_at),
      nextAction: "Review medication renewal request",
      patientHref: `${base}/patients/${encodeURIComponent(r.patient_id)}`,
      consultationHref: null,
      prescriptionHref: `${base}/prescriptions/${encodeURIComponent(r.source_prescription_id)}`,
      procedureHref: null,
      sortScore: 850,
    });
  }

  for (const p of bundle.todayPatients) {
    items.push({
      id: `today-${p.patientId}`,
      patientName: p.patientLabel,
      visitType: [p.bookingType.replace(/_/g, " "), p.bookingTitle].filter(Boolean).join(" · ") || "Appointment",
      clinicalStatus: "Scheduled today",
      treatmentPlanStatus: "Review before consultation",
      followUpDue: formatLocalTime(p.nextStartAt),
      nextAction: "Open patient record for today's visit",
      patientHref: `${base}/patients/${encodeURIComponent(p.patientId)}`,
      consultationHref: null,
      prescriptionHref: null,
      procedureHref: null,
      sortScore: 700,
    });
  }

  for (const r of bundle.draftPrescriptionsInProgress) {
    items.push({
      id: `rx-draft-${r.id}`,
      patientName: r.patientLabel,
      visitType: "Prescription draft",
      clinicalStatus: "Draft in progress",
      treatmentPlanStatus: "Medication lines incomplete",
      followUpDue: formatShortDate(r.updatedAt),
      nextAction: "Complete prescription draft",
      patientHref: `${base}/patients/${encodeURIComponent(r.patientId)}`,
      consultationHref: null,
      prescriptionHref: `${base}/prescriptions/${encodeURIComponent(r.id)}`,
      procedureHref: null,
      sortScore: 650,
    });
  }

  const seenPatients = new Set<string>();
  return items
    .sort((a, b) => b.sortScore - a.sortScore)
    .filter((item) => {
      const key = item.patientName.toLowerCase();
      if (seenPatients.has(key)) return false;
      seenPatients.add(key);
      return true;
    })
    .slice(0, maxItems);
}

export function buildDoctorPrescriptionWorkspace(
  base: string,
  bundle: DoctorWorkspaceBundle,
  recentPrescriptions: readonly FiPatientPrescriptionRow[],
  patientLabels: ReadonlyMap<string, string>,
): DoctorPrescriptionWorkspaceModel {
  const labelFor = (patientId: string) => patientLabels.get(patientId) ?? "Patient";

  const awaitingApproval: DoctorPrescriptionItem[] = bundle.prescriptionsAwaitingSignature.map((r) => ({
    id: r.id,
    patientLabel: r.patientLabel,
    statusLabel: "Pending approval",
    detail: "Draft complete — sign to authorise",
    href: `${base}/prescriptions/${encodeURIComponent(r.id)}`,
    tone: "urgent",
    updatedAt: r.updatedAt,
  }));

  const inProgressDrafts: DoctorPrescriptionItem[] = bundle.draftPrescriptionsInProgress.map((r) => ({
    id: r.id,
    patientLabel: r.patientLabel,
    statusLabel: "Draft in progress",
    detail: "Add lines or confirm repeat rules",
    href: `${base}/prescriptions/${encodeURIComponent(r.id)}`,
    tone: "warn",
    updatedAt: r.updatedAt,
  }));

  const medicationAlerts: DoctorPrescriptionItem[] = [
    ...bundle.pharmacyQueue
      .filter((r) => r.status === "failed")
      .map((r) => ({
        id: `pharm-fail-${r.transmissionId}`,
        patientLabel: r.patientLabel,
        statusLabel: "Pharmacy alert",
        detail: r.errorMessage ?? "Transmission failed — review and retry",
        href: `${base}/prescriptions/${encodeURIComponent(r.prescriptionId)}`,
        tone: "urgent" as const,
        updatedAt: r.updatedAt,
      })),
    ...bundle.medicationReorders
      .filter((r) => r.status === "doctor_review_required")
      .map((r) => ({
        id: `reorder-alert-${r.id}`,
        patientLabel: r.patientLabel,
        statusLabel: "Renewal review",
        detail: MEDICATION_REORDER_STATUS_LABELS[r.status],
        href: `${base}/medication-reorders`,
        tone: "warn" as const,
        updatedAt: r.created_at,
      })),
  ];

  const activePrescriptions: DoctorPrescriptionItem[] = recentPrescriptions
    .filter((r) => ACTIVE_PRESCRIPTION_STATUSES.has(r.status))
    .slice(0, 8)
    .map((r) => ({
      id: r.id,
      patientLabel: labelFor(r.patient_id),
      statusLabel: PRESCRIPTION_STATUS_LABELS[r.status],
      detail: r.pharmacy_name ? `Pharmacy: ${r.pharmacy_name}` : "Active medication order",
      href: `${base}/prescriptions/${encodeURIComponent(r.id)}`,
      tone: "default" as const,
      updatedAt: r.updated_at,
    }));

  const requiringRenewal: DoctorPrescriptionItem[] = recentPrescriptions
    .filter((r) => r.reorder_review_required)
    .slice(0, 6)
    .map((r) => ({
      id: `renewal-${r.id}`,
      patientLabel: labelFor(r.patient_id),
      statusLabel: "Renewal review",
      detail: "Patient medication may require physician review",
      href: `${base}/prescriptions/${encodeURIComponent(r.id)}`,
      tone: "warn" as const,
      updatedAt: r.updated_at,
    }));

  const recentIssued: DoctorPrescriptionItem[] = recentPrescriptions
    .filter((r) => r.status === "signed" || r.status === "sent_to_pharmacy")
    .slice(0, 6)
    .map((r) => ({
      id: `issued-${r.id}`,
      patientLabel: labelFor(r.patient_id),
      statusLabel: PRESCRIPTION_STATUS_LABELS[r.status],
      detail: r.signed_at ? `Signed ${formatShortDate(r.signed_at)}` : "Recently issued",
      href: `${base}/prescriptions/${encodeURIComponent(r.id)}`,
      tone: "default" as const,
      updatedAt: r.signed_at ?? r.updated_at,
    }));

  const hasAnyActions =
    awaitingApproval.length > 0 ||
    inProgressDrafts.length > 0 ||
    medicationAlerts.length > 0 ||
    requiringRenewal.length > 0 ||
    bundle.pharmacyQueue.some((r) => r.status === "pending");

  return {
    awaitingApproval,
    inProgressDrafts,
    activePrescriptions,
    requiringRenewal,
    medicationAlerts,
    recentIssued,
    hasAnyActions,
  };
}

export function buildDoctorTreatmentApprovals(base: string, bundle: DoctorWorkspaceBundle): DoctorTreatmentApprovalItem[] {
  const failedPharmacy = bundle.pharmacyQueue.filter((r) => r.status === "failed").length;

  const items: DoctorTreatmentApprovalItem[] = [
    {
      id: "treatment_plans",
      label: "Prescriptions awaiting physician approval",
      count: bundle.prescriptionsAwaitingSignature.length,
      href: `${base}/prescriptions`,
    },
    {
      id: "voice_notes",
      label: "Clinical notes awaiting approval",
      count: bundle.voiceNotesPendingApproval.length,
      href: `${base}/consultations`,
    },
    {
      id: "medication_auth",
      label: "Medication renewal authorisations",
      count: bundle.medicationReorders.filter((r) => r.status === "doctor_review_required").length,
      href: `${base}/medication-reorders`,
    },
    {
      id: "pharmacy_clearance",
      label: "Pharmacy transmission requiring review",
      count: failedPharmacy + bundle.pharmacyQueue.filter((r) => r.status === "pending").length,
      href: `${base}/prescriptions`,
    },
    {
      id: "consultations",
      label: "Consultation reports pending completion",
      count: bundle.pendingConsultations.length,
      href: `${base}/consultations`,
    },
  ];

  return items.filter((i) => i.count > 0).slice(0, 5);
}

export function buildDoctorClinicalTimeline(
  base: string,
  bundle: DoctorWorkspaceBundle,
  recentPrescriptions: readonly FiPatientPrescriptionRow[],
  patientLabels: ReadonlyMap<string, string>,
  maxItems = 8,
): DoctorTimelineItem[] {
  const events: DoctorTimelineItem[] = [];

  for (const c of bundle.pendingConsultations) {
    events.push({
      id: `tl-consult-${c.id}`,
      timeLabel: formatLocalTime(c.updated_at),
      label: `Consultation review pending — ${c.subject_line}`,
      href: `${base}/consultations/${encodeURIComponent(c.id)}`,
      sortKey: c.updated_at,
    });
  }

  for (const r of recentPrescriptions.filter((rx) => rx.status === "signed" || rx.status === "sent_to_pharmacy").slice(0, 5)) {
    events.push({
      id: `tl-rx-${r.id}`,
      timeLabel: formatLocalTime(r.signed_at ?? r.updated_at),
      label: `Prescription issued — ${patientLabels.get(r.patient_id) ?? "Patient"}`,
      href: `${base}/prescriptions/${encodeURIComponent(r.id)}`,
      sortKey: r.signed_at ?? r.updated_at,
    });
  }

  for (const r of bundle.pharmacyQueue) {
    events.push({
      id: `tl-pharm-${r.transmissionId}`,
      timeLabel: formatLocalTime(r.updatedAt),
      label:
        r.status === "failed"
          ? `Pharmacy alert — ${r.patientLabel}`
          : `Pharmacy send pending — ${r.patientLabel}`,
      href: `${base}/prescriptions/${encodeURIComponent(r.prescriptionId)}`,
      sortKey: r.updatedAt,
    });
  }

  for (const n of bundle.voiceNotesPendingApproval) {
    events.push({
      id: `tl-voice-${n.id}`,
      timeLabel: formatLocalTime(n.createdAt),
      label: `Clinical note review pending — ${n.patientLabel}`,
      href: n.caseId
        ? `${base}/cases/${encodeURIComponent(n.caseId)}`
        : `${base}/patients/${encodeURIComponent(n.patientId)}`,
      sortKey: n.createdAt,
    });
  }

  if (bundle.includeCrmTasks) {
    for (const t of bundle.followUpTasks.slice(0, 4)) {
      events.push({
        id: `tl-task-${t.id}`,
        timeLabel: t.dueAt ? formatLocalTime(t.dueAt) : "—",
        label: `Follow-up review — ${t.title}`,
        href: `${base}/crm/leads/${encodeURIComponent(t.leadId)}`,
        sortKey: t.dueAt ?? t.id,
      });
    }
  }

  return events.sort((a, b) => b.sortKey.localeCompare(a.sortKey)).slice(0, maxItems);
}

/** Raw counts for system diagnostics — operator view only. */
export function doctorWorkspaceDiagnosticCounts(bundle: DoctorWorkspaceBundle): Record<string, number> {
  return {
    todayPatients: bundle.todayPatients.length,
    pendingConsultations: bundle.pendingConsultations.length,
    draftPrescriptionsInProgress: bundle.draftPrescriptionsInProgress.length,
    prescriptionsAwaitingSignature: bundle.prescriptionsAwaitingSignature.length,
    pharmacyQueue: bundle.pharmacyQueue.length,
    pharmacyFailed: bundle.pharmacyQueue.filter((r) => r.status === "failed").length,
    medicationReorders: bundle.medicationReorders.length,
    followUpTasks: bundle.followUpTasks.length,
    voiceNotesPendingApproval: bundle.voiceNotesPendingApproval.length,
  };
}
