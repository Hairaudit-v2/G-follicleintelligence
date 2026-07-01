/**
 * WorkforceOS V2 Command Centre — pure composition helpers (no I/O).
 */

import { formatCentsAsCurrency } from "@/src/lib/workforce/wageProfileCore";
import type {
  NextBestWorkforceAction,
  WorkforcePlanningSnapshot,
} from "@/src/lib/workforce/workforcePlanningEngineCore";
import type { ShiftCostIntelligenceSnapshot } from "@/src/lib/workforce/shiftCostIntelligenceCore";

export type WorkforceHealthStatus = "excellent" | "good" | "attention" | "critical" | "unknown";

/** Subset of operational metrics used for command centre composition (client-safe). */
export type WorkforceOperationalMetricsInput = {
  syncHealthPercent: number | null;
  openDuplicateCount: number;
  unlinkedStaffCount: number;
  inactiveStaffCount: number;
  offboardingQueueCount: number;
  clinicallyEligibleStaff: number;
  expiringCredentials: number;
  complianceAlerts: number;
  expiredCertifications: number;
};

export type WorkforceCommandCentreKpis = {
  totalStaff: number;
  clinicallyEligible: number;
  credentialRisks: number;
  openRecruitment: number;
  upcomingProcedureGaps: number;
  weeklyWageExposureCents: number;
};

export type WorkforceHealthMetric = {
  id: string;
  label: string;
  scorePercent: number | null;
  status: WorkforceHealthStatus;
  explanation: string;
  href: string;
};

export type WorkforceAttentionSeverity = "critical" | "high" | "medium" | "low";

export type WorkforceAttentionQueueItem = {
  id: string;
  severity: WorkforceAttentionSeverity;
  title: string;
  explanation: string;
  recommendedAction: string;
  href: string;
  score: number;
};

export type WorkforceModuleTileStatus = "success" | "warning" | "danger" | "neutral";

export type WorkforceModuleTile = {
  id: string;
  name: string;
  valueProposition: string;
  keyMetric: string;
  statusBadge: { label: string; variant: WorkforceModuleTileStatus };
  href: string;
  ctaLabel: string;
};

export type ProcedureStaffingForecastPanel = {
  horizonStart: string;
  horizonEnd: string;
  scheduledProcedures: number;
  fullyStaffedProcedures: number;
  understaffedProcedures: number;
  missingRoles: Array<{ role: string; gap: number }>;
  credentialWarnings: number;
  available: boolean;
};

export type WorkforceFinancialIntelligencePanel = {
  weeklyWageExposureCents: number;
  dailyRosterCostCents: number;
  procedureLabourCostCents: number;
  averageCostPerProcedureCents: number | null;
  missingWageProfileCount: number;
  available: boolean;
};

export type WorkforceCommandCentreComposeInput = {
  tenantId: string;
  totalStaff: number;
  operationalMetrics: WorkforceOperationalMetricsInput | null;
  planning: WorkforcePlanningSnapshot | null;
  shiftCost: ShiftCostIntelligenceSnapshot | null;
  openRecruitmentCount: number;
  activeRecruitmentPipelineCount: number;
  missingWageProfileCount: number;
  wageProfileCoveragePercent: number | null;
};

const SEVERITY_SCORE: Record<WorkforceAttentionSeverity, number> = {
  critical: 1000,
  high: 750,
  medium: 500,
  low: 250,
};

const PRIORITY_TO_SEVERITY: Record<string, WorkforceAttentionSeverity> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
};

export function scoreToHealthStatus(scorePercent: number | null): WorkforceHealthStatus {
  if (scorePercent == null || !Number.isFinite(scorePercent)) return "unknown";
  if (scorePercent >= 90) return "excellent";
  if (scorePercent >= 75) return "good";
  if (scorePercent >= 50) return "attention";
  return "critical";
}

export function healthStatusLabel(status: WorkforceHealthStatus): string {
  switch (status) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    case "attention":
      return "Needs attention";
    case "critical":
      return "Critical";
    default:
      return "No data";
  }
}

