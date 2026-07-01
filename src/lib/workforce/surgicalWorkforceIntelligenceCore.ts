/**
 * WorkforceOS — Surgical Workforce Intelligence (pure composition, SurgeryOS bridge).
 */

import { caseProcedureDayDetailHref } from "@/src/lib/cases/caseDetailNavConstants";
import { addDaysIso } from "@/src/lib/workforce/shiftCostIntelligenceCore";
import type {
  ProcedureStaffingOptimizerSnapshot,
  ProcedureStaffingRecommendation,
} from "@/src/lib/workforce/procedureStaffingOptimizerCore";
import type { WorkforceAttentionSeverity } from "@/src/lib/workforce/workforceCommandCentreCore";
import type {
  CredentialExpiryRisk,
  WorkforcePlanningSnapshot,
} from "@/src/lib/workforce/workforcePlanningEngineCore";

export type SurgicalReadinessStatus = "optimal" | "watch" | "risk";

export type TomorrowSurgeryReadinessIntel = {
  readinessScore: number;
  surgeriesScheduled: number;
  fullyStaffed: number;
  atRisk: number;
  credentialWarnings: number;
  missingSurgeonAssignments: number;
  missingRnAssignments: number;
  missingTechnicianAssignments: number;
  status: SurgicalReadinessStatus;
  summary: string;
};

export type ProcedureStaffingQualityIntel = {
  staffingQualityScore: number;
  assignmentAccuracy: number;
  incompleteAssignments: number;
  unsafeAssignments: number;
  summary: string;
};

export type ClinicalCapacityIntel = {
  weeklyCapacityPercent: number;
  unusedHours: number;
  maxProceduresAvailable: number;
  overloadRisk: number;
  underutilizedStaff: number;
  summary: string;
};

export type SurgicalIntelligenceActionType =
  | "apply_recommended_team"
  | "open_procedure_staffing"
  | "open_surgery_case"
  | "open_credentials";

export type SurgicalIntelligenceAction = {
  type: SurgicalIntelligenceActionType;
  label: string;
  route: string;
  surgeryId?: string;
};

export type ActionableSurgicalProcedure = {
  surgeryId: string;
  procedureLabel: string;
  procedureDate: string;
  staffingComplete: boolean;
  canApplyRecommendedTeam: boolean;
  actions: SurgicalIntelligenceAction[];
};

export type SurgicalStaffingRisk = {
  id: string;
  title: string;
  severity: "critical" | "warning";
  procedureDate: string;
  recommendation: string;
  score: number;
  surgeryId: string | null;
  procedureLabel: string | null;
  actions: SurgicalIntelligenceAction[];
};

export type SurgicalStaffingRiskIntel = {
  totalRisks: number;
  criticalRisks: number;
  warningRisks: number;
  detectedRisks: SurgicalStaffingRisk[];
};

export type SurgicalWorkforceRecommendation = {
  id: string;
  title: string;
  severity: WorkforceAttentionSeverity;
  impact: "high" | "medium" | "low";
  route: string;
  ctaLabel: string;
  score: number;
  surgeryId: string | null;
  procedureDate: string | null;
  actions: SurgicalIntelligenceAction[];
};

export type SurgicalWorkforceIntelligencePanel = {
  tomorrowDate: string;
  tomorrowReadiness: TomorrowSurgeryReadinessIntel;
  staffingQuality: ProcedureStaffingQualityIntel;
  clinicalCapacity: ClinicalCapacityIntel;
  staffingRisks: SurgicalStaffingRiskIntel;
  recommendations: SurgicalWorkforceRecommendation[];
  actionableProcedures: ActionableSurgicalProcedure[];
};

export type SurgicalWorkforceIntelligenceInput = {
  tenantId: string;
  tomorrowDate: string;
  tomorrowOptimizer: ProcedureStaffingOptimizerSnapshot | null;
  weekOptimizers: ProcedureStaffingOptimizerSnapshot[];
  planning: WorkforcePlanningSnapshot | null;
  activeClinicalStaffCount: number;
  surgeryCaseById?: Record<string, string | null>;
};

