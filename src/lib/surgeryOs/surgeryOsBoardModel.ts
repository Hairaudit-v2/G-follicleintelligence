/**
 * SurgeryOS — pure model for live surgical command centre widgets.
 * Future-compatible with ImagingOS, HairAudit, IIOHR, and Surgical Intelligence layers.
 */

import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";

export const SURGERY_OS_DEFAULT_REFRESH_MS = 30_000;

export const SURGERY_OS_VIEWER_ROLES = [
  "coordinator",
  "surgeon",
  "theatre_manager",
  "admin",
] as const;
export type SurgeryOsViewerRole = (typeof SURGERY_OS_VIEWER_ROLES)[number];

export const SURGERY_OS_WIDGET_KEYS = [
  "live_surgery_board",
  "surgical_readiness_engine",
  "live_procedure_timeline",
  "team_assignment_board",
  "surgical_alerts",
  "surgical_notes_events",
  "live_graft_intelligence",
  "surgeon_performance_intelligence",
] as const;
export type SurgeryOsWidgetKey = (typeof SURGERY_OS_WIDGET_KEYS)[number];

export const SURGERY_OS_SEVERITIES = ["info", "warning", "critical", "blocked"] as const;
export type SurgeryOsSeverity = (typeof SURGERY_OS_SEVERITIES)[number];

export const SURGERY_OS_SEVERITY_LABELS: Record<SurgeryOsSeverity, string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
  blocked: "Blocked",
};

export const SURGERY_OS_LIVE_STATUSES = [
  "waiting",
  "active",
  "break",
  "delayed",
  "blocked",
  "completed",
] as const;
export type SurgeryOsLiveStatus = (typeof SURGERY_OS_LIVE_STATUSES)[number];

export const SURGERY_OS_LIVE_STATUS_LABELS: Record<SurgeryOsLiveStatus, string> = {
  waiting: "Waiting",
  active: "Active",
  break: "Break",
  delayed: "Delayed",
  blocked: "Blocked",
  completed: "Completed",
};

export const SURGERY_OS_PROCEDURE_PHASES = [
  "pre_op",
  "patient_arrived",
  "design",
  "anaesthetic",
  "extraction",
  "extraction_paused",
  "break",
  "site_making",
  "implantation",
  "recovery",
  "completed",
] as const;
export type SurgeryOsProcedurePhase = (typeof SURGERY_OS_PROCEDURE_PHASES)[number];

export const SURGERY_OS_PROCEDURE_PHASE_LABELS: Record<SurgeryOsProcedurePhase, string> = {
  pre_op: "Pre-op",
  patient_arrived: "Patient arrived",
  design: "Design",
  anaesthetic: "Anaesthetic",
  extraction: "Extraction",
  extraction_paused: "Extraction paused",
  break: "Break",
  site_making: "Site making",
  implantation: "Implantation",
  recovery: "Recovery",
  completed: "Completed",
};

export const SURGERY_OS_READINESS_CHECKLIST_KEYS = [
  "deposit_paid",
  "consent_signed",
  "photography_complete",
  "bloods_complete",
  "medication_prepared",
  "prp_prepared",
  "exosomes_prepared",
  "staff_assigned",
  "consumables_ready",
] as const;
export type SurgeryOsReadinessChecklistKey = (typeof SURGERY_OS_READINESS_CHECKLIST_KEYS)[number];

export const SURGERY_OS_READINESS_CHECKLIST_LABELS: Record<SurgeryOsReadinessChecklistKey, string> =
  {
    deposit_paid: "Deposit paid",
    consent_signed: "Consent signed",
    photography_complete: "Photography complete",
    bloods_complete: "Bloods complete",
    medication_prepared: "Medication prepared",
    prp_prepared: "PRP prepared",
    exosomes_prepared: "Exosomes prepared",
    staff_assigned: "Staff assigned",
    consumables_ready: "Consumables ready",
  };

export const SURGERY_OS_READINESS_RISK_LEVELS = ["low", "medium", "high", "blocked"] as const;
export type SurgeryOsReadinessRiskLevel = (typeof SURGERY_OS_READINESS_RISK_LEVELS)[number];

