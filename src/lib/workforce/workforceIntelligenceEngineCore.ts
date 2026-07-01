/**
 * WorkforceOS — predictive intelligence composition (pure, no I/O).
 */

import { addDaysIso } from "@/src/lib/workforce/shiftCostIntelligenceCore";
import type {
  WorkforceAttentionSeverity,
  WorkforceCommandCentreComposeInput,
} from "@/src/lib/workforce/workforceCommandCentreCore";
import type { WorkforcePlanningSnapshot } from "@/src/lib/workforce/workforcePlanningEngineCore";

export type WorkforceIntelligenceStatus = "excellent" | "stable" | "watch" | "critical";

export type WorkforceHealthContributingFactor = {
  label: string;
  impact: number;
  severity: WorkforceAttentionSeverity;
};

export type WorkforceOverallHealthScore = {
  score: number;
  status: WorkforceIntelligenceStatus;
  summary: string;
  contributingFactors: WorkforceHealthContributingFactor[];
};

export type TomorrowSurgeryReadiness = {
  scheduledProcedures: number;
  fullyStaffed: number;
  understaffed: number;
  credentialWarnings: number;
  readinessScore: number;
  status: WorkforceIntelligenceStatus;
  summary: string;
  actions: WorkforceExecutiveRecommendation[];
  available: boolean;
};

export type PredictiveStaffingForecast = {
  sevenDayScore: number;
  fourteenDayScore: number;
  upcomingRisks: string[];
  overtimeSignals: string[];
  credentialExpirySignals: string[];
  staffingGapSignals: string[];
  summary: string;
};

export type WorkforceExecutiveRecommendation = {
  id: string;
  title: string;
  description: string;
  severity: WorkforceAttentionSeverity;
  impact: "high" | "medium" | "low";
  route: string;
  ctaLabel: string;
  score: number;
};

export type WorkforceIntelligencePanel = {
  overallHealth: WorkforceOverallHealthScore;
  tomorrowReadiness: TomorrowSurgeryReadiness;
  forecast: PredictiveStaffingForecast;
  executiveRecommendations: WorkforceExecutiveRecommendation[];
};

const TOMORROW_EMPTY_SUMMARY = "No procedure staffing risks detected for tomorrow.";

const SEVERITY_SCORE: Record<WorkforceAttentionSeverity, number> = {
  critical: 1000,
  high: 750,
  medium: 500,
  low: 250,
};

export function clampIntelligenceScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreToIntelligenceStatus(score: number): WorkforceIntelligenceStatus {
  const clamped = clampIntelligenceScore(score);
  if (clamped >= 90) return "excellent";
  if (clamped >= 75) return "stable";
  if (clamped >= 50) return "watch";
  return "critical";
}

function safePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function isDateInHorizon(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function shortagesInWindow(
  planning: WorkforcePlanningSnapshot,
  windowStart: string,
  windowEnd: string
): typeof planning.staffingShortages {
  return planning.staffingShortages.filter((shortage) =>
    shortage.affectedDates.some((d) => isDateInHorizon(d, windowStart, windowEnd))
  );
}

function credentialRisksInWindow(
  planning: WorkforcePlanningSnapshot,
  maxDaysUntilExpiry: number
): typeof planning.credentialRisks {
  return planning.credentialRisks.filter((risk) => risk.daysUntilExpiry <= maxDaysUntilExpiry);
}

export function buildOverallWorkforceHealthScore(
  input: WorkforceCommandCentreComposeInput
): WorkforceOverallHealthScore {
  const ops = input.operationalMetrics;
  const planning = input.planning;
  const totalStaff = Math.max(input.totalStaff, 1);
  const factors: WorkforceHealthContributingFactor[] = [];
  let score = 100;

  const credentialIssues =
    (ops?.expiringCredentials ?? 0) +
    (ops?.expiredCertifications ?? 0) +
    (ops?.complianceAlerts ?? 0) +
    (planning?.credentialRisks.length ?? 0);
  if (credentialIssues > 0) {
    const penalty = Math.min(25, credentialIssues * 4);
    score -= penalty;
    factors.push({
      label: "Credential & compliance risks",
      impact: -penalty,
      severity: credentialIssues >= 5 ? "critical" : credentialIssues >= 2 ? "high" : "medium",
    });
  }

  const clinicallyEligible = ops?.clinicallyEligibleStaff ?? 0;
  const readinessPct = safePercent(clinicallyEligible, input.totalStaff);
  if (readinessPct != null && readinessPct < 90) {
    const penalty = Math.min(15, Math.round((90 - readinessPct) / 3));
    score -= penalty;
    factors.push({
      label: "Training & clinical readiness",
      impact: -penalty,
      severity: readinessPct < 60 ? "high" : "medium",
    });
  }

  const unlinked = ops?.unlinkedStaffCount ?? 0;
  if (unlinked > 0) {
    const penalty = Math.min(10, unlinked * 2);
    score -= penalty;
    factors.push({
      label: "Unlinked HR identities",
      impact: -penalty,
      severity: unlinked >= 5 ? "high" : "medium",
    });
  }

  const duplicates = ops?.openDuplicateCount ?? 0;
  if (duplicates > 0) {
    const penalty = Math.min(10, duplicates * 3);
    score -= penalty;
    factors.push({
      label: "Duplicate staff conflicts",
      impact: -penalty,
      severity: duplicates >= 3 ? "high" : "medium",
    });
  }

  if (input.missingWageProfileCount > 0) {
    const penalty = Math.min(
      15,
      Math.round((input.missingWageProfileCount / totalStaff) * 30) + 2
    );
    score -= penalty;
    factors.push({
      label: "Missing wage profiles",
      impact: -penalty,
      severity: input.missingWageProfileCount >= 5 ? "high" : "medium",
    });
  }

  const procedureCoverage = planning?.procedureCapacity.capacityUtilizationPercent ?? null;
  if (procedureCoverage != null && procedureCoverage < 90) {
    const penalty = Math.min(15, Math.round((90 - procedureCoverage) / 4));
    score -= penalty;
    factors.push({
      label: "Procedure staffing coverage",
      impact: -penalty,
      severity: procedureCoverage < 60 ? "high" : "medium",
    });
  } else if (!planning && input.totalStaff > 0) {
    const penalty = 5;
    score -= penalty;
    factors.push({
      label: "Procedure staffing coverage",
      impact: -penalty,
      severity: "low",
    });
  }

  if (input.openRecruitmentCount > 0) {
    const recommendedHires = planning?.recruitmentForecast.recommendedHires ?? 0;
    const penalty = Math.min(5, input.openRecruitmentCount + (recommendedHires > 0 ? 2 : 0));
    score -= penalty;
    factors.push({
      label: "Open recruitment roles",
      impact: -penalty,
      severity: recommendedHires > 0 ? "medium" : "low",
    });
  }

  const availabilityPct = safePercent(clinicallyEligible, input.totalStaff);
  if (availabilityPct != null && availabilityPct < 80 && clinicallyEligible < input.totalStaff) {
    const penalty = Math.min(5, Math.round((80 - availabilityPct) / 8));
    if (penalty > 0 && !factors.some((f) => f.label === "Training & clinical readiness")) {
      score -= penalty;
      factors.push({
        label: "Staff availability",
        impact: -penalty,
        severity: "medium",
      });
    }
  }

  const clamped = clampIntelligenceScore(score);
  const status = scoreToIntelligenceStatus(clamped);

  const summary =
    status === "excellent"
      ? "Workforce posture is strong — credential, staffing, and payroll signals are within acceptable thresholds."
      : status === "stable"
        ? "Workforce posture is stable with isolated risks that should be monitored this week."
        : status === "watch"
          ? "Workforce risk is elevated — multiple signals require operational review before procedures scale."
          : "Workforce risk is critical — immediate action is required across compliance, identity, and staffing controls.";

  return {
    score: clamped,
    status,
    summary,
    contributingFactors: factors.sort((a, b) => a.impact - b.impact),
  };
}

export function buildTomorrowSurgeryReadiness(
  input: WorkforceCommandCentreComposeInput
): TomorrowSurgeryReadiness {
  const planning = input.planning;
  const base = `/fi-admin/${input.tenantId}/workforce-os`;

  if (!planning) {
    return {
      scheduledProcedures: 0,
      fullyStaffed: 0,
      understaffed: 0,
      credentialWarnings: 0,
      readinessScore: 100,
      status: "excellent",
      summary: TOMORROW_EMPTY_SUMMARY,
      actions: [],
      available: false,
    };
  }

  const tomorrow = addDaysIso(planning.horizonStart, 1);
  if (!isDateInHorizon(tomorrow, planning.horizonStart, planning.horizonEnd)) {
    return {
      scheduledProcedures: 0,
      fullyStaffed: 0,
      understaffed: 0,
      credentialWarnings: 0,
      readinessScore: 100,
      status: "excellent",
      summary: TOMORROW_EMPTY_SUMMARY,
      actions: [],
      available: false,
    };
  }

  const tomorrowShortages = planning.staffingShortages.filter((s) =>
    s.affectedDates.includes(tomorrow)
  );
  const credentialWarnings = planning.credentialRisks.filter(
    (r) => r.daysUntilExpiry <= 1 && (r.blocksClinicalWork || r.severity === "high" || r.severity === "critical")
  ).length;

  const understaffed = tomorrowShortages.length;
  const scheduledProcedures = understaffed;
  const fullyStaffed = 0;

  if (understaffed === 0 && credentialWarnings === 0) {
    return {
      scheduledProcedures: 0,
      fullyStaffed: 0,
      understaffed: 0,
      credentialWarnings: 0,
      readinessScore: 100,
      status: "excellent",
      summary: TOMORROW_EMPTY_SUMMARY,
      actions: [],
      available: true,
    };
  }

  let readinessScore = 100;
  readinessScore -= Math.min(40, understaffed * 12);
  readinessScore -= Math.min(35, credentialWarnings * 10);
  const clampedReadiness = clampIntelligenceScore(readinessScore);
  const status = scoreToIntelligenceStatus(clampedReadiness);

  const actions: WorkforceExecutiveRecommendation[] = [];
  if (understaffed > 0) {
    const top = tomorrowShortages[0];
    actions.push({
      id: "tomorrow-staff-procedures",
      title: "Assign staff to understaffed procedures",
      description: `${understaffed} role gap(s) detected for tomorrow (${tomorrow}).`,
      severity: understaffed >= 3 ? "critical" : "high",
      impact: "high",
      route: `${base}/procedure-staffing?date=${encodeURIComponent(tomorrow)}`,
      ctaLabel: "Staff tomorrow",
      score: SEVERITY_SCORE.high + understaffed * 10,
    });
    if (top) {
      actions.push({
        id: "tomorrow-fill-role",
        title: `Fill ${top.role} shortage for tomorrow`,
        description: top.reason,
        severity: "high",
        impact: "high",
        route: `${base}/procedure-staffing?date=${encodeURIComponent(tomorrow)}`,
        ctaLabel: "Review roles",
        score: SEVERITY_SCORE.high + top.shortageCount * 5,
      });
    }
  }
  if (credentialWarnings > 0) {
    actions.push({
      id: "tomorrow-credential-warnings",
      title: "Resolve credential warnings",
      description: `${credentialWarnings} credential warning(s) may affect tomorrow's clinical staffing.`,
      severity: "high",
      impact: "high",
      route: `${base.replace("/workforce-os", "/hr-os")}/credentials`,
      ctaLabel: "Review credentials",
      score: SEVERITY_SCORE.high + credentialWarnings * 8,
    });
  }

  const summary =
    understaffed > 0 && credentialWarnings > 0
      ? `Tomorrow (${tomorrow}) has ${understaffed} staffing gap(s) and ${credentialWarnings} credential warning(s).`
      : understaffed > 0
        ? `Tomorrow (${tomorrow}) has ${understaffed} staffing gap(s) requiring assignment.`
        : `Tomorrow (${tomorrow}) has ${credentialWarnings} credential warning(s) to resolve before procedures.`;

  return {
    scheduledProcedures,
    fullyStaffed,
    understaffed,
    credentialWarnings,
    readinessScore: clampedReadiness,
    status,
    summary,
    actions: actions.sort((a, b) => b.score - a.score),
    available: true,
  };
}

export function buildPredictiveStaffingForecast(
  input: WorkforceCommandCentreComposeInput
): PredictiveStaffingForecast {
  const planning = input.planning;

  if (!planning) {
    return {
      sevenDayScore: 75,
      fourteenDayScore: 75,
      upcomingRisks: [],
      overtimeSignals: [],
      credentialExpirySignals: [],
      staffingGapSignals: [],
      summary: "Planning snapshot unavailable — refresh planning signals to generate workforce forecasts.",
    };
  }

  const sevenDayEnd = addDaysIso(planning.horizonStart, 6);
  const sevenDayShortages = shortagesInWindow(planning, planning.horizonStart, sevenDayEnd);
  const fourteenDayShortages = planning.staffingShortages;

  const sevenDayGapCount = sevenDayShortages.reduce((sum, s) => sum + s.shortageCount, 0);
  const fourteenDayGapCount = fourteenDayShortages.reduce((sum, s) => sum + s.shortageCount, 0);

  const sevenDayCredRisks = credentialRisksInWindow(planning, 7);
  const fourteenDayCredRisks = credentialRisksInWindow(planning, 14);

  let sevenDayScore = 100;
  sevenDayScore -= Math.min(30, sevenDayGapCount * 3);
  sevenDayScore -= Math.min(25, sevenDayCredRisks.length * 4);
  sevenDayScore -= Math.min(
    20,
    Math.max(0, 100 - planning.procedureCapacity.capacityUtilizationPercent) / 5
  );

  let fourteenDayScore = 100;
  fourteenDayScore -= Math.min(35, fourteenDayGapCount * 2);
  fourteenDayScore -= Math.min(30, fourteenDayCredRisks.length * 3);
  fourteenDayScore -= Math.min(
    25,
    Math.max(0, 100 - planning.procedureCapacity.capacityUtilizationPercent) / 4
  );
  if (planning.recruitmentForecast.recommendedHires > 0) {
    fourteenDayScore -= Math.min(10, planning.recruitmentForecast.recommendedHires * 3);
  }

  const upcomingRisks: string[] = [];
  if (planning.procedureCapacity.understaffedProcedures > 0) {
    upcomingRisks.push(
      `${planning.procedureCapacity.understaffedProcedures} understaffed procedure(s) in the ${planning.procedureCapacity.horizonDays}-day horizon.`
    );
  }
  if (planning.recruitmentForecast.recommendedHires > 0) {
    upcomingRisks.push(
      `${planning.recruitmentForecast.recommendedHires} additional hire(s) recommended beyond late-stage pipeline.`
    );
  }
  if (input.missingWageProfileCount > 0) {
    upcomingRisks.push(
      `${input.missingWageProfileCount} active staff lack wage profiles — labour forecasts may be incomplete.`
    );
  }

  const overtimeSignals: string[] = [];
  if (sevenDayGapCount > 0) {
    overtimeSignals.push(
      `${sevenDayGapCount} staffing gap(s) in the next 7 days may require overtime or cross-cover.`
    );
  }
  if (planning.weeklyWageExposureCents > 0 && sevenDayGapCount > 0) {
    overtimeSignals.push("Elevated weekly wage exposure coincides with near-term staffing gaps.");
  }

  const credentialExpirySignals = fourteenDayCredRisks.slice(0, 5).map(
    (r) =>
      `${r.staffName}: ${r.displayName} expires ${r.expiresAt} (${r.daysUntilExpiry}d)`
  );

  const staffingGapSignals = fourteenDayShortages.slice(0, 5).map(
    (s) => `${s.role}: ${s.shortageCount} gap(s) across ${s.affectedDates.length} day(s)`
  );

  const sevenClamped = clampIntelligenceScore(sevenDayScore);
  const fourteenClamped = clampIntelligenceScore(fourteenDayScore);
  const sevenStatus = scoreToIntelligenceStatus(sevenClamped);
  const fourteenStatus = scoreToIntelligenceStatus(fourteenClamped);

  const summary =
    sevenStatus === "excellent" && fourteenStatus === "excellent"
      ? "7- and 14-day workforce forecasts are stable with no material staffing or credential risks."
      : sevenStatus === "critical" || fourteenStatus === "critical"
        ? "Forecast signals critical staffing or credential risk — review gaps before the week progresses."
        : "Forecast shows emerging workforce pressure — monitor staffing gaps and credential renewals.";

  return {
    sevenDayScore: sevenClamped,
    fourteenDayScore: fourteenClamped,
    upcomingRisks,
    overtimeSignals,
    credentialExpirySignals,
    staffingGapSignals,
    summary,
  };
}

export function buildExecutiveRecommendations(
  input: WorkforceCommandCentreComposeInput,
  limit = 6
): WorkforceExecutiveRecommendation[] {
  const base = `/fi-admin/${input.tenantId}/workforce-os`;
  const hrBase = `/fi-admin/${input.tenantId}/hr-os`;
  const ops = input.operationalMetrics;
  const planning = input.planning;
  const recommendations: WorkforceExecutiveRecommendation[] = [];

  if (input.missingWageProfileCount > 0) {
    recommendations.push({
      id: "rec-missing-wage-profiles",
      title: "Complete missing wage profiles",
      description: `${input.missingWageProfileCount} active staff lack wage profiles — labour forecasts and payroll exposure are incomplete.`,
      severity: input.missingWageProfileCount >= 5 ? "high" : "medium",
      impact: "high",
      route: `${base}/payroll`,
      ctaLabel: "Open payroll",
      score: SEVERITY_SCORE.medium + input.missingWageProfileCount * 4,
    });
  }

  if ((ops?.unlinkedStaffCount ?? 0) > 0) {
    recommendations.push({
      id: "rec-unlinked-hr",
      title: "Reconcile unlinked HR identities",
      description: `${ops!.unlinkedStaffCount} active staff member(s) are not linked to IIOHR.`,
      severity: (ops!.unlinkedStaffCount ?? 0) >= 5 ? "high" : "medium",
      impact: "high",
      route: `${base}/hr-reconciliation`,
      ctaLabel: "Run reconciliation",
      score: SEVERITY_SCORE.medium + ops!.unlinkedStaffCount * 5,
    });
  }

  if ((ops?.openDuplicateCount ?? 0) > 0) {
    recommendations.push({
      id: "rec-duplicate-conflicts",
      title: "Review duplicate staff conflicts",
      description: `${ops!.openDuplicateCount} duplicate candidate(s) need identity resolution.`,
      severity: "medium",
      impact: "medium",
      route: `${hrBase}/duplicates`,
      ctaLabel: "Review duplicates",
      score: SEVERITY_SCORE.medium + ops!.openDuplicateCount * 4,
    });
  }

  if (planning) {
    if (planning.procedureCapacity.understaffedProcedures > 0) {
      recommendations.push({
        id: "rec-understaffed-procedures",
        title: "Assign staff to understaffed procedures",
        description: `${planning.procedureCapacity.understaffedProcedures} of ${planning.procedureCapacity.scheduledProcedures} procedures are understaffed in the planning horizon.`,
        severity: "high",
        impact: "high",
        route: `${base}/procedure-staffing?date=${encodeURIComponent(planning.horizonStart)}`,
        ctaLabel: "Staff procedures",
        score: SEVERITY_SCORE.high + planning.procedureCapacity.understaffedProcedures * 10,
      });
    }

    const blockingCreds = planning.credentialRisks.filter(
      (r) => r.severity === "critical" || r.severity === "high"
    );
    if (blockingCreds.length > 0) {
      recommendations.push({
        id: "rec-credential-warnings",
        title: "Resolve credential warnings",
        description: `${blockingCreds.length} credential(s) at high or critical expiry risk in the planning window.`,
        severity: blockingCreds.some((r) => r.severity === "critical") ? "critical" : "high",
        impact: "high",
        route: `${hrBase}/credentials`,
        ctaLabel: "Review credentials",
        score: SEVERITY_SCORE.high + blockingCreds.length * 6,
      });
    }

    if (planning.recruitmentForecast.recommendedHires > 0 || input.openRecruitmentCount > 0) {
      recommendations.push({
        id: "rec-open-recruitment",
        title: "Open recruitment for uncovered roles",
        description:
          planning.recruitmentForecast.recommendedHires > 0
            ? planning.recruitmentForecast.reason
            : `${input.openRecruitmentCount} open role requirement(s) need pipeline coverage.`,
        severity: planning.recruitmentForecast.recommendedHires > 0 ? "medium" : "low",
        impact: "medium",
        route: `${base}/recruitment`,
        ctaLabel: "Open recruitment",
        score:
          SEVERITY_SCORE.medium +
          planning.recruitmentForecast.recommendedHires * 6 +
          input.openRecruitmentCount,
      });
    }

    for (const action of planning.nextBestActions) {
      recommendations.push({
        id: `planning-${action.id}`,
        title: action.title,
        description: action.description,
        severity: action.priority,
        impact: action.priority === "critical" || action.priority === "high" ? "high" : "medium",
        route: action.href ?? base,
        ctaLabel: "Take action",
        score: action.score,
      });
    }
  }

  if ((ops?.expiredCertifications ?? 0) > 0) {
    recommendations.push({
      id: "rec-expired-certifications",
      title: "Resolve expired certifications",
      description: `${ops!.expiredCertifications} certification(s) are expired and may block clinical work.`,
      severity: "critical",
      impact: "high",
      route: `${hrBase}/certifications`,
      ctaLabel: "Review certifications",
      score: SEVERITY_SCORE.critical + ops!.expiredCertifications * 8,
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

export function composeWorkforceIntelligence(
  input: WorkforceCommandCentreComposeInput
): WorkforceIntelligencePanel {
  const executiveRecommendations = buildExecutiveRecommendations(input, 6);

  return {
    overallHealth: buildOverallWorkforceHealthScore(input),
    tomorrowReadiness: buildTomorrowSurgeryReadiness(input),
    forecast: buildPredictiveStaffingForecast(input),
    executiveRecommendations,
  };
}