const TOMORROW_EMPTY_SUMMARY = "No surgeries scheduled tomorrow.";

const STANDARD_WEEKLY_CLINICAL_HOURS = 40;
const HOURS_PER_PROCEDURE = 8;

export function clampSurgicalScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function readinessToStatus(score: number): SurgicalReadinessStatus {
  const clamped = clampSurgicalScore(score);
  if (clamped >= 90) return "optimal";
  if (clamped >= 70) return "watch";
  return "risk";
}

function normalizeRole(role: string): string {
  return role.trim().toLowerCase();
}

function isSurgeonRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === "surgeon" || r === "doctor" || r === "consultant";
}

function isRnRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === "nurse" || r === "rn";
}

function isTechnicianRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === "technician" || r === "tech";
}

function countMissingByRoleType(
  recommendations: ProcedureStaffingRecommendation[],
  matcher: (role: string) => boolean
): number {
  let count = 0;
  for (const rec of recommendations) {
    for (const missing of rec.missingRoles) {
      if (!matcher(missing.role)) continue;
      count += Math.max(0, missing.required - missing.assigned);
    }
  }
  return count;
}

function credentialWarningsForProcedures(
  recommendations: ProcedureStaffingRecommendation[],
  credentialRisks: CredentialExpiryRisk[]
): number {
  const riskByStaff = new Map(credentialRisks.map((r) => [r.staffMemberId, r]));
  let warnings = 0;

  for (const rec of recommendations) {
    const procedureDate = rec.scheduledDate.slice(0, 10);
    for (const member of [...rec.recommendedTeam, ...rec.blockedStaff]) {
      const risk = riskByStaff.get(member.staffId);
      if (risk && risk.expiresAt <= procedureDate) warnings += 1;
      if (member.section === "blocked" || member.privilegeWarnings.length > 0) warnings += 1;
    }
  }

  return warnings;
}

export function buildTomorrowSurgeryReadinessIntel(
  tomorrowOptimizer: ProcedureStaffingOptimizerSnapshot | null,
  credentialRisks: CredentialExpiryRisk[] = []
): TomorrowSurgeryReadinessIntel {
  const recommendations = tomorrowOptimizer?.recommendations ?? [];
  const surgeriesScheduled = recommendations.length;

  if (surgeriesScheduled === 0) {
    return {
      readinessScore: 100,
      surgeriesScheduled: 0,
      fullyStaffed: 0,
      atRisk: 0,
      credentialWarnings: 0,
      missingSurgeonAssignments: 0,
      missingRnAssignments: 0,
      missingTechnicianAssignments: 0,
      status: "optimal",
      summary: TOMORROW_EMPTY_SUMMARY,
    };
  }

  const fullyStaffed = recommendations.filter((r) => r.staffingComplete).length;
  const atRisk = Math.max(0, surgeriesScheduled - fullyStaffed);
  const missingSurgeonAssignments = countMissingByRoleType(recommendations, isSurgeonRole);
  const missingRnAssignments = countMissingByRoleType(recommendations, isRnRole);
  const missingTechnicianAssignments = countMissingByRoleType(recommendations, isTechnicianRole);
  const credentialWarnings = credentialWarningsForProcedures(recommendations, credentialRisks);

  let readinessScore = 100;
  readinessScore -= Math.min(35, atRisk * 15);
  readinessScore -= Math.min(30, missingSurgeonAssignments * 18);
  readinessScore -= Math.min(20, missingRnAssignments * 8);
  readinessScore -= Math.min(15, missingTechnicianAssignments * 6);
  readinessScore -= Math.min(20, credentialWarnings * 5);

  const clamped = clampSurgicalScore(readinessScore);
  const status = readinessToStatus(clamped);

  let summary: string;
  if (atRisk === 0 && credentialWarnings === 0) {
    summary = `${surgeriesScheduled} procedure${surgeriesScheduled === 1 ? "" : "s"} scheduled tomorrow. All procedures are fully staffed.`;
  } else if (atRisk > 0) {
    summary = `${surgeriesScheduled} procedure${surgeriesScheduled === 1 ? "" : "s"} scheduled tomorrow. ${atRisk} procedure${atRisk === 1 ? "" : "s"} currently understaffed.`;
  } else {
    summary = `${surgeriesScheduled} procedure${surgeriesScheduled === 1 ? "" : "s"} scheduled tomorrow. ${credentialWarnings} credential conflict${credentialWarnings === 1 ? "" : "s"} detected.`;
  }

  return {
    readinessScore: clamped,
    surgeriesScheduled,
    fullyStaffed,
    atRisk,
    credentialWarnings,
    missingSurgeonAssignments,
    missingRnAssignments,
    missingTechnicianAssignments,
    status,
    summary,
  };
}