export function healthStatusBadgeClass(status: WorkforceHealthStatus): string {
  switch (status) {
    case "excellent":
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25";
    case "good":
      return "bg-cyan-500/15 text-cyan-300 ring-cyan-500/25";
    case "attention":
      return "bg-amber-500/15 text-amber-200 ring-amber-500/25";
    case "critical":
      return "bg-rose-500/15 text-rose-300 ring-rose-500/25";
    default:
      return "bg-slate-500/15 text-slate-400 ring-slate-500/20";
  }
}

export function severityBadgeClass(severity: WorkforceAttentionSeverity): string {
  switch (severity) {
    case "critical":
      return "bg-rose-500/15 text-rose-300 ring-rose-500/25";
    case "high":
      return "bg-amber-500/15 text-amber-200 ring-amber-500/25";
    case "medium":
      return "bg-cyan-500/15 text-cyan-300 ring-cyan-500/25";
    default:
      return "bg-slate-500/15 text-slate-400 ring-slate-500/20";
  }
}

function safePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function buildCommandCentreKpis(input: WorkforceCommandCentreComposeInput): WorkforceCommandCentreKpis {
  const ops = input.operationalMetrics;
  const planning = input.planning;

  return {
    totalStaff: input.totalStaff,
    clinicallyEligible: ops?.clinicallyEligibleStaff ?? 0,
    credentialRisks:
      planning?.credentialRisks.length ??
      (ops ? ops.expiringCredentials + ops.expiredCertifications + ops.complianceAlerts : 0),
    openRecruitment: input.openRecruitmentCount,
    upcomingProcedureGaps:
      planning?.procedureCapacity.understaffedProcedures ??
      planning?.staffingShortages.reduce((sum, s) => sum + s.shortageCount, 0) ??
      0,
    weeklyWageExposureCents:
      planning?.weeklyWageExposureCents ?? input.shiftCost?.weeklyForecast.totalForecastGrossCostCents ?? 0,
  };
}