export const SURGERY_OS_READINESS_RISK_LABELS: Record<SurgeryOsReadinessRiskLevel, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
  blocked: "Blocked",
};

export const SURGERY_OS_PROCEDURE_EVENT_KINDS = [
  "patient_arrived",
  "design_approved",
  "anaesthetic_complete",
  "extraction_started",
  "extraction_paused",
  "extraction_resumed",
  "break",
  "break_started",
  "break_ended",
  "site_making_started",
  "implantation_started",
  "procedure_completed",
  "phase_transition",
  "custom",
  "graft_count_update",
  "tray_count_recorded",
  "graft_reconciliation_completed",
  "graft_correction",
] as const;
export type SurgeryOsProcedureEventKind = (typeof SURGERY_OS_PROCEDURE_EVENT_KINDS)[number];

export const SURGERY_OS_PROCEDURE_EVENT_LABELS: Record<SurgeryOsProcedureEventKind, string> = {
  patient_arrived: "Patient arrived",
  design_approved: "Design approved",
  anaesthetic_complete: "Anaesthetic complete",
  extraction_started: "Extraction started",
  extraction_paused: "Extraction paused",
  extraction_resumed: "Extraction resumed",
  break: "Break",
  break_started: "Break started",
  break_ended: "Break ended",
  site_making_started: "Site making started",
  implantation_started: "Implantation started",
  procedure_completed: "Procedure completed",
  phase_transition: "Phase transition",
  custom: "Custom event",
  graft_count_update: "Graft count update",
  tray_count_recorded: "Tray count recorded",
  graft_reconciliation_completed: "Graft reconciliation completed",
  graft_correction: "Graft correction",
};

export const SURGERY_OS_TEAM_ROLES = ["surgeon", "nurse", "technician"] as const;
export type SurgeryOsTeamRole = (typeof SURGERY_OS_TEAM_ROLES)[number];

export const SURGERY_OS_TEAM_ROLE_LABELS: Record<SurgeryOsTeamRole, string> = {
  surgeon: "Surgeon",
  nurse: "Nurse",
  technician: "Technician",
};

export const SURGERY_OS_ASSIGNMENT_STATUSES = [
  "assigned",
  "confirmed",
  "checked_in",
  "active",
  "break",
  "unavailable",
  "completed",
] as const;
export type SurgeryOsAssignmentStatus = (typeof SURGERY_OS_ASSIGNMENT_STATUSES)[number];

export const SURGERY_OS_ASSIGNMENT_STATUS_LABELS: Record<SurgeryOsAssignmentStatus, string> = {
  assigned: "Assigned",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  active: "Active",
  break: "On break",
  unavailable: "Unavailable",
  completed: "Completed",
};

export const SURGERY_OS_ALERT_KINDS = [
  "missing_consent",
  "missing_medication",
  "procedure_delayed",
  "staff_unavailable",
  "readiness_blocked",
  "graft_count_behind_target",
  "graft_extracted_implanted_mismatch",
  "graft_discarded_above_threshold",
  "graft_average_hairs_low",
  "graft_target_exceeded",
  "graft_reconciliation_incomplete",
  "graft_pending_tray_review",
  "graft_correction_above_threshold",
] as const;
export type SurgeryOsAlertKind = (typeof SURGERY_OS_ALERT_KINDS)[number];

export const SURGERY_OS_ALERT_LABELS: Record<SurgeryOsAlertKind, string> = {
  missing_consent: "Missing consent",
  missing_medication: "Missing medication",
  procedure_delayed: "Procedure delayed",
  staff_unavailable: "Staff unavailable",
  readiness_blocked: "Readiness blocked",
  graft_count_behind_target: "Graft count behind target",
  graft_extracted_implanted_mismatch: "Extracted/implanted mismatch",
  graft_discarded_above_threshold: "Discarded grafts above threshold",
  graft_average_hairs_low: "Average hairs/graft low",
  graft_target_exceeded: "Target grafts exceeded",
  graft_reconciliation_incomplete: "Reconciliation incomplete",
  graft_pending_tray_review: "Trays awaiting nurse review",
  graft_correction_above_threshold: "Large graft correction logged",
};