function collectWeekRecommendations(
  weekOptimizers: ProcedureStaffingOptimizerSnapshot[]
): ProcedureStaffingRecommendation[] {
  return weekOptimizers.flatMap((snapshot) => snapshot.recommendations);
}

function isUnsafeAssignment(
  member: ProcedureStaffingRecommendation["recommendedTeam"][number]
): boolean {
  return (
    member.autoBlocked ||
    member.section !== "eligible" ||
    member.warnings.length > 0 ||
    member.privilegeWarnings.length > 0
  );
}

export function buildProcedureStaffingQualityIntel(
  weekOptimizers: ProcedureStaffingOptimizerSnapshot[]
): ProcedureStaffingQualityIntel {
  const recommendations = collectWeekRecommendations(weekOptimizers);

  if (recommendations.length === 0) {
    return {
      staffingQualityScore: 100,
      assignmentAccuracy: 100,
      incompleteAssignments: 0,
      unsafeAssignments: 0,
      summary: "No upcoming procedure assignments to evaluate.",
    };
  }

  let totalRequiredSlots = 0;
  let totalFilledSlots = 0;
  let incompleteAssignments = 0;
  let unsafeAssignments = 0;
  let eligibleAssignments = 0;
  let totalAssignments = 0;

  for (const rec of recommendations) {
    for (const [role, requiredRaw] of Object.entries(rec.requiredRoles)) {
      const required = Math.max(0, Math.floor(requiredRaw ?? 0));
      if (required <= 0) continue;
      totalRequiredSlots += required;
      const missing = rec.missingRoles.find((m) => normalizeRole(m.role) === normalizeRole(role));
      const filled = missing ? missing.assigned : required;
      totalFilledSlots += filled;
      if (missing) incompleteAssignments += Math.max(0, missing.required - missing.assigned);
    }

    for (const member of rec.recommendedTeam) {
      totalAssignments += 1;
      if (isUnsafeAssignment(member)) unsafeAssignments += 1;
      else eligibleAssignments += 1;
    }
  }

  const assignmentAccuracy =
    totalRequiredSlots > 0
      ? clampSurgicalScore((totalFilledSlots / totalRequiredSlots) * 100)
      : 100;
  const completeRatio = clampSurgicalScore(
    (recommendations.filter((r) => r.staffingComplete).length / recommendations.length) * 100
  );
  const eligibleRatio =
    totalAssignments > 0
      ? clampSurgicalScore((eligibleAssignments / totalAssignments) * 100)
      : 100;
  const staffingQualityScore = clampSurgicalScore(
    completeRatio * 0.55 + assignmentAccuracy * 0.3 + eligibleRatio * 0.15
  );

  const summary = `${staffingQualityScore}% staffing assignment quality detected across upcoming procedures.`;

  return {
    staffingQualityScore,
    assignmentAccuracy,
    incompleteAssignments,
    unsafeAssignments,
    summary,
  };
}