export function buildWorkforceHealthRadar(
  input: WorkforceCommandCentreComposeInput
): WorkforceHealthMetric[] {
  const base = `/fi-admin/${input.tenantId}/workforce-os`;
  const ops = input.operationalMetrics;
  const planning = input.planning;
  const total = Math.max(input.totalStaff, 1);

  const credentialIssues =
    (ops?.expiringCredentials ?? 0) +
    (ops?.expiredCertifications ?? 0) +
    (planning?.credentialRisks.length ?? 0);
  const credentialScore = safePercent(Math.max(0, total - credentialIssues), total);

  const trainingScore =
    planning != null
      ? safePercent(
          Math.max(0, total - (planning.recruitmentForecast.recommendedHires > 0 ? 1 : 0)),
          total
        )
      : null;

  const availabilityScore = safePercent(ops?.clinicallyEligibleStaff ?? 0, input.totalStaff);

  const procedureScore =
    planning != null ? planning.procedureCapacity.capacityUtilizationPercent : null;

  const recruitmentScore = planning?.recruitmentForecast.pipelineCoveragePercent ?? null;

  const payrollScore = input.wageProfileCoveragePercent;

  const metrics: WorkforceHealthMetric[] = [
    {
      id: "credential-compliance",
      label: "Credential Compliance",
      scorePercent: credentialScore,
      status: scoreToHealthStatus(credentialScore),
      explanation:
        credentialIssues > 0
          ? `${credentialIssues} credential or certification issue(s) across the workforce.`
          : "No expiring or expired credentials detected in the planning window.",
      href: `${base.replace("/workforce-os", "/hr-os")}/credentials`,
    },
    {
      id: "training-readiness",
      label: "Training Readiness",
      scorePercent: trainingScore,
      status: scoreToHealthStatus(trainingScore),
      explanation:
        planning?.recruitmentForecast.recommendedHires
          ? `${planning.recruitmentForecast.recommendedHires} hire(s) may be needed beyond late-stage pipeline.`
          : "Recruitment pipeline covers forecast staffing gaps.",
      href: `${base}/recruitment`,
    },
    {
      id: "staff-availability",
      label: "Staff Availability",
      scorePercent: availabilityScore,
      status: scoreToHealthStatus(availabilityScore),
      explanation: ops
        ? `${ops.clinicallyEligibleStaff} of ${input.totalStaff} staff are clinically eligible.`
        : "Clinical eligibility data unavailable.",
      href: `${base.replace("/workforce-os", "/hr-os")}/compliance`,
    },
    {
      id: "procedure-coverage",
      label: "Procedure Coverage",
      scorePercent: procedureScore,
      status: scoreToHealthStatus(procedureScore),
      explanation: planning
        ? `${planning.procedureCapacity.fullyStaffedProcedures} of ${planning.procedureCapacity.scheduledProcedures} procedures fully staffed in horizon.`
        : "Procedure staffing forecast unavailable — refresh planning signals.",
      href: `${base}/procedure-staffing`,
    },
    {
      id: "recruitment-pipeline",
      label: "Recruitment Pipeline",
      scorePercent: recruitmentScore,
      status: scoreToHealthStatus(recruitmentScore),
      explanation: planning
        ? `${planning.recruitmentForecast.activePipelineCount} active candidates · ${planning.recruitmentForecast.lateStageCount} late-stage.`
        : `${input.activeRecruitmentPipelineCount} active recruitment candidate(s).`,
      href: `${base}/recruitment`,
    },
    {
      id: "payroll-coverage",
      label: "Payroll Coverage",
      scorePercent: payrollScore,
      status: scoreToHealthStatus(payrollScore),
      explanation:
        input.missingWageProfileCount > 0
          ? `${input.missingWageProfileCount} active staff lack wage profiles.`
          : "Wage profiles configured for active clinical staff.",
      href: `${base}/payroll`,
    },
  ];

  return metrics;
}

export function mapPlanningActionToAttentionItem(
  action: NextBestWorkforceAction,
  tenantId: string
): WorkforceAttentionQueueItem {
  const base = `/fi-admin/${tenantId}/workforce-os`;
  return {
    id: action.id,
    severity: PRIORITY_TO_SEVERITY[action.priority] ?? "medium",
    title: action.title,
    explanation: action.description,
    recommendedAction: "Open module",
    href: action.href ?? base,
    score: action.score,
  };
}