export const SURGERY_OS_NOTE_KINDS = [
  "medication_administered",
  "patient_discomfort",
  "bleeding_event",
  "anaesthetic_top_up",
  "graft_issue",
  "equipment_issue",
  "complication_note",
  "general",
] as const;
export type SurgeryOsNoteKind = (typeof SURGERY_OS_NOTE_KINDS)[number];

export const SURGERY_OS_NOTE_KIND_LABELS: Record<SurgeryOsNoteKind, string> = {
  medication_administered: "Medication administered",
  patient_discomfort: "Patient discomfort",
  bleeding_event: "Bleeding event",
  anaesthetic_top_up: "Anaesthetic top-up",
  graft_issue: "Graft issue",
  equipment_issue: "Equipment issue",
  complication_note: "Complication note",
  general: "General note",
};

export const SURGERY_OS_PERSONA_WIDGET_DEFAULTS: Record<
  SurgeryOsViewerRole,
  readonly SurgeryOsWidgetKey[]
> = {
  coordinator: [
    "live_surgery_board",
    "surgical_readiness_engine",
    "surgical_alerts",
    "team_assignment_board",
    "live_graft_intelligence",
  ],
  surgeon: [
    "live_surgery_board",
    "live_graft_intelligence",
    "live_procedure_timeline",
    "surgical_notes_events",
    "surgical_alerts",
  ],
  theatre_manager: SURGERY_OS_WIDGET_KEYS,
  admin: SURGERY_OS_WIDGET_KEYS,
};

export const SURGERY_OS_WORKSPACE_PROFILE_TO_PERSONA: Partial<
  Record<FiWorkspaceProfileKey, SurgeryOsViewerRole>
> = {
  clinic_manager: "theatre_manager",
  director: "admin",
  platform_admin: "admin",
  consultant: "surgeon",
  reception: "coordinator",
};

export function resolveSurgeryOsPersonaFromWorkspaceProfile(
  profile: FiWorkspaceProfileKey
): SurgeryOsViewerRole | null {
  return SURGERY_OS_WORKSPACE_PROFILE_TO_PERSONA[profile] ?? null;
}

export type SurgeryOsReadinessChecklist = Partial<Record<SurgeryOsReadinessChecklistKey, boolean>>;

export function computeReadinessPercent(checklist: SurgeryOsReadinessChecklist): number {
  const keys = SURGERY_OS_READINESS_CHECKLIST_KEYS as readonly SurgeryOsReadinessChecklistKey[];
  const complete = keys.filter((k) => checklist[k] === true).length;
  return Math.round((complete / keys.length) * 100);
}

export function computeReadinessRiskLevel(
  checklist: SurgeryOsReadinessChecklist,
  percent: number
): SurgeryOsReadinessRiskLevel {
  if (!checklist.consent_signed || !checklist.deposit_paid) return "blocked";
  if (percent >= 90) return "low";
  if (percent >= 70) return "medium";
  if (percent >= 50) return "high";
  return "blocked";
}

export function compareSurgeryOsSeverity(a: SurgeryOsSeverity, b: SurgeryOsSeverity): number {
  const rank: Record<SurgeryOsSeverity, number> = { info: 1, warning: 2, critical: 3, blocked: 4 };
  return rank[b] - rank[a];
}

export function visibleWidgetsForSurgeryOsRole(
  role: SurgeryOsViewerRole
): readonly SurgeryOsWidgetKey[] {
  return SURGERY_OS_PERSONA_WIDGET_DEFAULTS[role] ?? SURGERY_OS_WIDGET_KEYS;
}

export function isSurgeryOsViewerRole(v: string): v is SurgeryOsViewerRole {
  return (SURGERY_OS_VIEWER_ROLES as readonly string[]).includes(v);
}

export function isSurgeryOsSeverity(v: string): v is SurgeryOsSeverity {
  return (SURGERY_OS_SEVERITIES as readonly string[]).includes(v);
}