export function buildClinicalCapacityIntel(
  input: SurgicalWorkforceIntelligenceInput
): ClinicalCapacityIntel {
  const recommendations = collectWeekRecommendations(input.weekOptimizers);
  const scheduledHours = recommendations.reduce((sum, r) => sum + r.minutesWorked / 60, 0);

  const maxProceduresAvailable =
    input.planning?.procedureCapacity.estimatedMaxProcedures ??
    Math.max(
      0,
      Math.floor((input.activeClinicalStaffCount * STANDARD_WEEKLY_CLINICAL_HOURS) / HOURS_PER_PROCEDURE)
    );

  const maxAvailableHours = maxProceduresAvailable * HOURS_PER_PROCEDURE;
  const unusedHours = Math.max(0, Math.round((maxAvailableHours - scheduledHours) * 10) / 10);
  const weeklyCapacityPercent =
    maxAvailableHours > 0
      ? clampSurgicalScore((scheduledHours / maxAvailableHours) * 100)
      : recommendations.length > 0
        ? 100
        : 0;

  const assignedStaff = new Set<string>();
  for (const rec of recommendations) {
    for (const member of rec.recommendedTeam) {
      assignedStaff.add(member.staffId);
    }
  }
  const underutilizedStaff = Math.max(0, input.activeClinicalStaffCount - assignedStaff.size);

  const overloadRisk = detectOverloadStaffCount(recommendations);

  const summary =
    unusedHours > 0
      ? `${Math.round(unusedHours)} available surgery hours remain this week.`
      : weeklyCapacityPercent >= 90
        ? "Clinical capacity is near full utilization this week."
        : "Limited procedure volume scheduled against available clinical capacity.";

  return {
    weeklyCapacityPercent,
    unusedHours,
    maxProceduresAvailable,
    overloadRisk,
    underutilizedStaff,
    summary,
  };
}

function detectOverloadStaffCount(recommendations: ProcedureStaffingRecommendation[]): number {
  const staffProcedureDates = new Map<string, Set<string>>();

  for (const rec of recommendations) {
    const date = rec.scheduledDate.slice(0, 10);
    for (const member of rec.recommendedTeam) {
      const hasOverlapConflict = member.conflicts.some(
        (c) => c.kind === "assignment_overlap" || c.kind === "shift_overlap"
      );
      if (!hasOverlapConflict) continue;
      const dates = staffProcedureDates.get(member.staffId) ?? new Set<string>();
      dates.add(date);
      staffProcedureDates.set(member.staffId, dates);
    }

    const byDate = new Map<string, string[]>();
    for (const member of rec.recommendedTeam) {
      const bucket = byDate.get(date) ?? [];
      bucket.push(member.staffId);
      byDate.set(date, bucket);
    }
    for (const [, staffIds] of byDate) {
      const seen = new Set<string>();
      for (const id of staffIds) {
        if (seen.has(id)) staffProcedureDates.set(id, new Set([date]));
        seen.add(id);
      }
    }
  }

  return staffProcedureDates.size;
}

function formatProcedureDateLabel(date: string): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-AU", { month: "long", day: "numeric", timeZone: "UTC" });
}

function procedureStaffingRoute(tenantId: string, procedureDate: string, surgeryId?: string): string {
  const base = `/fi-admin/${tenantId}/workforce-os/procedure-staffing?date=${encodeURIComponent(procedureDate)}`;
  return surgeryId ? `${base}&surgeryId=${encodeURIComponent(surgeryId)}` : base;
}

function credentialsRoute(tenantId: string): string {
  return `/fi-admin/${tenantId}/hr-os/credentials`;
}

export function canApplyRecommendedTeam(rec: ProcedureStaffingRecommendation): boolean {
  return rec.recommendedTeam.some((member) => !member.autoBlocked);
}

export function buildSurgicalProcedureActions(input: {
  tenantId: string;
  surgeryId: string;
  procedureDate: string;
  procedureLabel: string;
  staffingComplete: boolean;
  canApply: boolean;
  caseId?: string | null;
  preferCredentials?: boolean;
}): SurgicalIntelligenceAction[] {
  const actions: SurgicalIntelligenceAction[] = [];
  const wos = `/fi-admin/${input.tenantId}/workforce-os`;

  if (input.preferCredentials) {
    actions.push({
      type: "open_credentials",
      label: "Review credentials",
      route: credentialsRoute(input.tenantId),
    });
  } else if (!input.staffingComplete && input.canApply) {
    actions.push({
      type: "apply_recommended_team",
      label: "Apply recommended team",
      route: `${wos}/procedure-staffing`,
      surgeryId: input.surgeryId,
    });
  }

  actions.push({
    type: "open_procedure_staffing",
    label: input.staffingComplete ? "View staffing" : "Review staffing",
    route: procedureStaffingRoute(input.tenantId, input.procedureDate, input.surgeryId),
    surgeryId: input.surgeryId,
  });

  if (input.caseId) {
    actions.push({
      type: "open_surgery_case",
      label: "Open SurgeryOS case",
      route: caseProcedureDayDetailHref(input.tenantId, input.caseId),
      surgeryId: input.surgeryId,
    });
  }

  return actions;
}

