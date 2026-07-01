/**
 * WorkforceOS Phase 2 Sprint 5 — workforce planning engine (pure signals + ranking).
 */

import { addDaysIso } from "@/src/lib/workforce/shiftCostIntelligenceCore";

export const PLANNING_HORIZON_DAYS = 14;

export type WorkforcePlanningActionPriority = "critical" | "high" | "medium" | "low";

export type WorkforcePlanningSignalType =
  | "staffing_shortage"
  | "credential_expiry_risk"
  | "recruitment_need"
  | "procedure_capacity"
  | "wage_exposure";

export type StaffingShortagePrediction = {
  role: string;
  shortageCount: number;
  affectedDates: string[];
  confidence: number;
  reason: string;
};

export type CredentialExpiryRisk = {
  staffMemberId: string;
  staffName: string;
  itemType: "credential" | "certification";
  displayName: string;
  expiresAt: string;
  daysUntilExpiry: number;
  blocksClinicalWork: boolean;
  severity: WorkforcePlanningActionPriority;
};

export type RecruitmentNeedForecast = {
  activePipelineCount: number;
  lateStageCount: number;
  openRoleRequirementCount: number;
  recommendedHires: number;
  pipelineCoveragePercent: number;
  reason: string;
};

export type ProcedureCapacityForecast = {
  horizonDays: number;
  scheduledProcedures: number;
  fullyStaffedProcedures: number;
  understaffedProcedures: number;
  capacityUtilizationPercent: number;
  estimatedMaxProcedures: number;
};

export type NextBestWorkforceAction = {
  id: string;
  priority: WorkforcePlanningActionPriority;
  title: string;
  description: string;
  actionType: WorkforcePlanningSignalType;
  href: string | null;
  score: number;
};

export type WorkforcePlanningSnapshot = {
  generatedAt: string;
  horizonStart: string;
  horizonEnd: string;
  staffingShortages: StaffingShortagePrediction[];
  credentialRisks: CredentialExpiryRisk[];
  recruitmentForecast: RecruitmentNeedForecast;
  procedureCapacity: ProcedureCapacityForecast;
  nextBestActions: NextBestWorkforceAction[];
  weeklyWageExposureCents: number;
  missingWageProfileCount: number;
};

const PRIORITY_SCORE: Record<WorkforcePlanningActionPriority, number> = {
  critical: 1000,
  high: 750,
  medium: 500,
  low: 250,
};

export function planningHorizonFromDate(anchorDate?: string | null): {
  horizonStart: string;
  horizonEnd: string;
} {
  const start = anchorDate?.trim() || new Date().toISOString().slice(0, 10);
  return {
    horizonStart: start,
    horizonEnd: addDaysIso(start, PLANNING_HORIZON_DAYS - 1),
  };
}

export function predictStaffingShortages(input: {
  understaffedByDate: Array<{ workDate: string; missingRoles: Array<{ role: string; gap: number }> }>;
}): StaffingShortagePrediction[] {
  const byRole = new Map<string, { shortageCount: number; dates: Set<string> }>();

  for (const day of input.understaffedByDate) {
    for (const missing of day.missingRoles) {
      const gap = Math.max(0, Math.floor(missing.gap));
      if (gap <= 0) continue;
      const bucket = byRole.get(missing.role) ?? { shortageCount: 0, dates: new Set<string>() };
      bucket.shortageCount += gap;
      bucket.dates.add(day.workDate);
      byRole.set(missing.role, bucket);
    }
  }

  return Array.from(byRole.entries())
    .map(([role, bucket]) => ({
      role,
      shortageCount: bucket.shortageCount,
      affectedDates: Array.from(bucket.dates).sort(),
      confidence: Math.min(95, 60 + bucket.dates.size * 5),
      reason: `Understaffed on ${bucket.dates.size} day(s) in planning horizon.`,
    }))
    .sort((a, b) => b.shortageCount - a.shortageCount);
}

