/**
 * Surgery workflow presentation helpers — UI copy and layout derivations only.
 * Readiness Board, Procedure Day, and SurgeryOS share this layer (no loader changes).
 */

import type {
  ProcedureDayScheduleCard,
  ProcedureDayBoardPayload,
} from "@/src/lib/surgery/procedureDayBoardLoader.server";
import type {
  SurgeryReadinessBoardCard,
  SurgeryReadinessBoardPayload,
} from "@/src/lib/surgery/surgeryReadinessBoardLoader.server";
import {
  SURGERY_READINESS_ISSUE_LABEL,
  hasHighRiskSeverity,
  hasIssueKind,
  type SurgeryReadinessIssue,
  type SurgeryReadinessIssueKind,
} from "@/src/lib/surgery/surgeryReadinessBoardModel";
import type { SurgeryOsCommandCentrePayload } from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";

export const surgeryLinkButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-[#141C33]/60 px-3 py-2 text-sm font-medium text-[#E2E8F0] transition hover:border-[#22C1FF]/35 hover:text-[#22C1FF] disabled:pointer-events-none disabled:opacity-40";

export type SurgicalSnapshotCard = {
  id: string;
  label: string;
  value: number | string;
  detail: string;
  href?: string;
};

export type SurgicalPriorityItem = {
  id: string;
  headline: string;
  detail?: string;
  href?: string;
  severity: "critical" | "warning" | "info";
  priorityScore: number;
};

export type ClearanceChecklistGroup = {
  id: string;
  label: string;
  blockedCount: number;
  clearedCount: number;
};

export type UpcomingProcedureReadinessItem = {
  card: SurgeryReadinessBoardCard;
  readinessLabel: string;
  blockers: string[];
  nextAction: string;
  sortKey: string;
};

export type ProcedureDayFlowLaneId =
  | "scheduled"
  | "arrived_preparing"
  | "in_procedure"
  | "recovery_post_op"
  | "completed";

export type ProcedureDayFlowLane = {
  id: ProcedureDayFlowLaneId;
  label: string;
};

export type ProcedureDayFlowBoardItem = {
  card: ProcedureDayScheduleCard;
  laneId: ProcedureDayFlowLaneId;
  blockers: string[];
  nextAction: string;
  liveStatusLabel: string;
};

export type RoomTeamCoordinationRow = {
  id: string;
  patientLabel: string;
  roomLabel: string;
  teamLabel: string;
  readinessLabel: string;
  handoffLabel: string;
  href: string;
};

export type PostOpDischargeRow = {
  id: string;
  patientLabel: string;
  postOpReady: boolean;
  medicationHandoff: boolean;
  paymentCleared: boolean;
  auditReminder: boolean;
  href: string;
};

function plural(count: number, singular: string, pluralForm?: string): string {
  if (count === 1) return `1 ${singular}`;
  return `${count} ${pluralForm ?? `${singular}s`}`;
}

function displayIssues(issues: SurgeryReadinessIssue[]): SurgeryReadinessIssue[] {
  return issues.filter((i) => i.kind !== "no_payment_tracking");
}

function issueBlockerLabels(issues: SurgeryReadinessIssue[]): string[] {
  return displayIssues(issues).map((i) => SURGERY_READINESS_ISSUE_LABEL[i.kind]);
}

function severityRank(sev: SurgeryReadinessIssue["severity"]): number {
  if (sev === "high_risk") return 3;
  if (sev === "warning") return 2;
  return 1;
}

function maxIssueSeverity(issues: SurgeryReadinessIssue[]): SurgicalPriorityItem["severity"] {
  const rank = issues.reduce((max, i) => Math.max(max, severityRank(i.severity)), 0);
  if (rank >= 3) return "critical";
  if (rank === 2) return "warning";
  return "info";
}

export function surgicalAttentionSeverityClass(severity: SurgicalPriorityItem["severity"]): string {
  if (severity === "critical") return "border-rose-500/30 bg-rose-500/[0.08]";
  if (severity === "warning") return "border-amber-500/25 bg-amber-500/[0.07]";
  return "border-white/[0.08] bg-[#0c1220]/75";
}

export function readinessStatusLabel(card: SurgeryReadinessBoardCard): string {
  if (card.primaryColumn === "ready") return "Ready for surgery";
  if (card.primaryColumn === "high_risk") return "Blocked — high risk";
  if (card.primaryColumn === "missing_consent") return "Consent clearance needed";
  if (card.primaryColumn === "missing_pathology") return "Pathology clearance needed";
  if (card.primaryColumn === "on_hold_not_linked") return "Case link required";
  if (card.primaryColumn === "needs_attention") return "Preparation incomplete";
  return "Under review";
}

export function nextActionForReadinessCard(card: SurgeryReadinessBoardCard): string {
  const issues = displayIssues(card.issues);
  if (!card.caseId) return "Link a SurgeryOS case before clearance can continue.";
  if (hasIssueKind(issues, "missing_consent_proxy"))
    return "Obtain signed consent or quote acceptance.";
  if (hasIssueKind(issues, "missing_pathology")) return "Confirm pathology results are on file.";
  if (hasIssueKind(issues, "abnormal_pathology"))
    return "Doctor sign-off required for abnormal pathology.";
  if (hasIssueKind(issues, "surgery_deposit_pending"))
    return "Clear outstanding payment before surgery day.";
  if (hasIssueKind(issues, "missing_surgery_plan"))
    return "Complete the surgery plan and preparation forms.";
  if (hasIssueKind(issues, "booking_unconfirmed")) return "Confirm the booking with the patient.";
  if (
    card.clinicalStaffing?.displayStatus === "missing_roles" ||
    card.clinicalStaffing?.displayStatus === "blocked"
  ) {
    return "Resolve surgical team coverage for this procedure.";
  }
  if (card.primaryColumn === "ready") return "Monitor — procedure is cleared for surgery day.";
  return "Review clearance checklist and resolve remaining blockers.";
}

export function flattenReadinessCards(
  payload: SurgeryReadinessBoardPayload
): SurgeryReadinessBoardCard[] {
  return Object.values(payload.columns).flat();
}

export function buildReadinessSnapshotCards(
  base: string,
  payload: SurgeryReadinessBoardPayload
): SurgicalSnapshotCard[] {
  const { kpis } = payload;
  const all = flattenReadinessCards(payload);
  const blocked = all.filter(
    (c) => c.primaryColumn === "high_risk" || c.primaryColumn === "on_hold_not_linked"
  ).length;
  const consentForms = all.filter(
    (c) =>
      hasIssueKind(c.issues, "missing_consent_proxy") ||
      hasIssueKind(c.issues, "missing_surgery_plan")
  ).length;
  const paymentBlockers = all.filter((c) =>
    hasIssueKind(c.issues, "surgery_deposit_pending")
  ).length;
  const staffBlockers = all.filter(
    (c) =>
      c.clinicalStaffing?.displayStatus === "missing_roles" ||
      c.clinicalStaffing?.displayStatus === "blocked"
  ).length;

  return [
    {
      id: "upcoming",
      label: "Upcoming surgeries",
      value: kpis.upcomingNext14Days,
      detail: "Procedures in the next 14 days requiring preparation",
      href: `${base}/calendar`,
    },
    {
      id: "ready",
      label: "Ready for surgery",
      value: kpis.ready,
      detail: "Cleared for surgery day with no outstanding blockers",
    },
    {
      id: "blocked",
      label: "Blocked procedures",
      value: blocked,
      detail: "High-risk or unlinked cases that cannot proceed safely",
    },
    {
      id: "consent",
      label: "Consent / forms missing",
      value: consentForms,
      detail: "Consent proxy or surgery preparation forms still outstanding",
    },
    {
      id: "payment",
      label: "Payment blockers",
      value: paymentBlockers,
      detail: "Manual surgery payment records still expecting collection",
      href: `${base}/financial/dashboard`,
    },
    {
      id: "staff",
      label: "Staff / clinical blockers",
      value: staffBlockers,
      detail: "Surgical team coverage or clinical staffing gaps detected",
    },
  ];
}

type IssueAggregate = {
  kind: SurgeryReadinessIssueKind;
  count: number;
  severity: SurgicalPriorityItem["severity"];
  score: number;
};

function aggregateReadinessIssues(cards: SurgeryReadinessBoardCard[]): IssueAggregate[] {
  const map = new Map<SurgeryReadinessIssueKind, IssueAggregate>();
  for (const card of cards) {
    for (const issue of displayIssues(card.issues)) {
      const existing = map.get(issue.kind);
      const sev = maxIssueSeverity([issue]);
      const score = severityRank(issue.severity) * 10 + (issue.severity === "high_risk" ? 5 : 0);
      if (!existing) {
        map.set(issue.kind, { kind: issue.kind, count: 1, severity: sev, score });
      } else {
        existing.count += 1;
        existing.score = Math.max(existing.score, score);
        if (sev === "critical") existing.severity = "critical";
        else if (sev === "warning" && existing.severity === "info") existing.severity = "warning";
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.score - a.score || b.count - a.count);
}

const CLEARANCE_PRIORITY_HEADLINES: Partial<
  Record<SurgeryReadinessIssueKind, (n: number) => string>
> = {
  missing_consent_proxy: (n) => `${plural(n, "surgery", "surgeries")} missing signed consent`,
  surgery_deposit_pending: (n) =>
    `${plural(n, "patient", "patients")} ${n === 1 ? "has" : "have"} payment outstanding`,
  missing_surgery_plan: (n) =>
    `${plural(n, "case", "cases")} missing preparation or medication setup`,
  missing_pathology: (n) => `${plural(n, "case", "cases")} awaiting pathology clearance`,
  abnormal_pathology: (n) =>
    `Doctor sign-off required on ${plural(n, "pathology flag", "pathology flags")}`,
  missing_case_link: (n) => `${plural(n, "booking", "bookings")} not linked to a SurgeryOS case`,
  booking_unconfirmed: (n) => `${plural(n, "booking", "bookings")} still unconfirmed`,
  case_on_hold: (n) => `${plural(n, "case", "cases")} on hold`,
};

export function buildReadinessClearancePriorities(
  base: string,
  payload: SurgeryReadinessBoardPayload,
  limit = 5
): SurgicalPriorityItem[] {
  const cards = flattenReadinessCards(payload);
  const aggregates = aggregateReadinessIssues(cards);
  const staffBlocked = cards.filter(
    (c) =>
      c.clinicalStaffing?.displayStatus === "missing_roles" ||
      c.clinicalStaffing?.displayStatus === "blocked"
  ).length;

  const items: SurgicalPriorityItem[] = aggregates.map((a) => {
    const headlineFn = CLEARANCE_PRIORITY_HEADLINES[a.kind];
    const headline = headlineFn
      ? headlineFn(a.count)
      : `${plural(a.count, "procedure", "procedures")} — ${SURGERY_READINESS_ISSUE_LABEL[a.kind]}`;
    const sample = cards.find((c) => hasIssueKind(c.issues, a.kind));
    return {
      id: `readiness-${a.kind}`,
      headline,
      detail: sample ? `${sample.patientLabel} · ${sample.surgeryLocalYmd}` : undefined,
      href: sample?.hrefs.case ?? sample?.hrefs.appointments ?? `${base}/surgery-readiness`,
      severity: a.severity,
      priorityScore: a.score,
    };
  });

  if (staffBlocked > 0) {
    const sample = cards.find(
      (c) =>
        c.clinicalStaffing?.displayStatus === "missing_roles" ||
        c.clinicalStaffing?.displayStatus === "blocked"
    );
    items.push({
      id: "readiness-staff-coverage",
      headline: "Staff coverage issue detected",
      detail: sample
        ? `${plural(staffBlocked, "procedure", "procedures")} · ${sample.patientLabel}`
        : undefined,
      href: sample?.hrefs.appointments ?? `${base}/surgery-readiness`,
      severity: "warning",
      priorityScore: 20,
    });
  }

  return items.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, limit);
}

export function buildUpcomingProcedureReadinessList(
  payload: SurgeryReadinessBoardPayload
): UpcomingProcedureReadinessItem[] {
  const cards = flattenReadinessCards(payload);
  return cards
    .map((card) => ({
      card,
      readinessLabel: readinessStatusLabel(card),
      blockers: issueBlockerLabels(card.issues).slice(0, 4),
      nextAction: nextActionForReadinessCard(card),
      sortKey: `${card.surgeryLocalYmd}:${card.bookingTimeLabel}:${card.patientLabel}`,
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export function buildClearanceChecklistSummary(
  cards: SurgeryReadinessBoardCard[]
): ClearanceChecklistGroup[] {
  const count = (predicate: (c: SurgeryReadinessBoardCard) => boolean) => {
    const blocked = cards.filter(predicate).length;
    return { blockedCount: blocked, clearedCount: Math.max(0, cards.length - blocked) };
  };

  return [
    {
      id: "consent",
      label: "Consent",
      ...count((c) => hasIssueKind(c.issues, "missing_consent_proxy")),
    },
    {
      id: "payment",
      label: "Payment",
      ...count((c) => hasIssueKind(c.issues, "surgery_deposit_pending")),
    },
    {
      id: "forms",
      label: "Forms",
      ...count(
        (c) =>
          hasIssueKind(c.issues, "missing_surgery_plan") || hasIssueKind(c.issues, "case_on_hold")
      ),
    },
    {
      id: "pathology",
      label: "Pathology",
      ...count(
        (c) =>
          hasIssueKind(c.issues, "missing_pathology") ||
          hasIssueKind(c.issues, "abnormal_pathology")
      ),
    },
    {
      id: "medications",
      label: "Medications",
      ...count((c) => hasIssueKind(c.issues, "missing_surgery_plan")),
    },
    {
      id: "staff",
      label: "Staff",
      ...count(
        (c) =>
          c.clinicalStaffing?.displayStatus === "missing_roles" ||
          c.clinicalStaffing?.displayStatus === "blocked"
      ),
    },
    { id: "room", label: "Room", blockedCount: 0, clearedCount: cards.length },
    {
      id: "patient_instructions",
      label: "Patient instructions",
      ...count((c) => hasIssueKind(c.issues, "booking_unconfirmed")),
    },
  ];
}

export const PROCEDURE_DAY_FLOW_LANES: readonly ProcedureDayFlowLane[] = [
  { id: "scheduled", label: "Scheduled" },
  { id: "arrived_preparing", label: "Arrived / preparing" },
  { id: "in_procedure", label: "In procedure" },
  { id: "recovery_post_op", label: "Recovery / post-op" },
  { id: "completed", label: "Completed" },
] as const;

export function procedureDayFlowLaneForCard(
  card: ProcedureDayScheduleCard
): ProcedureDayFlowLaneId {
  const bst = card.bookingStatus.trim().toLowerCase();
  const ps = card.procedureProgress.statusRaw?.trim().toLowerCase() ?? "";

  if (bst === "completed" || ps === "completed" || card.pipelinePhase === "completed")
    return "completed";
  if (ps === "in_progress" && card.procedureProgress.finishTime) return "recovery_post_op";
  if (ps === "in_progress" || ps === "paused" || card.pipelinePhase === "in_progress")
    return "in_procedure";
  if (bst === "arrived" || ps === "checked_in") return "arrived_preparing";
  return "scheduled";
}

export function procedureDayLiveStatusLabel(card: ProcedureDayScheduleCard): string {
  const lane = procedureDayFlowLaneForCard(card);
  const map: Record<ProcedureDayFlowLaneId, string> = {
    scheduled: "Scheduled",
    arrived_preparing: "Preparing for theatre",
    in_procedure: "In procedure",
    recovery_post_op: "Recovery / post-op",
    completed: "Completed",
  };
  return map[lane];
}

export function nextActionForProcedureDayCard(card: ProcedureDayScheduleCard): string {
  const issues = displayIssues(card.issues);
  if (!card.caseId) return "Link a SurgeryOS case before surgical prep can continue.";
  if (hasHighRiskSeverity(issues))
    return "Resolve clearance blockers before starting the procedure.";
  const lane = procedureDayFlowLaneForCard(card);
  if (lane === "scheduled") return "Confirm patient arrival and begin surgical preparation.";
  if (lane === "arrived_preparing") return "Complete pre-op checklist and hand off to theatre.";
  if (lane === "in_procedure") return "Continue procedure documentation in SurgeryOS.";
  if (lane === "recovery_post_op") return "Complete post-op handoff and discharge readiness.";
  if (!card.preOp.surgeonAssigned) return "Assign surgeon and theatre team.";
  if (!card.preOp.roomOk) return "Assign theatre room before start.";
  return "Monitor live progress and update the surgical record.";
}

export function buildProcedureDaySnapshotCards(
  base: string,
  data: ProcedureDayBoardPayload
): SurgicalSnapshotCard[] {
  const flat = data.scheduleGroups.flatMap((g) => g.cards);
  const arrived = flat.filter((c) => {
    const bst = c.bookingStatus.toLowerCase();
    const ps = c.procedureProgress.statusRaw?.toLowerCase() ?? "";
    return bst === "arrived" || ps === "checked_in";
  }).length;
  const active = flat.filter((c) => procedureDayFlowLaneForCard(c) === "in_procedure").length;
  const recoveryCompleted = flat.filter((c) => {
    const lane = procedureDayFlowLaneForCard(c);
    return lane === "recovery_post_op" || lane === "completed";
  }).length;
  const blockers = flat.filter((c) => hasHighRiskSeverity(displayIssues(c.issues))).length;

  return [
    {
      id: "today",
      label: "Surgeries today",
      value: data.summary.surgeriesToday,
      detail: "Active surgery bookings on today's operational calendar",
    },
    {
      id: "arrived",
      label: "Patients arrived",
      value: arrived,
      detail: "Patients on-site and in surgical preparation",
    },
    {
      id: "active",
      label: "Procedures active",
      value: active,
      detail: "Cases currently in live surgical execution",
      href: `${base}/surgery-os`,
    },
    {
      id: "ready",
      label: "Cases ready",
      value: data.summary.ready,
      detail: "Scheduled cases cleared for theatre start",
    },
    {
      id: "blockers",
      label: "Blockers today",
      value: blockers,
      detail: "High-risk clearance issues on today's surgical list",
      href: `${base}/surgery-readiness`,
    },
    {
      id: "recovery",
      label: "Recovery / completed",
      value: recoveryCompleted,
      detail: "Cases in recovery or marked complete for the day",
    },
  ];
}

export function buildProcedureDayPriorities(
  base: string,
  data: ProcedureDayBoardPayload,
  limit = 5
): SurgicalPriorityItem[] {
  const flat = data.scheduleGroups.flatMap((g) => g.cards);
  const items: SurgicalPriorityItem[] = [];

  const waitingPrep = flat.filter((c) => procedureDayFlowLaneForCard(c) === "arrived_preparing");
  if (waitingPrep.length) {
    items.push({
      id: "pd-waiting-prep",
      headline: `${plural(waitingPrep.length, "patient", "patients")} waiting for surgical prep`,
      detail: waitingPrep[0]?.patientLabel,
      href: waitingPrep[0]?.hrefs.appointment,
      severity: "warning",
      priorityScore: 30,
    });
  }

  const clearanceBlocked = flat.filter((c) => hasHighRiskSeverity(displayIssues(c.issues)));
  if (clearanceBlocked.length) {
    items.push({
      id: "pd-clearance",
      headline: `${plural(clearanceBlocked.length, "procedure", "procedures")} blocked by missing clearance`,
      detail: clearanceBlocked[0]?.patientLabel,
      href: clearanceBlocked[0]?.hrefs.case ?? clearanceBlocked[0]?.hrefs.appointment,
      severity: "critical",
      priorityScore: 28,
    });
  }

  if (data.summary.unassignedSurgeonOrTeam > 0) {
    const sample = flat.find((c) => !c.calendarAssigneeLabel && !c.procedureSurgeonLabel);
    items.push({
      id: "pd-team",
      headline: "Team assignment incomplete",
      detail: sample
        ? `${data.summary.unassignedSurgeonOrTeam} cases · ${sample.patientLabel}`
        : undefined,
      href: sample?.hrefs.appointment ?? `${base}/procedure-day`,
      severity: "warning",
      priorityScore: 24,
    });
  }

  const graftIncomplete = flat.filter(
    (c) =>
      c.procedureProgress.rowExists &&
      c.procedureProgress.extractionImplantSummary &&
      !c.procedureProgress.extractionImplantSummary.toLowerCase().includes("balanced")
  );
  if (graftIncomplete.length) {
    items.push({
      id: "pd-graft",
      headline: "Graft reconciliation incomplete",
      detail: graftIncomplete[0]?.patientLabel,
      href: `${base}/surgery-os`,
      severity: "warning",
      priorityScore: 22,
    });
  }

  const handoffPending = flat.filter((c) => procedureDayFlowLaneForCard(c) === "recovery_post_op");
  if (handoffPending.length) {
    items.push({
      id: "pd-handoff",
      headline: "Post-op handoff pending",
      detail: handoffPending[0]?.patientLabel,
      href: handoffPending[0]?.hrefs.case ?? handoffPending[0]?.hrefs.appointment,
      severity: "info",
      priorityScore: 18,
    });
  }

  for (const action of data.actions.slice(0, 3)) {
    items.push({
      id: `pd-action-${action.kind}-${action.bookingId}`,
      headline: action.label,
      detail: action.patientLabel,
      href: action.href,
      severity: action.kind === "review_abnormal_pathology" ? "critical" : "warning",
      priorityScore: 16,
    });
  }

  return items.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, limit);
}

export function buildProcedureDayFlowBoardItems(
  cards: ProcedureDayScheduleCard[]
): ProcedureDayFlowBoardItem[] {
  return cards.map((card) => ({
    card,
    laneId: procedureDayFlowLaneForCard(card),
    blockers: issueBlockerLabels(card.issues).slice(0, 3),
    nextAction: nextActionForProcedureDayCard(card),
    liveStatusLabel: procedureDayLiveStatusLabel(card),
  }));
}

export function buildRoomTeamCoordination(
  cards: ProcedureDayScheduleCard[]
): RoomTeamCoordinationRow[] {
  return cards.map((c) => {
    const teamParts = [
      c.procedureSurgeonLabel,
      c.calendarAssigneeLabel,
      ...c.procedureTechnicianLabels,
    ].filter(Boolean);
    const staffingBlocked =
      c.clinicalStaffing?.displayStatus === "missing_roles" ||
      c.clinicalStaffing?.displayStatus === "blocked";
    return {
      id: c.bookingId,
      patientLabel: c.patientLabel,
      roomLabel: c.roomLabel ?? (c.preOp.roomOk ? "Assigned" : "Theatre needed"),
      teamLabel: teamParts.length ? teamParts.join(" · ") : "Team assignment needed",
      readinessLabel: staffingBlocked
        ? "Team coverage gap"
        : (c.readinessBucketLabel ?? "Monitoring"),
      handoffLabel: procedureDayLiveStatusLabel(c),
      href: c.hrefs.case ?? c.hrefs.appointment,
    };
  });
}

export function buildPostOpDischargeReadiness(
  cards: ProcedureDayScheduleCard[]
): PostOpDischargeRow[] {
  return cards
    .filter((c) => {
      const lane = procedureDayFlowLaneForCard(c);
      return lane === "recovery_post_op" || lane === "completed" || c.pipelinePhase === "completed";
    })
    .map((c) => ({
      id: c.bookingId,
      patientLabel: c.patientLabel,
      postOpReady: c.procedureProgress.rowExists && Boolean(c.procedureProgress.finishTime),
      medicationHandoff: c.preOp.procedurePlanComplete,
      paymentCleared: c.preOp.depositOkOrUntracked,
      auditReminder: !c.preOp.consentProxy || !c.preOp.pathologyReviewed,
      href: c.hrefs.case ?? c.hrefs.appointment,
    }));
}

export function buildSurgeryOsAttentionItems(
  payload: SurgeryOsCommandCentrePayload,
  base: string,
  limit = 5
): SurgicalPriorityItem[] {
  const items: SurgicalPriorityItem[] = [];

  for (const capture of payload.vieCapture ?? []) {
    for (const warning of capture.warnings) {
      items.push({
        id: `so-vie-${capture.surgeryId}-${warning.kind}-${warning.slotSlug ?? "general"}`,
        headline: warning.label,
        detail: `${capture.patientLabel} · ${capture.surgicalDocumentationPercent}% surgical documentation`,
        href: `${base}/surgery-os`,
        severity: warning.severity === "critical" ? "critical" : "warning",
        priorityScore: warning.severity === "critical" ? 28 : 16,
      });
    }
    if (capture.graftTrayStatus === "missing" || capture.graftTrayStatus === "partial") {
      items.push({
        id: `so-vie-graft-tray-${capture.surgeryId}`,
        headline: "Graft tray evidence incomplete",
        detail: capture.patientLabel,
        href: `${base}/surgery-os`,
        severity: "warning",
        priorityScore: 24,
      });
    }
  }

  for (const g of payload.graftSummary) {
    if (g.reconciliationStatus === "pending" || g.reconciliationStatus === "mismatch") {
      items.push({
        id: `so-graft-recon-${g.surgeryId}`,
        headline: "Graft count requires reconciliation",
        detail: `${g.patientLabel} · ${g.reconciliationStatusLabel}`,
        href: g.hrefs.surgery ?? `${base}/surgery-os`,
        severity: g.reconciliationStatus === "mismatch" ? "critical" : "warning",
        priorityScore: 30,
      });
    }
    if (g.implantedGrafts > 0 && g.extractedGrafts > g.implantedGrafts) {
      items.push({
        id: `so-graft-gap-${g.surgeryId}`,
        headline: "Implantation count below extraction count",
        detail: `${g.patientLabel} · ${g.implantedGrafts} implanted / ${g.extractedGrafts} extracted`,
        href: g.hrefs.surgery ?? `${base}/surgery-os`,
        severity: "warning",
        priorityScore: 26,
      });
    }
  }

  for (const snap of payload.readinessSnapshots) {
    const meds = snap.checklist.find((c) => c.key === "medication_prepared");
    if (meds && !meds.complete) {
      items.push({
        id: `so-meds-${snap.surgeryId}`,
        headline: "Medication record incomplete",
        detail: snap.patientLabel,
        href: snap.hrefs.case ?? snap.hrefs.surgery ?? `${base}/surgery-os`,
        severity: "warning",
        priorityScore: 22,
      });
    }
    const photo = snap.checklist.find((c) => c.key === "photography_complete");
    if (photo && !photo.complete) {
      items.push({
        id: `so-audit-photo-${snap.surgeryId}`,
        headline: "Audit photo reminder pending",
        detail: snap.patientLabel,
        href: snap.hrefs.case ?? `${base}/surgery-os`,
        severity: "info",
        priorityScore: 14,
      });
    }
  }

  const rolesBySurgery = new Map<string, Set<string>>();
  for (const t of payload.teamAssignments) {
    const set = rolesBySurgery.get(t.surgeryId) ?? new Set<string>();
    set.add(t.role);
    rolesBySurgery.set(t.surgeryId, set);
  }
  for (const s of payload.liveSurgeries) {
    const roles = rolesBySurgery.get(s.id);
    if (!roles?.size) {
      items.push({
        id: `so-team-${s.id}`,
        headline: "Team role missing",
        detail: s.patientLabel,
        href: s.hrefs.surgery ?? `${base}/surgery-os`,
        severity: "warning",
        priorityScore: 20,
      });
    }
  }

  for (const alert of payload.alerts) {
    items.push({
      id: `so-alert-${alert.id}`,
      headline: alert.title,
      detail: alert.detail,
      href: alert.href ?? `${base}/surgery-os`,
      severity:
        alert.severity === "critical" || alert.severity === "blocked" ? "critical" : "warning",
      priorityScore: alert.severity === "blocked" ? 32 : 18,
    });
  }

  return items.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, limit);
}

export function surgeryOsAttentionComplete(
  payload: SurgeryOsCommandCentrePayload,
  base: string
): boolean {
  return buildSurgeryOsAttentionItems(payload, base, 1).length === 0;
}