export function buildActionableSurgicalProcedures(
  input: SurgicalWorkforceIntelligenceInput
): ActionableSurgicalProcedure[] {
  const caseBySurgery = input.surgeryCaseById ?? {};
  const procedures: ActionableSurgicalProcedure[] = [];

  for (const rec of collectWeekRecommendations(input.weekOptimizers)) {
    if (rec.staffingComplete) continue;
    const canApply = canApplyRecommendedTeam(rec);
    procedures.push({
      surgeryId: rec.surgeryId,
      procedureLabel: rec.procedureLabel,
      procedureDate: rec.scheduledDate.slice(0, 10),
      staffingComplete: rec.staffingComplete,
      canApplyRecommendedTeam: canApply,
      actions: buildSurgicalProcedureActions({
        tenantId: input.tenantId,
        surgeryId: rec.surgeryId,
        procedureDate: rec.scheduledDate.slice(0, 10),
        procedureLabel: rec.procedureLabel,
        staffingComplete: rec.staffingComplete,
        canApply,
        caseId: caseBySurgery[rec.surgeryId] ?? null,
      }),
    });
  }

  return procedures.sort((a, b) => a.procedureDate.localeCompare(b.procedureDate));
}

export function detectSurgicalStaffingRisks(
  input: SurgicalWorkforceIntelligenceInput
): SurgicalStaffingRiskIntel {
  const recommendations = collectWeekRecommendations(input.weekOptimizers);
  const credentialRisks = input.planning?.credentialRisks ?? [];
  const caseBySurgery = input.surgeryCaseById ?? {};
  const risks: SurgicalStaffingRisk[] = [];

  for (const rec of recommendations) {
    const date = rec.scheduledDate.slice(0, 10);
    const dateLabel = formatProcedureDateLabel(date);
    const caseId = caseBySurgery[rec.surgeryId] ?? null;
    const canApply = canApplyRecommendedTeam(rec);

    const staffingActions = buildSurgicalProcedureActions({
      tenantId: input.tenantId,
      surgeryId: rec.surgeryId,
      procedureDate: date,
      procedureLabel: rec.procedureLabel,
      staffingComplete: rec.staffingComplete,
      canApply,
      caseId,
    });

    for (const missing of rec.missingRoles) {
      if (isSurgeonRole(missing.role)) {
        risks.push({
          id: `missing-surgeon-${rec.surgeryId}`,
          title: `Surgeon missing for ${dateLabel} procedure`,
          severity: "critical",
          procedureDate: date,
          recommendation: `Assign surgeon to ${rec.procedureLabel} on ${dateLabel}.`,
          score: 980,
          surgeryId: rec.surgeryId,
          procedureLabel: rec.procedureLabel,
          actions: staffingActions,
        });
      }
      if (isRnRole(missing.role)) {
        risks.push({
          id: `missing-rn-${rec.surgeryId}`,
          title: `RN missing for ${dateLabel} procedure`,
          severity: "critical",
          procedureDate: date,
          recommendation: `Assign RN to ${rec.procedureLabel} on ${dateLabel}.`,
          score: 900,
          surgeryId: rec.surgeryId,
          procedureLabel: rec.procedureLabel,
          actions: staffingActions,
        });
      }
      if (isTechnicianRole(missing.role)) {
        risks.push({
          id: `missing-tech-${rec.surgeryId}`,
          title: `Technician missing for ${dateLabel} procedure`,
          severity: "warning",
          procedureDate: date,
          recommendation: `Assign technician to ${rec.procedureLabel} on ${dateLabel}.`,
          score: 700,
          surgeryId: rec.surgeryId,
          procedureLabel: rec.procedureLabel,
          actions: staffingActions,
        });
      }
    }

    for (const member of rec.recommendedTeam) {
      const overlap = member.conflicts.find(
        (c) => c.kind === "assignment_overlap" || c.kind === "shift_overlap"
      );
      if (overlap) {
        risks.push({
          id: `double-book-${rec.surgeryId}-${member.staffId}`,
          title: `${member.name} double booked ${dateLabel}`,
          severity: "critical",
          procedureDate: date,
          recommendation: `Reallocate ${member.name} to resolve scheduling conflict on ${dateLabel}.`,
          score: 950,
          surgeryId: rec.surgeryId,
          procedureLabel: rec.procedureLabel,
          actions: staffingActions,
        });
      }
    }

    for (const member of rec.recommendedTeam) {
      if (!isUnsafeAssignment(member)) continue;
      risks.push({
        id: `unsafe-${rec.surgeryId}-${member.staffId}`,
        title: `Unsafe staffing assignment on ${dateLabel}`,
        severity: "warning",
        procedureDate: date,
        recommendation: `Review ${member.name}'s eligibility for ${rec.procedureLabel}.`,
        score: 650,
        surgeryId: rec.surgeryId,
        procedureLabel: rec.procedureLabel,
        actions: staffingActions,
      });
    }

    for (const risk of credentialRisks) {
      if (risk.expiresAt > date) continue;
      const onTeam = rec.recommendedTeam.some((m) => m.staffId === risk.staffMemberId);
      if (!onTeam) continue;
      risks.push({
        id: `credential-${rec.surgeryId}-${risk.staffMemberId}`,
        title: `Credential expires before ${dateLabel} procedure`,
        severity: risk.blocksClinicalWork ? "critical" : "warning",
        procedureDate: date,
        recommendation: `Renew ${risk.displayName} for ${risk.staffName} before ${dateLabel}.`,
        score: risk.blocksClinicalWork ? 960 : 720,
        surgeryId: rec.surgeryId,
        procedureLabel: rec.procedureLabel,
        actions: buildSurgicalProcedureActions({
          tenantId: input.tenantId,
          surgeryId: rec.surgeryId,
          procedureDate: date,
          procedureLabel: rec.procedureLabel,
          staffingComplete: rec.staffingComplete,
          canApply,
          caseId,
          preferCredentials: true,
        }),
      });
    }
  }

  const seen = new Set<string>();
  const detectedRisks = risks
    .sort((a, b) => b.score - a.score)
    .filter((risk) => {
      if (seen.has(risk.id)) return false;
      seen.add(risk.id);
      return true;
    });

  const criticalRisks = detectedRisks.filter((r) => r.severity === "critical").length;
  const warningRisks = detectedRisks.filter((r) => r.severity === "warning").length;

  return {
    totalRisks: detectedRisks.length,
    criticalRisks,
    warningRisks,
    detectedRisks,
  };
}