export function assertSurgeryOsTenantRowScope(
  expectedTenantId: string,
  rowTenantId: string,
  entity: string
): void {
  const expected = expectedTenantId.trim();
  const actual = rowTenantId.trim();
  if (!expected || !actual || expected !== actual) {
    throw new Error(
      `SurgeryOS tenant scope violation for ${entity}: expected ${expected}, got ${actual || "empty"}.`
    );
  }
}

export function primarySurgeryRecordHref(hrefs: {
  patient?: string | null;
  case?: string | null;
  surgery?: string | null;
  calendar?: string | null;
}): string | null {
  return hrefs.surgery ?? hrefs.case ?? hrefs.patient ?? hrefs.calendar ?? null;
}

export function deriveSurgeryAlerts(input: {
  surgeryId: string;
  patientLabel: string;
  checklist: SurgeryOsReadinessChecklist;
  readinessRiskLevel: SurgeryOsReadinessRiskLevel;
  liveStatus: SurgeryOsLiveStatus;
  scheduledStartAt: string | null;
  nowMs: number;
  teamUnavailableCount: number;
  hrefs: { patient: string | null; case: string | null; surgery: string | null };
}): Array<{
  id: string;
  kind: SurgeryOsAlertKind;
  title: string;
  detail: string;
  severity: SurgeryOsSeverity;
  surgeryId: string;
  href: string | null;
}> {
  const alerts: Array<{
    id: string;
    kind: SurgeryOsAlertKind;
    title: string;
    detail: string;
    severity: SurgeryOsSeverity;
    surgeryId: string;
    href: string | null;
  }> = [];

  const href = primarySurgeryRecordHref(input.hrefs);

  if (!input.checklist.consent_signed) {
    alerts.push({
      id: `${input.surgeryId}:missing_consent`,
      kind: "missing_consent",
      title: "Consent not signed",
      detail: `${input.patientLabel} — surgery cannot proceed without signed consent.`,
      severity: "blocked",
      surgeryId: input.surgeryId,
      href,
    });
  }

  if (!input.checklist.medication_prepared) {
    alerts.push({
      id: `${input.surgeryId}:missing_medication`,
      kind: "missing_medication",
      title: "Medication not prepared",
      detail: `${input.patientLabel} — theatre medication prep incomplete.`,
      severity: "critical",
      surgeryId: input.surgeryId,
      href,
    });
  }

  if (input.readinessRiskLevel === "blocked") {
    alerts.push({
      id: `${input.surgeryId}:readiness_blocked`,
      kind: "readiness_blocked",
      title: "Readiness blocked",
      detail: `${input.patientLabel} — pre-operative checklist blocking theatre start.`,
      severity: "blocked",
      surgeryId: input.surgeryId,
      href,
    });
  }

  if (input.liveStatus === "delayed") {
    alerts.push({
      id: `${input.surgeryId}:procedure_delayed`,
      kind: "procedure_delayed",
      title: "Procedure delayed",
      detail: `${input.patientLabel} — live status flagged as delayed.`,
      severity: "warning",
      surgeryId: input.surgeryId,
      href,
    });
  } else if (input.scheduledStartAt) {
    const startMs = Date.parse(input.scheduledStartAt);
    if (
      Number.isFinite(startMs) &&
      input.nowMs > startMs + 30 * 60_000 &&
      input.liveStatus === "waiting"
    ) {
      alerts.push({
        id: `${input.surgeryId}:procedure_delayed`,
        kind: "procedure_delayed",
        title: "Procedure delayed",
        detail: `${input.patientLabel} — scheduled start exceeded by 30+ minutes.`,
        severity: "warning",
        surgeryId: input.surgeryId,
        href,
      });
    }
  }

  if (input.teamUnavailableCount > 0) {
    alerts.push({
      id: `${input.surgeryId}:staff_unavailable`,
      kind: "staff_unavailable",
      title: "Staff unavailable",
      detail: `${input.patientLabel} — ${input.teamUnavailableCount} team member(s) marked unavailable.`,
      severity: input.teamUnavailableCount >= 2 ? "critical" : "warning",
      surgeryId: input.surgeryId,
      href,
    });
  }

  return alerts.sort((a, b) => compareSurgeryOsSeverity(a.severity, b.severity));
}