export function classifyCredentialRiskSeverity(
  daysUntilExpiry: number,
  blocksClinicalWork: boolean
): WorkforcePlanningActionPriority {
  if (daysUntilExpiry < 0 && blocksClinicalWork) return "critical";
  if (daysUntilExpiry <= 7 && blocksClinicalWork) return "high";
  if (daysUntilExpiry <= 14) return "medium";
  return "low";
}

export function forecastRecruitmentNeed(input: {
  roleRequirementsCount: number;
  activePipelineCount: number;
  lateStageCount: number;
  staffingShortageTotal: number;
}): RecruitmentNeedForecast {
  const recommendedHires = Math.max(0, input.staffingShortageTotal - input.lateStageCount);
  const pipelineCoveragePercent =
    input.staffingShortageTotal <= 0
      ? 100
      : Math.round(
          (Math.min(input.lateStageCount, input.staffingShortageTotal) /
            input.staffingShortageTotal) *
            1000
        ) / 10;

  return {
    activePipelineCount: input.activePipelineCount,
    lateStageCount: input.lateStageCount,
    openRoleRequirementCount: input.roleRequirementsCount,
    recommendedHires,
    pipelineCoveragePercent,
    reason:
      recommendedHires > 0
        ? `${recommendedHires} additional hire(s) recommended beyond late-stage pipeline.`
        : "Late-stage pipeline covers forecast staffing gaps.",
  };
}

export function forecastProcedureCapacity(input: {
  horizonDays: number;
  scheduledProcedures: number;
  fullyStaffedProcedures: number;
  activeClinicalStaffCount: number;
  avgTeamSizePerProcedure: number;
}): ProcedureCapacityForecast {
  const understaffed = Math.max(0, input.scheduledProcedures - input.fullyStaffedProcedures);
  const utilization =
    input.scheduledProcedures > 0
      ? Math.round((input.fullyStaffedProcedures / input.scheduledProcedures) * 1000) / 10
      : 100;

  const estimatedMax =
    input.avgTeamSizePerProcedure > 0
      ? Math.floor(input.activeClinicalStaffCount / input.avgTeamSizePerProcedure)
      : input.scheduledProcedures;

  return {
    horizonDays: input.horizonDays,
    scheduledProcedures: input.scheduledProcedures,
    fullyStaffedProcedures: input.fullyStaffedProcedures,
    understaffedProcedures: understaffed,
    capacityUtilizationPercent: utilization,
    estimatedMaxProcedures: Math.max(input.fullyStaffedProcedures, estimatedMax),
  };
}