export function buildSurgicalWorkforceRecommendations(
  input: SurgicalWorkforceIntelligenceInput,
  risks: SurgicalStaffingRiskIntel,
  limit = 6
): SurgicalWorkforceRecommendation[] {
  const base = `/fi-admin/${input.tenantId}/workforce-os`;
  const recommendations: SurgicalWorkforceRecommendation[] = [];

  for (const risk of risks.detectedRisks) {
    const severity: WorkforceAttentionSeverity =
      risk.severity === "critical" ? "critical" : "high";
    const primaryAction = risk.actions[0];
    recommendations.push({
      id: `rec-${risk.id}`,
      title: risk.title,
      severity,
      impact: risk.severity === "critical" ? "high" : "medium",
      route: primaryAction?.route ?? `${base}/procedure-staffing?date=${encodeURIComponent(risk.procedureDate)}`,
      ctaLabel: primaryAction?.label ?? "Open procedure staffing",
      score: risk.score,
      surgeryId: risk.surgeryId,
      procedureDate: risk.procedureDate,
      actions: risk.actions,
    });
  }

  const tomorrow = input.tomorrowOptimizer;
  if (tomorrow && tomorrow.completeCount < tomorrow.procedureCount) {
    const firstAtRisk = tomorrow.recommendations.find((rec) => !rec.staffingComplete);
    const tomorrowActions = firstAtRisk
      ? buildSurgicalProcedureActions({
          tenantId: input.tenantId,
          surgeryId: firstAtRisk.surgeryId,
          procedureDate: input.tomorrowDate,
          procedureLabel: firstAtRisk.procedureLabel,
          staffingComplete: firstAtRisk.staffingComplete,
          canApply: canApplyRecommendedTeam(firstAtRisk),
          caseId: input.surgeryCaseById?.[firstAtRisk.surgeryId] ?? null,
        })
      : [
          {
            type: "open_procedure_staffing" as const,
            label: "Staff tomorrow",
            route: `${base}/procedure-staffing?date=${encodeURIComponent(input.tomorrowDate)}`,
          },
        ];
    const primary = tomorrowActions[0];
    recommendations.push({
      id: "rec-tomorrow-staffing",
      title: `Assign staff to ${tomorrow.procedureCount - tomorrow.completeCount} tomorrow procedure(s)`,
      severity: "high",
      impact: "high",
      route: primary?.route ?? `${base}/procedure-staffing?date=${encodeURIComponent(input.tomorrowDate)}`,
      ctaLabel: primary?.label ?? "Staff tomorrow",
      score: 880,
      surgeryId: firstAtRisk?.surgeryId ?? null,
      procedureDate: input.tomorrowDate,
      actions: tomorrowActions,
    });
  }

  if (input.planning && input.planning.procedureCapacity.understaffedProcedures > 0) {
    recommendations.push({
      id: "rec-week-capacity",
      title: "Add technician capacity this week",
      severity: "medium",
      impact: "medium",
      route: `${base}/procedure-staffing`,
      ctaLabel: "Review capacity",
      score: 600,
      surgeryId: null,
      procedureDate: null,
      actions: [
        {
          type: "open_procedure_staffing",
          label: "Review capacity",
          route: `${base}/procedure-staffing`,
        },
      ],
    });
  }

  const seen = new Set<string>();
  return recommendations
    .sort((a, b) => b.score - a.score)
    .filter((rec) => {
      if (seen.has(rec.id)) return false;
      seen.add(rec.id);
      return true;
    })
    .slice(0, limit);
}

