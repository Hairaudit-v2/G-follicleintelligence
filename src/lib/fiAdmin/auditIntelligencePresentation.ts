/**
 * Audit Intelligence — clinic-facing presentation helpers (UI copy only; no loader changes).
 */

import type {
  AuditActivityRow,
  AuditDashboardKpis,
  AuditDashboardSnapshot,
  AuditPipelineSnapshot,
  AuditQueueItem,
} from "@/src/lib/fiAdmin/auditDashboardTypes";

export const auditOsLinkButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-[#141C33]/60 px-3 py-2 text-sm font-medium text-[#E2E8F0] transition hover:border-[#22C1FF]/35 hover:text-[#22C1FF] disabled:pointer-events-none disabled:opacity-40";

export type AuditHealthCard = {
  id: string;
  label: string;
  value: string;
  detail: string;
};

export type AuditAttentionItem = {
  id: string;
  headline: string;
  detail?: string;
  href?: string;
  severity: "critical" | "warning" | "info";
  priorityScore: number;
};

export type OutcomeSnapshotArea = {
  id: string;
  label: string;
  status: "strong" | "building" | "limited";
  summary: string;
};

export type EvidenceReadinessSummary = {
  completeSets: number;
  incompleteSets: number;
  missingFollowUp: number;
  readyForReview: number;
};

export type AuditCaseRow = {
  id: string;
  caseId: string;
  reportId: string;
  patientLabel: string;
  statusLabel: string;
  evidenceLabel: string;
  reportLabel: string;
  updatedAt: string;
};

export type QualityTrendMetric = {
  id: string;
  label: string;
  value: string;
};

function plural(count: number, singular: string, pluralForm?: string): string {
  if (count === 1) return `1 ${singular}`;
  return `${count} ${pluralForm ?? `${singular}s`}`;
}

function totalReports(kpis: AuditDashboardKpis): number {
  return kpis.draft_reports + kpis.changes_required_reports + kpis.released_reports;
}

function reportStatusLabel(status: string): string {
  if (status === "draft") return "Awaiting review";
  if (status === "changes_required") return "Evidence needed";
  if (status === "released") return "Released";
  if (status === "approved") return "Issued";
  return status.replace(/_/g, " ");
}

function evidenceLabelForStatus(status: string): string {
  if (status === "changes_required") return "Incomplete";
  if (status === "draft") return "Under review";
  if (status === "released" || status === "approved") return "Complete";
  return "In progress";
}

function reportLabelForStatus(status: string): string {
  if (status === "draft") return "Ready for review";
  if (status === "changes_required") return "Needs revision";
  if (status === "released" || status === "approved") return "Released";
  return "In progress";
}

function formatPct(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function queueAgeDays(iso: string | null): number | null {
  if (!iso) return null;
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return null;
  return Math.floor((Date.now() - d) / (24 * 60 * 60 * 1000));
}

function auditConfidenceLabel(kpis: AuditDashboardKpis, pipeline: AuditPipelineSnapshot): string {
  const total = totalReports(kpis);
  if (total === 0 && pipeline.scorecards_total === 0) return "Limited";
  if (pipeline.model_runs.failed > 0) return "Review";
  if (kpis.released_reports >= 3 && kpis.pending_reviews === 0) return "Strong";
  if (kpis.released_reports > 0 || pipeline.scorecards_total > 0) return "Building";
  return "Limited";
}

function countOutcomeAlerts(kpis: AuditDashboardKpis, activity: AuditActivityRow[]): number {
  const activityConcerns = activity.filter((row) => row.status === "changes_required").length;
  return kpis.changes_required_reports + activityConcerns;
}

export function buildAuditHealthCards(snapshot: AuditDashboardSnapshot): AuditHealthCard[] {
  const { kpis, pipeline, recent_audit_activity } = snapshot;
  const total = totalReports(kpis);
  const photoDetail =
    total === 0
      ? "Outcome photos will appear as cases enter audit review."
      : `${formatPct(kpis.released_reports, total)} of reports have complete evidence sets`;

  return [
    {
      id: "awaiting_review",
      label: "Cases awaiting review",
      value: String(kpis.pending_reviews),
      detail:
        kpis.pending_reviews > 0
          ? "Draft and returned reports needing clinical sign-off"
          : "No cases waiting for review",
    },
    {
      id: "ready_for_release",
      label: "Reports ready for release",
      value: String(kpis.draft_reports),
      detail:
        kpis.draft_reports > 0
          ? "Awaiting final auditor review before release"
          : "No reports awaiting release",
    },
    {
      id: "photo_evidence",
      label: "Photo evidence completeness",
      value: total === 0 ? "—" : formatPct(kpis.released_reports, total),
      detail: photoDetail,
    },
    {
      id: "outcome_alerts",
      label: "Outcome alerts",
      value: String(countOutcomeAlerts(kpis, recent_audit_activity)),
      detail: "Returned reports and evidence gaps flagged for follow-up",
    },
    {
      id: "surgery_linked",
      label: "Surgery cases linked",
      value: String(total),
      detail:
        total > 0
          ? "Cases with audit reports connected to surgery"
          : "Link surgery cases to begin outcome review",
    },
    {
      id: "audit_confidence",
      label: "Audit confidence",
      value: auditConfidenceLabel(kpis, pipeline),
      detail: "Strength of outcome intelligence from released reports and assessments",
    },
  ];
}

export function buildAuditAttentionPriorities(
  base: string,
  snapshot: AuditDashboardSnapshot,
  maxItems = 5
): AuditAttentionItem[] {
  const { kpis, queue, recent_audit_activity, pipeline } = snapshot;
  const items: AuditAttentionItem[] = [];
  const total = totalReports(kpis);

  if (kpis.pending_reviews > 0) {
    items.push({
      id: "pending_review",
      headline: `${plural(kpis.pending_reviews, "case")} ${kpis.pending_reviews === 1 ? "is" : "are"} waiting for clinical review.`,
      detail: "Review draft and returned reports before releasing outcomes to patients.",
      href: `${base}/audit#recent-audit-cases`,
      severity: kpis.pending_reviews >= 3 ? "critical" : "warning",
      priorityScore: 90 + Math.min(kpis.pending_reviews, 9),
    });
  }

  if (kpis.changes_required_reports > 0) {
    items.push({
      id: "incomplete_evidence",
      headline: `${plural(kpis.changes_required_reports, "patient")} ${kpis.changes_required_reports === 1 ? "has" : "have"} incomplete photo evidence.`,
      detail: "Capture or upload missing follow-up photos before outcome assessment can proceed.",
      href: `${base}/audit#recent-audit-cases`,
      severity: "warning",
      priorityScore: 85 + Math.min(kpis.changes_required_reports, 9),
    });
  }

  const returnedReleased = recent_audit_activity.filter(
    (row) => row.status === "changes_required"
  ).length;
  if (returnedReleased > 0) {
    items.push({
      id: "outcome_concerns",
      headline: `${plural(returnedReleased, "released report")} ${returnedReleased === 1 ? "has" : "have"} outcome concerns.`,
      detail: "Review auditor feedback and address clinical quality signals before re-release.",
      href: `${base}/audit#recent-audit-cases`,
      severity: "warning",
      priorityScore: 80 + Math.min(returnedReleased, 9),
    });
  }

  const ageDays = queueAgeDays(kpis.oldest_queue_created_at);
  if (ageDays != null && ageDays >= 7 && kpis.pending_reviews > 0) {
    items.push({
      id: "stale_review",
      headline: `Oldest pending review has been waiting ${plural(ageDays, "day")}.`,
      detail: "Prioritise long-standing cases to keep outcome reporting timely.",
      href: `${base}/audit#recent-audit-cases`,
      severity: ageDays >= 14 ? "critical" : "warning",
      priorityScore: 70 + Math.min(ageDays, 14),
    });
  }

  if (total > 0 && pipeline.scorecards_total < total) {
    items.push({
      id: "linkage_gap",
      headline: "Audit linkage is incomplete for recent surgery cases.",
      detail: "Complete outcome assessments so donor recovery and growth signals become reliable.",
      href: `${base}/cases`,
      severity: "info",
      priorityScore: 55,
    });
  }

  if (total === 0 && pipeline.scorecards_total === 0) {
    items.push({
      id: "bootstrap",
      headline: "More follow-up evidence is needed before outcome trends are reliable.",
      detail:
        "Link surgery cases and capture consistent photo sets to strengthen quality review.",
      href: `${base}/cases`,
      severity: "info",
      priorityScore: 30,
    });
  }

  if (queue.length > 0 && kpis.draft_reports > 0) {
    items.push({
      id: "release_ready",
      headline: `${plural(kpis.draft_reports, "report")} ready for auditor sign-off.`,
      detail: "Final review unlocks patient-facing outcome reports.",
      href: `${base}/audit#recent-audit-cases`,
      severity: "info",
      priorityScore: 45,
    });
  }

  return items.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, maxItems);
}

export function hasUrgentAuditAttention(items: AuditAttentionItem[]): boolean {
  return items.some((item) => item.priorityScore >= 55);
}

export function buildOutcomeSnapshotAreas(snapshot: AuditDashboardSnapshot): OutcomeSnapshotArea[] {
  const { kpis, pipeline, recent_audit_activity } = snapshot;
  const total = totalReports(kpis);
  const approved = recent_audit_activity.filter((row) => row.status === "approved").length;
  const limited = total === 0 && pipeline.scorecards_total === 0;

  if (limited) {
    return [
      {
        id: "limited",
        label: "Outcome intelligence",
        status: "limited",
        summary:
          "Outcome intelligence will strengthen as more follow-up photos and audit reports are completed.",
      },
    ];
  }

  return [
    {
      id: "donor_recovery",
      label: "Donor recovery signals",
      status: pipeline.scorecards_total > 0 ? "building" : "limited",
      summary:
        pipeline.scorecards_total > 0
          ? `${plural(pipeline.scorecards_total, "outcome assessment")} recorded across linked cases.`
          : "Complete audit reports to surface donor area recovery patterns.",
    },
    {
      id: "growth_visibility",
      label: "Growth / density visibility",
      status: kpis.released_reports >= 2 ? "building" : "limited",
      summary:
        kpis.released_reports > 0
          ? `${plural(kpis.released_reports, "released report")} available for growth and density review.`
          : "Release reports after follow-up photography to track growth outcomes.",
    },
    {
      id: "hairline_review",
      label: "Hairline design review",
      status: kpis.draft_reports + kpis.released_reports > 0 ? "building" : "limited",
      summary:
        total > 0
          ? `${plural(total, "case")} with design documentation in the audit workspace.`
          : "Hairline design review activates once surgical cases enter audit review.",
    },
    {
      id: "patient_satisfaction",
      label: "Patient satisfaction indicators",
      status: approved > 0 ? "building" : "limited",
      summary:
        approved > 0
          ? `${plural(approved, "recent sign-off")} recorded in the audit trail.`
          : "Satisfaction signals appear as auditors issue completed outcome reports.",
    },
    {
      id: "follow_up_coverage",
      label: "Follow-up evidence coverage",
      status:
        kpis.released_reports > 0 ? "strong" : kpis.pending_reviews > 0 ? "building" : "limited",
      summary:
        total > 0
          ? `${formatPct(kpis.released_reports, total)} of cases have complete follow-up evidence for outcomes.`
          : "Follow-up photo coverage improves as cases progress through audit review.",
    },
  ];
}

export function buildEvidenceReadinessSummary(kpis: AuditDashboardKpis): EvidenceReadinessSummary {
  return {
    completeSets: kpis.released_reports,
    incompleteSets: kpis.changes_required_reports,
    missingFollowUp: kpis.changes_required_reports,
    readyForReview: kpis.draft_reports,
  };
}

export function buildRecentAuditCases(
  queue: AuditQueueItem[],
  activity: AuditActivityRow[],
  maxItems = 8
): AuditCaseRow[] {
  const byCase = new Map<string, AuditCaseRow>();

  for (const item of queue) {
    const label = item.patient?.full_name?.trim() || "Surgical case";
    byCase.set(item.case_id, {
      id: item.case_id,
      caseId: item.case_id,
      reportId: item.report_id,
      patientLabel: label,
      statusLabel: reportStatusLabel(item.report_status),
      evidenceLabel: evidenceLabelForStatus(item.report_status),
      reportLabel: reportLabelForStatus(item.report_status),
      updatedAt: item.created_at,
    });
  }

  for (const row of activity) {
    if (byCase.has(row.case_id)) continue;
    byCase.set(row.case_id, {
      id: row.case_id,
      caseId: row.case_id,
      reportId: row.report_id,
      patientLabel: "Surgical case",
      statusLabel: reportStatusLabel(row.status),
      evidenceLabel: evidenceLabelForStatus(row.status),
      reportLabel: reportLabelForStatus(row.status),
      updatedAt: row.created_at,
    });
  }

  return [...byCase.values()]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, maxItems);
}

export function buildQualityTrendMetrics(kpis: AuditDashboardKpis): QualityTrendMetric[] | null {
  const total = totalReports(kpis);
  if (total === 0) return null;

  return [
    {
      id: "release_rate",
      label: "Report release rate",
      value: formatPct(kpis.released_reports, total),
    },
    {
      id: "concern_rate",
      label: "Outcome concern rate",
      value: formatPct(kpis.changes_required_reports, total),
    },
    {
      id: "evidence_completion",
      label: "Evidence completion rate",
      value: formatPct(kpis.released_reports, total),
    },
    {
      id: "review_backlog",
      label: "Cases awaiting review",
      value: String(kpis.pending_reviews),
    },
  ];
}

export function formatAuditDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function hasAuditWorkspaceData(snapshot: AuditDashboardSnapshot): boolean {
  const { kpis, queue, recent_audit_activity, pipeline } = snapshot;
  return (
    totalReports(kpis) > 0 ||
    queue.length > 0 ||
    recent_audit_activity.length > 0 ||
    pipeline.scorecards_total > 0 ||
    pipeline.model_runs.complete > 0
  );
}