export function rankNextBestWorkforceActions(input: {
  tenantId: string;
  credentialRisks: CredentialExpiryRisk[];
  staffingShortages: StaffingShortagePrediction[];
  recruitmentForecast: RecruitmentNeedForecast;
  procedureCapacity: ProcedureCapacityForecast;
  weeklyWageExposureCents: number;
  missingWageProfileCount: number;
  horizonStart: string;
}): NextBestWorkforceAction[] {
  const base = `/fi-admin/${input.tenantId}/workforce-os`;
  const actions: NextBestWorkforceAction[] = [];

  const criticalCreds = input.credentialRisks.filter((r) => r.severity === "critical");
  if (criticalCreds.length > 0) {
    actions.push({
      id: "resolve-expired-credentials",
      priority: "critical",
      title: "Resolve expired clinical credentials",
      description: `${criticalCreds.length} credential(s) or certification(s) are expired and may block clinical work.`,
      actionType: "credential_expiry_risk",
      href: `${base}`,
      score: PRIORITY_SCORE.critical + criticalCreds.length,
    });
  }

  if (input.procedureCapacity.understaffedProcedures > 0) {
    actions.push({
      id: "staff-upcoming-procedures",
      priority: "high",
      title: "Staff upcoming procedures",
      description: `${input.procedureCapacity.understaffedProcedures} of ${input.procedureCapacity.scheduledProcedures} procedures are understaffed in the next ${input.procedureCapacity.horizonDays} days.`,
      actionType: "procedure_capacity",
      href: `${base}/procedure-staffing?date=${encodeURIComponent(input.horizonStart)}`,
      score: PRIORITY_SCORE.high + input.procedureCapacity.understaffedProcedures * 10,
    });
  }

  const topShortage = input.staffingShortages[0];
  if (topShortage) {
    actions.push({
      id: "fill-role-shortage",
      priority: "high",
      title: `Fill ${topShortage.role} shortage`,
      description: topShortage.reason,
      actionType: "staffing_shortage",
      href: `${base}/procedure-staffing?date=${encodeURIComponent(topShortage.affectedDates[0] ?? input.horizonStart)}`,
      score: PRIORITY_SCORE.high + topShortage.shortageCount * 5,
    });
  }

  if (input.recruitmentForecast.recommendedHires > 0) {
    actions.push({
      id: "accelerate-recruitment",
      priority: "medium",
      title: "Accelerate recruitment pipeline",
      description: input.recruitmentForecast.reason,
      actionType: "recruitment_need",
      href: `${base}/recruitment`,
      score: PRIORITY_SCORE.medium + input.recruitmentForecast.recommendedHires * 8,
    });
  }

  const highCred = input.credentialRisks.filter((r) => r.severity === "high");
  if (highCred.length > 0) {
    actions.push({
      id: "renew-expiring-credentials",
      priority: "medium",
      title: "Renew credentials expiring within 7 days",
      description: `${highCred.length} staff member(s) have credentials at high expiry risk.`,
      actionType: "credential_expiry_risk",
      href: `${base}`,
      score: PRIORITY_SCORE.medium + highCred.length * 3,
    });
  }

  if (input.missingWageProfileCount > 0) {
    actions.push({
      id: "complete-wage-profiles",
      priority: "medium",
      title: "Complete missing wage profiles",
      description: `${input.missingWageProfileCount} active staff lack wage profiles — labour forecasts are incomplete.`,
      actionType: "wage_exposure",
      href: `${base}/payroll`,
      score: PRIORITY_SCORE.medium + input.missingWageProfileCount,
    });
  }

  if (input.weeklyWageExposureCents > 0) {
    actions.push({
      id: "review-wage-exposure",
      priority: "low",
      title: "Review 7-day wage exposure",
      description: "Validate rostered labour cost against budget before the week progresses.",
      actionType: "wage_exposure",
      href: `${base}/shift-cost?date=${encodeURIComponent(input.horizonStart)}`,
      score: PRIORITY_SCORE.low + Math.min(100, Math.round(input.weeklyWageExposureCents / 100_000)),
    });
  }

  return actions.sort((a, b) => b.score - a.score).slice(0, 6);
}

export function buildWorkforcePlanningSnapshot(input: {
  tenantId: string;
  horizonStart: string;
  horizonEnd: string;
  staffingShortages: StaffingShortagePrediction[];
  credentialRisks: CredentialExpiryRisk[];
  recruitmentForecast: RecruitmentNeedForecast;
  procedureCapacity: ProcedureCapacityForecast;
  weeklyWageExposureCents: number;
  missingWageProfileCount: number;
  generatedAt?: string;
}): WorkforcePlanningSnapshot {
  const nextBestActions = rankNextBestWorkforceActions({
    tenantId: input.tenantId,
    credentialRisks: input.credentialRisks,
    staffingShortages: input.staffingShortages,
    recruitmentForecast: input.recruitmentForecast,
    procedureCapacity: input.procedureCapacity,
    weeklyWageExposureCents: input.weeklyWageExposureCents,
    missingWageProfileCount: input.missingWageProfileCount,
    horizonStart: input.horizonStart,
  });

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    horizonStart: input.horizonStart,
    horizonEnd: input.horizonEnd,
    staffingShortages: input.staffingShortages,
    credentialRisks: input.credentialRisks,
    recruitmentForecast: input.recruitmentForecast,
    procedureCapacity: input.procedureCapacity,
    nextBestActions,
    weeklyWageExposureCents: input.weeklyWageExposureCents,
    missingWageProfileCount: input.missingWageProfileCount,
  };
}