export function resolveSurgicalIntelligenceDates(planning: WorkforcePlanningSnapshot | null): {
  anchorDate: string;
  tomorrowDate: string;
  weekDates: string[];
} {
  const anchorDate = planning?.horizonStart ?? new Date().toISOString().slice(0, 10);
  const tomorrowDate = addDaysIso(anchorDate, 1);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDaysIso(anchorDate, index));
  return { anchorDate, tomorrowDate, weekDates };
}

export function composeSurgicalWorkforceIntelligence(
  input: SurgicalWorkforceIntelligenceInput
): SurgicalWorkforceIntelligencePanel {
  const credentialRisks = input.planning?.credentialRisks ?? [];
  const tomorrowReadiness = buildTomorrowSurgeryReadinessIntel(
    input.tomorrowOptimizer,
    credentialRisks
  );
  const staffingQuality = buildProcedureStaffingQualityIntel(input.weekOptimizers);
  const clinicalCapacity = buildClinicalCapacityIntel(input);
  const staffingRisks = detectSurgicalStaffingRisks(input);
  const recommendations = buildSurgicalWorkforceRecommendations(input, staffingRisks);
  const actionableProcedures = buildActionableSurgicalProcedures(input);

  return {
    tomorrowDate: input.tomorrowDate,
    tomorrowReadiness,
    staffingQuality,
    clinicalCapacity,
    staffingRisks,
    recommendations,
    actionableProcedures,
  };
}