export function buildOperationalAttentionItems(
  input: WorkforceCommandCentreComposeInput
): WorkforceAttentionQueueItem[] {
  const base = `/fi-admin/${input.tenantId}`;
  const wos = `${base}/workforce-os`;
  const ops = input.operationalMetrics;
  if (!ops) return [];

  const items: WorkforceAttentionQueueItem[] = [];

  if (ops.expiredCertifications > 0) {
    items.push({
      id: "expired-certifications",
      severity: "critical",
      title: "Expired certifications",
      explanation: `${ops.expiredCertifications} certification(s) are expired and may block clinical work.`,
      recommendedAction: "Review certifications",
      href: `${base}/hr-os/certifications`,
      score: SEVERITY_SCORE.critical + ops.expiredCertifications,
    });
  }

  if (ops.expiringCredentials > 0) {
    items.push({
      id: "expiring-credentials",
      severity: "high",
      title: "Credentials expiring soon",
      explanation: `${ops.expiringCredentials} credential(s) expire within the compliance window.`,
      recommendedAction: "Renew credentials",
      href: `${base}/hr-os/credentials`,
      score: SEVERITY_SCORE.high + ops.expiringCredentials,
    });
  }

  if (input.missingWageProfileCount > 0) {
    items.push({
      id: "missing-wage-profiles",
      severity: "medium",
      title: "Missing wage profiles",
      explanation: `${input.missingWageProfileCount} active staff lack wage profiles — labour forecasts are incomplete.`,
      recommendedAction: "Complete payroll setup",
      href: `${wos}/payroll`,
      score: SEVERITY_SCORE.medium + input.missingWageProfileCount,
    });
  }

  if (ops.unlinkedStaffCount > 0) {
    items.push({
      id: "unlinked-hr-identity",
      severity: "medium",
      title: "Unlinked HR identities",
      explanation: `${ops.unlinkedStaffCount} active staff member(s) are not linked to IIOHR.`,
      recommendedAction: "Run HR reconciliation",
      href: `${wos}/hr-reconciliation`,
      score: SEVERITY_SCORE.medium + ops.unlinkedStaffCount,
    });
  }

  if (ops.openDuplicateCount > 0) {
    items.push({
      id: "duplicate-staff-conflicts",
      severity: "medium",
      title: "Duplicate staff conflicts",
      explanation: `${ops.openDuplicateCount} duplicate candidate(s) need review.`,
      recommendedAction: "Review duplicates",
      href: `${base}/hr-os/duplicates`,
      score: SEVERITY_SCORE.medium + ops.openDuplicateCount,
    });
  }

  if (ops.offboardingQueueCount > 0) {
    items.push({
      id: "offboarding-queue",
      severity: "low",
      title: "Offboarded staff with access",
      explanation: `${ops.offboardingQueueCount} staff in terminated/resigned status may still need access revocation.`,
      recommendedAction: "Open offboarding centre",
      href: `${base}/hr-os/offboarding`,
      score: SEVERITY_SCORE.low + ops.offboardingQueueCount,
    });
  }

  if (ops.complianceAlerts > 0) {
    items.push({
      id: "compliance-alerts",
      severity: "high",
      title: "Open compliance alerts",
      explanation: `${ops.complianceAlerts} unresolved compliance alert(s) require attention.`,
      recommendedAction: "Review compliance",
      href: `${base}/hr-os/compliance`,
      score: SEVERITY_SCORE.high + ops.complianceAlerts,
    });
  }

  return items;
}

export function sortAttentionQueue(
  items: WorkforceAttentionQueueItem[],
  limit = 8
): WorkforceAttentionQueueItem[] {
  const seen = new Set<string>();
  return items
    .sort((a, b) => b.score - a.score)
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, limit);
}

export function buildAttentionQueue(input: WorkforceCommandCentreComposeInput): WorkforceAttentionQueueItem[] {
  const planningItems = (input.planning?.nextBestActions ?? []).map((a) =>
    mapPlanningActionToAttentionItem(a, input.tenantId)
  );
  const operationalItems = buildOperationalAttentionItems(input);
  return sortAttentionQueue([...planningItems, ...operationalItems]);
}

export function buildProcedureStaffingForecast(
  planning: WorkforcePlanningSnapshot | null
): ProcedureStaffingForecastPanel {
  if (!planning) {
    return {
      horizonStart: "",
      horizonEnd: "",
      scheduledProcedures: 0,
      fullyStaffedProcedures: 0,
      understaffedProcedures: 0,
      missingRoles: [],
      credentialWarnings: 0,
      available: false,
    };
  }

  const roleGaps = new Map<string, number>();
  for (const shortage of planning.staffingShortages) {
    roleGaps.set(shortage.role, (roleGaps.get(shortage.role) ?? 0) + shortage.shortageCount);
  }

  return {
    horizonStart: planning.horizonStart,
    horizonEnd: planning.horizonEnd,
    scheduledProcedures: planning.procedureCapacity.scheduledProcedures,
    fullyStaffedProcedures: planning.procedureCapacity.fullyStaffedProcedures,
    understaffedProcedures: planning.procedureCapacity.understaffedProcedures,
    missingRoles: Array.from(roleGaps.entries())
      .map(([role, gap]) => ({ role, gap }))
      .sort((a, b) => b.gap - a.gap),
    credentialWarnings: planning.credentialRisks.length,
    available: true,
  };
}

