/**
 * WorkforceOS Phase 2 Sprint 4 — procedure staffing optimizer (pure logic).
 */

import type { RosterAssignableCandidate } from "@/src/lib/workforce-os/workforceRosterCandidates";
import type { ClinicalStaffingRequiredRoles } from "@/src/lib/workforce-os/workforceClinicalStaffingTemplateDefaults";
import {
  computeGrossLabourCostCents,
  type AwardLoadingSnapshot,
  type WageRateType,
} from "./wageProfileCore";

export type StaffWageCostHint = {
  rateType: WageRateType;
  baseRateCents: number;
  awardLoadings: AwardLoadingSnapshot[];
};

export type OptimizerRankedCandidate = RosterAssignableCandidate & {
  assignedRole: string;
  grossCostCents: number;
  optimizerScore: number;
  autoBlocked: boolean;
};

export type ProcedureStaffingRecommendation = {
  surgeryId: string;
  procedureLabel: string;
  scheduledDate: string;
  startsAt: string;
  endsAt: string;
  clinicId: string | null;
  eventType: string;
  requiredRoles: ClinicalStaffingRequiredRoles;
  recommendedTeam: OptimizerRankedCandidate[];
  blockedStaff: OptimizerRankedCandidate[];
  alternateCandidates: OptimizerRankedCandidate[];
  missingRoles: Array<{ role: string; required: number; assigned: number }>;
  totalTeamCostCents: number;
  staffingComplete: boolean;
  minutesWorked: number;
};

export type ProcedureStaffingOptimizerSnapshot = {
  workDate: string;
  procedureCount: number;
  completeCount: number;
  blockedStaffCount: number;
  totalRecommendedCostCents: number;
  recommendations: ProcedureStaffingRecommendation[];
};

/** Cost-aware score: eligibility rank first, then lower labour cost as tie-breaker. */
export function computeOptimizerScore(input: {
  rankScore: number;
  section: RosterAssignableCandidate["section"];
  grossCostCents: number;
}): number {
  const sectionPenalty =
    input.section === "eligible" ? 0 : input.section === "warning" ? -200 : -10_000;
  const costPenalty = Math.min(500, Math.round(input.grossCostCents / 10_000));
  return input.rankScore + sectionPenalty - costPenalty;
}

export function estimateStaffGrossCostCents(
  wage: StaffWageCostHint | null,
  minutesWorked: number
): number {
  if (!wage || wage.baseRateCents <= 0) return 0;
  return computeGrossLabourCostCents({
    rateType: wage.rateType,
    baseRateCents: wage.baseRateCents,
    minutesWorked,
    awardLoadings: wage.awardLoadings,
  });
}

export function enrichCandidateWithCost(input: {
  candidate: RosterAssignableCandidate;
  assignedRole: string;
  wage: StaffWageCostHint | null;
  minutesWorked: number;
}): OptimizerRankedCandidate {
  const grossCostCents = estimateStaffGrossCostCents(input.wage, input.minutesWorked);
  const autoBlocked = input.candidate.section === "blocked" || !input.candidate.eligible;
  return {
    ...input.candidate,
    assignedRole: input.assignedRole,
    grossCostCents,
    optimizerScore: computeOptimizerScore({
      rankScore: input.candidate.rankScore,
      section: input.candidate.section,
      grossCostCents,
    }),
    autoBlocked,
  };
}

export function selectRecommendedTeamForRole(
  candidates: OptimizerRankedCandidate[],
  requiredCount: number
): {
  selected: OptimizerRankedCandidate[];
  alternates: OptimizerRankedCandidate[];
  blocked: OptimizerRankedCandidate[];
} {
  const blocked = candidates.filter((c) => c.autoBlocked);
  const eligiblePool = candidates
    .filter((c) => !c.autoBlocked)
    .sort((a, b) => b.optimizerScore - a.optimizerScore);

  const selected = eligiblePool.slice(0, Math.max(0, requiredCount));
  const alternates = eligiblePool.slice(selected.length);
  return { selected, alternates, blocked };
}

export function buildProcedureStaffingRecommendation(input: {
  surgeryId: string;
  procedureLabel: string;
  scheduledDate: string;
  startsAt: string;
  endsAt: string;
  clinicId: string | null;
  eventType: string;
  requiredRoles: ClinicalStaffingRequiredRoles;
  minutesWorked: number;
  roleCandidates: Record<string, OptimizerRankedCandidate[]>;
  existingAssignmentsByRole: ClinicalStaffingRequiredRoles;
}): ProcedureStaffingRecommendation {
  const recommendedTeam: OptimizerRankedCandidate[] = [];
  const blockedStaff: OptimizerRankedCandidate[] = [];
  const alternateCandidates: OptimizerRankedCandidate[] = [];
  const missingRoles: Array<{ role: string; required: number; assigned: number }> = [];

  for (const [role, requiredRaw] of Object.entries(input.requiredRoles)) {
    const required = Math.max(0, Math.floor(requiredRaw));
    if (required <= 0) continue;

    const alreadyAssigned = input.existingAssignmentsByRole[role] ?? 0;
    const stillNeeded = Math.max(0, required - alreadyAssigned);
    const pool = input.roleCandidates[role] ?? [];
    const { selected, alternates, blocked } = selectRecommendedTeamForRole(pool, stillNeeded);

    recommendedTeam.push(...selected);
    alternateCandidates.push(...alternates);
    blockedStaff.push(...blocked);

    const filled = alreadyAssigned + selected.length;
    if (filled < required) {
      missingRoles.push({ role, required, assigned: filled });
    }
  }

  return {
    surgeryId: input.surgeryId,
    procedureLabel: input.procedureLabel,
    scheduledDate: input.scheduledDate,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    clinicId: input.clinicId,
    eventType: input.eventType,
    requiredRoles: input.requiredRoles,
    recommendedTeam,
    blockedStaff,
    alternateCandidates,
    missingRoles,
    totalTeamCostCents: recommendedTeam.reduce((sum, m) => sum + m.grossCostCents, 0),
    staffingComplete: missingRoles.length === 0,
    minutesWorked: input.minutesWorked,
  };
}

export function summarizeProcedureStaffingOptimizer(input: {
  workDate: string;
  recommendations: ProcedureStaffingRecommendation[];
}): ProcedureStaffingOptimizerSnapshot {
  return {
    workDate: input.workDate,
    procedureCount: input.recommendations.length,
    completeCount: input.recommendations.filter((r) => r.staffingComplete).length,
    blockedStaffCount: input.recommendations.reduce((sum, r) => sum + r.blockedStaff.length, 0),
    totalRecommendedCostCents: input.recommendations.reduce(
      (sum, r) => sum + r.totalTeamCostCents,
      0
    ),
    recommendations: input.recommendations,
  };
}