export function buildFinancialIntelligencePanel(
  planning: WorkforcePlanningSnapshot | null,
  shiftCost: ShiftCostIntelligenceSnapshot | null
): WorkforceFinancialIntelligencePanel {
  const procedures = shiftCost?.procedures ?? [];
  const totalProcedureCost = procedures.reduce((sum, p) => sum + p.totalGrossCostCents, 0);
  const avgProcedureCost =
    procedures.length > 0 ? Math.round(totalProcedureCost / procedures.length) : null;

  return {
    weeklyWageExposureCents:
      planning?.weeklyWageExposureCents ?? shiftCost?.weeklyForecast.totalForecastGrossCostCents ?? 0,
    dailyRosterCostCents: shiftCost?.dailyRoster.totalGrossCostCents ?? 0,
    procedureLabourCostCents: totalProcedureCost,
    averageCostPerProcedureCents: avgProcedureCost,
    missingWageProfileCount:
      planning?.missingWageProfileCount ?? shiftCost?.dailyRoster.missingProfileCount ?? 0,
    available: Boolean(planning || shiftCost),
  };
}

export function formatModuleTileMetric(value: string | number): string {
  if (typeof value === "number") return String(value);
  return value.trim() || "—";
}

export function buildModuleTiles(input: WorkforceCommandCentreComposeInput): WorkforceModuleTile[] {
  const base = `/fi-admin/${input.tenantId}/workforce-os`;
  const hrBase = `/fi-admin/${input.tenantId}/hr-os`;
  const staffBase = `/fi-admin/${input.tenantId}/staff`;
  const ops = input.operationalMetrics;
  const planning = input.planning;
  const financial = buildFinancialIntelligencePanel(planning, input.shiftCost);

  return [
    {
      id: "recruitment",
      name: "Recruitment Engine",
      valueProposition: "Pipeline hiring from application through clinical assessment to offer.",
      keyMetric: `${input.activeRecruitmentPipelineCount} active · ${input.openRecruitmentCount} open roles`,
      statusBadge: {
        label:
          (planning?.recruitmentForecast.recommendedHires ?? 0) > 0 ? "Hiring needed" : "On track",
        variant:
          (planning?.recruitmentForecast.recommendedHires ?? 0) > 0 ? "warning" : "success",
      },
      href: `${base}/recruitment`,
      ctaLabel: "Open recruitment",
    },
    {
      id: "payroll",
      name: "Payroll & Wages",
      valueProposition: "Wage profiles, award loadings, and timesheet-ready labour costing.",
      keyMetric: `Weekly exposure: ${formatCentsAsCurrency(financial.weeklyWageExposureCents)} · ${financial.missingWageProfileCount} missing profiles`,
      statusBadge: {
        label: financial.missingWageProfileCount > 0 ? "Incomplete" : "Configured",
        variant: financial.missingWageProfileCount > 0 ? "warning" : "success",
      },
      href: `${base}/payroll`,
      ctaLabel: "Open payroll",
    },
    {
      id: "shift-cost",
      name: "Shift Cost Intelligence",
      valueProposition: "Daily roster cost, surgery teams, and weekly wage exposure forecast.",
      keyMetric: financial.available
        ? `Today: ${formatCentsAsCurrency(financial.dailyRosterCostCents)}`
        : "Select a date to analyse",
      statusBadge: {
        label: financial.available ? "Live" : "Awaiting data",
        variant: financial.available ? "success" : "neutral",
      },
      href: `${base}/shift-cost`,
      ctaLabel: "View shift costs",
    },
    {
      id: "procedure-staffing",
      name: "Procedure Staffing",
      valueProposition: "Cost-aware surgery team recommendations with eligibility blocking.",
      keyMetric: planning
        ? `${planning.procedureCapacity.understaffedProcedures} understaffed · ${planning.procedureCapacity.scheduledProcedures} scheduled`
        : "Refresh planning for forecast",
      statusBadge: {
        label:
          (planning?.procedureCapacity.understaffedProcedures ?? 0) > 0
            ? "Gaps detected"
            : "Covered",
        variant:
          (planning?.procedureCapacity.understaffedProcedures ?? 0) > 0 ? "danger" : "success",
      },
      href: `${base}/procedure-staffing`,
      ctaLabel: "Staff procedures",
    },
    {
      id: "planning",
      name: "Workforce Planning",
      valueProposition: "14-day horizon signals and ranked next-best workforce actions.",
      keyMetric: planning
        ? `${planning.nextBestActions.length} recommended action(s)`
        : "No snapshot yet",
      statusBadge: {
        label: planning ? "Intelligence ready" : "Refresh needed",
        variant: planning ? "success" : "neutral",
      },
      href: `${base}/planning`,
      ctaLabel: "Open planning",
    },
    {
      id: "compliance",
      name: "Compliance",
      valueProposition: "Clinical compliance alerts and workforce governance automation.",
      keyMetric: ops ? `${ops.complianceAlerts} open alert(s)` : "—",
      statusBadge: {
        label: (ops?.complianceAlerts ?? 0) > 0 ? "Alerts open" : "Clear",
        variant: (ops?.complianceAlerts ?? 0) > 0 ? "warning" : "success",
      },
      href: `${hrBase}/compliance`,
      ctaLabel: "Open compliance",
    },
    {
      id: "credentials",
      name: "Credentials & Certifications",
      valueProposition: "Credential expiry tracking and certification lifecycle management.",
      keyMetric: ops
        ? `${ops.expiringCredentials} expiring · ${ops.expiredCertifications} expired`
        : "—",
      statusBadge: {
        label:
          (ops?.expiringCredentials ?? 0) + (ops?.expiredCertifications ?? 0) > 0
            ? "Renewals due"
            : "Current",
        variant:
          (ops?.expiringCredentials ?? 0) + (ops?.expiredCertifications ?? 0) > 0
            ? "warning"
            : "success",
      },
      href: `${hrBase}/credentials`,
      ctaLabel: "Manage credentials",
    },
    {
      id: "hr-reconciliation",
      name: "HR Reconciliation",
      valueProposition: "Identity linking, duplicate resolution, and IIOHR sync governance.",
      keyMetric: ops
        ? `${ops.unlinkedStaffCount} unlinked · ${ops.openDuplicateCount} duplicates`
        : "—",
      statusBadge: {
        label:
          (ops?.unlinkedStaffCount ?? 0) + (ops?.openDuplicateCount ?? 0) > 0
            ? "Review needed"
            : "Synced",
        variant:
          (ops?.unlinkedStaffCount ?? 0) + (ops?.openDuplicateCount ?? 0) > 0
            ? "warning"
            : "success",
      },
      href: `${base}/hr-reconciliation`,
      ctaLabel: "Reconcile HR",
    },
    {
      id: "staff-directory",
      name: "Staff Directory",
      valueProposition: "FI staff records, roles, calendars, and feature access management.",
      keyMetric: `${input.totalStaff} staff records`,
      statusBadge: { label: "Directory", variant: "neutral" },
      href: staffBase,
      ctaLabel: "Browse staff",
    },
  ];
}

export function buildEmptyPlanningFallbackMessage(): string {
  return "Planning signals unavailable — use Refresh Planning Signals to generate workforce intelligence.";
}

export { composeWorkforceIntelligence } from "@/src/lib/workforce/workforceIntelligenceEngineCore";
export type { WorkforceIntelligencePanel } from "@/src/lib/workforce/workforceIntelligenceEngineCore";
export {
  composeSurgicalWorkforceIntelligence,
  resolveSurgicalIntelligenceDates,
} from "@/src/lib/workforce/surgicalWorkforceIntelligenceCore";
export type {
  SurgicalWorkforceIntelligenceInput,
  SurgicalWorkforceIntelligencePanel,
} from "@/src/lib/workforce/surgicalWorkforceIntelligenceCore";