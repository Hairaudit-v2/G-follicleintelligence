/**
 * WorkforceOS Readiness Scoring v2 — multi-factor 0–100 intelligence model.
 * Runs alongside `deriveStaffReadinessState()`; does not replace legacy readiness states.
 */

import {
  isHrOnboardingIncomplete,
  isTrainingIncomplete,
  staffHasConfiguredWorkingHours,
} from "@/src/lib/hr/hrStaffReadinessDashboard";
import type { StaffHrNotificationSummary } from "@/src/lib/staff/staffHrNotificationSummary";
import type { StaffComplianceItem, StaffComplianceSummary } from "@/src/lib/staffCompliance/staffComplianceTypes";
import {
  buildWorkforceIdentityReadinessSignals,
  type WorkforceIdentityReadinessSignals,
} from "@/src/lib/workforce-os/workforceIdentityReadinessSignals";
import type { WorkforceIdentitySourceRowInput } from "@/src/lib/workforce-os/workforceIdentitySummary";
import {
  clampWorkforceReadinessScore,
  resolveWorkforceReadinessBand,
  type WorkforceReadinessBand,
  type WorkforceReadinessBandId,
} from "@/src/lib/workforce-os/workforceReadinessBands";

export type WorkforceReadinessFactorKey =
  | "onboarding"
  | "training"
  | "certification"
  | "sop_compliance"
  | "working_hours"
  | "availability"
  | "hr_sync"
  | "academy_sync"
  | "competency";

export type WorkforceReadinessFactor = {
  key: WorkforceReadinessFactorKey;
  label: string;
  score: number;
  maxScore: number;
};

export type WorkforceReadinessBlockingIssue =
  | "inactive"
  | "no_hr_identity"
  | "onboarding_incomplete"
  | "training_incomplete"
  | "certification_expired"
  | "mandatory_sop_incomplete"
  | "sync_revoked"
  | "critical_compliance_expired";

export type WorkforceReadinessWarning =
  | "sop_expiring_soon"
  | "certification_expiring_soon"
  | "academy_sync_stale"
  | "hr_sync_stale"
  | "working_hours_incomplete"
  | "competency_review_due_soon";

export type WorkforceReadinessScoreInput = {
  is_active: boolean;
  staff_role: string | null | undefined;
  working_hours: Record<string, unknown> | null | undefined;
  hr: StaffHrNotificationSummary;
  identityRows: WorkforceIdentitySourceRowInput[];
  compliance: StaffComplianceSummary;
  /** Optional competency review due date (ISO) from identity metadata. */
  competencyReviewDueAt?: string | null;
  now?: Date;
};

export type WorkforceReadinessScoreResult = {
  score: number;
  band: WorkforceReadinessBandId;
  bandLabel: string;
  bandDetail: WorkforceReadinessBand;
  factors: WorkforceReadinessFactor[];
  blocking_issues: WorkforceReadinessBlockingIssue[];
  warnings: WorkforceReadinessWarning[];
  identitySignals: WorkforceIdentityReadinessSignals;
};

export const WORKFORCE_READINESS_FACTOR_WEIGHTS: Record<WorkforceReadinessFactorKey, number> = {
  onboarding: 20,
  training: 20,
  certification: 20,
  sop_compliance: 15,
  working_hours: 10,
  availability: 5,
  hr_sync: 5,
  academy_sync: 5,
  competency: 5,
};

/** Sum of factor max scores — normalized to 0–100 for the headline readiness score. */
export const WORKFORCE_READINESS_RAW_MAX = Object.values(WORKFORCE_READINESS_FACTOR_WEIGHTS).reduce(
  (sum, w) => sum + w,
  0
);

const MS_DAY = 86_400_000;
const SOP_EXPIRING_SOON_DAYS = 14;
const CERT_EXPIRING_SOON_DAYS = 30;
const COMPETENCY_REVIEW_SOON_DAYS = 30;

function parseIsoDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const t = Date.parse(raw.trim());
  return Number.isNaN(t) ? null : new Date(t);
}

function daysUntil(date: Date, now: Date): number {
  return (date.getTime() - now.getTime()) / MS_DAY;
}

function isCertificationItem(item: StaffComplianceItem): boolean {
  const hay = `${item.id} ${item.label}`.toLowerCase();
  return hay.includes("cert") || hay.includes("certificate") || hay.includes("licence") || hay.includes("license");
}

function isSopItem(item: StaffComplianceItem): boolean {
  if (isCertificationItem(item)) return false;
  const hay = `${item.id} ${item.label}`.toLowerCase();
  return hay.includes("sop") || item.metadata?.kind === "sop" || item.metadata?.type === "sop";
}

function isCompetencyItem(item: StaffComplianceItem): boolean {
  const hay = `${item.id} ${item.label}`.toLowerCase();
  return hay.includes("competency") || item.metadata?.kind === "competency";
}

function partitionComplianceItems(compliance: StaffComplianceSummary): {
  trainingItems: StaffComplianceItem[];
  certificationItems: StaffComplianceItem[];
  sopItems: StaffComplianceItem[];
  competencyItems: StaffComplianceItem[];
} {
  const trainingItems: StaffComplianceItem[] = [];
  const certificationItems: StaffComplianceItem[] = [];
  const sopItems: StaffComplianceItem[] = [];
  const competencyItems: StaffComplianceItem[] = [];

  for (const item of compliance.items) {
    if (isCompetencyItem(item)) {
      competencyItems.push(item);
      continue;
    }
    if (isCertificationItem(item)) {
      certificationItems.push(item);
      continue;
    }
    if (isSopItem(item)) {
      sopItems.push(item);
      continue;
    }
    trainingItems.push(item);
  }

  return { trainingItems, certificationItems, sopItems, competencyItems };
}

function ratioScore(current: number, total: number, maxScore: number): number {
  if (total <= 0) return maxScore;
  const ratio = Math.max(0, Math.min(1, current / total));
  return Math.round(ratio * maxScore);
}

function scoreOnboarding(hr: StaffHrNotificationSummary): number {
  const max = WORKFORCE_READINESS_FACTOR_WEIGHTS.onboarding;
  if (!hr.hasHrLink) return 0;
  if (isHrOnboardingIncomplete(hr)) {
    if (hr.onboardingStatus === "incomplete") return 0;
    const missing = hr.required_documents_missing_count ?? 0;
    if (missing > 0) return Math.max(0, max - Math.min(max, missing * 5));
    return 0;
  }
  return max;
}

function scoreTraining(hr: StaffHrNotificationSummary, trainingItems: StaffComplianceItem[]): number {
  const max = WORKFORCE_READINESS_FACTOR_WEIGHTS.training;
  const hrRequired = hr.training_required_count ?? 0;

  if (trainingItems.length > 0) {
    const current = trainingItems.filter((i) => i.status === "current" || i.status === "unknown").length;
    const hrPenalty = hrRequired > 0 ? Math.min(max, hrRequired * 4) : 0;
    return Math.max(0, ratioScore(current, trainingItems.length, max) - hrPenalty);
  }

  if (hr.hasHrLink && !isTrainingIncomplete(hr) && hrRequired === 0) return max;
  if (hrRequired > 0) return Math.max(0, max - Math.min(max, hrRequired * 5));
  if (isTrainingIncomplete(hr)) return 0;
  return hr.hasHrLink ? max : Math.round(max * 0.5);
}

function scoreCertification(hr: StaffHrNotificationSummary, certificationItems: StaffComplianceItem[]): number {
  const max = WORKFORCE_READINESS_FACTOR_WEIGHTS.certification;
  const outstanding = hr.certificates_outstanding_count ?? 0;

  if (certificationItems.some((i) => i.status === "expired")) return 0;
  if (certificationItems.length > 0) {
    const current = certificationItems.filter((i) => i.status === "current" || i.status === "unknown").length;
    const dueSoon = certificationItems.filter((i) => i.status === "due_soon").length;
    const base = ratioScore(current, certificationItems.length, max);
    const penalty = dueSoon > 0 ? Math.min(max * 0.25, dueSoon * 3) : 0;
    const hrPenalty = outstanding > 0 ? Math.min(max, outstanding * 5) : 0;
    return Math.max(0, base - penalty - hrPenalty);
  }

  if (outstanding > 0) return Math.max(0, max - Math.min(max, outstanding * 5));
  if (hr.hasHrLink && outstanding === 0) return max;
  return Math.round(max * 0.6);
}

function scoreSopCompliance(sopItems: StaffComplianceItem[]): number {
  const max = WORKFORCE_READINESS_FACTOR_WEIGHTS.sop_compliance;
  if (sopItems.length === 0) return max;
  if (sopItems.some((i) => i.status === "expired" || i.status === "missing")) {
    const bad = sopItems.filter((i) => i.status === "expired" || i.status === "missing").length;
    return Math.max(0, max - Math.min(max, bad * 5));
  }
  const current = sopItems.filter((i) => i.status === "current" || i.status === "unknown").length;
  const dueSoon = sopItems.filter((i) => i.status === "due_soon").length;
  const base = ratioScore(current, sopItems.length, max);
  return Math.max(0, base - (dueSoon > 0 ? Math.min(max * 0.2, dueSoon * 2) : 0));
}

function scoreWorkingHours(working_hours: Record<string, unknown> | null | undefined): number {
  const max = WORKFORCE_READINESS_FACTOR_WEIGHTS.working_hours;
  return staffHasConfiguredWorkingHours(working_hours) ? max : 0;
}

function scoreAvailability(is_active: boolean): number {
  const max = WORKFORCE_READINESS_FACTOR_WEIGHTS.availability;
  return is_active ? max : 0;
}

function scoreHrSync(signals: WorkforceIdentityReadinessSignals, hr: StaffHrNotificationSummary): number {
  const max = WORKFORCE_READINESS_FACTOR_WEIGHTS.hr_sync;
  if (!signals.hasHrIdentityLink) return 0;
  if (signals.syncStatus === "revoked") return 0;
  if (signals.isHrSyncStale || hr.isSyncStale) return Math.round(max * 0.4);
  if (signals.syncStatus === "error" || signals.syncStatus === "stale") return Math.round(max * 0.5);
  return max;
}

function scoreAcademySync(signals: WorkforceIdentityReadinessSignals): number {
  const max = WORKFORCE_READINESS_FACTOR_WEIGHTS.academy_sync;
  if (!signals.hasAcademyIdentityLink) return Math.round(max * 0.5);
  if (signals.isAcademySyncStale) return Math.round(max * 0.4);
  if (signals.syncStatus === "revoked") return 0;
  return max;
}

function scoreCompetency(
  signals: WorkforceIdentityReadinessSignals,
  competencyItems: StaffComplianceItem[],
  competencyReviewDueAt: string | null | undefined,
  now: Date
): number {
  const max = WORKFORCE_READINESS_FACTOR_WEIGHTS.competency;
  if (competencyItems.some((i) => i.status === "expired" || i.status === "missing")) {
    return Math.max(0, Math.round(max * 0.3));
  }
  if (competencyItems.length > 0) {
    const current = competencyItems.filter((i) => i.status === "current" || i.status === "unknown").length;
    return ratioScore(current, competencyItems.length, max);
  }
  const due = parseIsoDate(competencyReviewDueAt);
  if (due) {
    const days = daysUntil(due, now);
    if (days < 0) return Math.round(max * 0.4);
    if (days <= COMPETENCY_REVIEW_SOON_DAYS) return Math.round(max * 0.7);
  }
  return signals.competencySource ? max : Math.round(max * 0.6);
}

function extractCompetencyReviewDueAt(rows: WorkforceIdentitySourceRowInput[]): string | null {
  for (const row of rows) {
    const md = row.metadata;
    if (!md || typeof md !== "object") continue;
    const raw = (md as Record<string, unknown>).competency_review_due_at;
    if (raw != null && String(raw).trim()) return String(raw).trim();
  }
  return null;
}

function collectBlockingIssues(input: {
  is_active: boolean;
  hr: StaffHrNotificationSummary;
  signals: WorkforceIdentityReadinessSignals;
  compliance: StaffComplianceSummary;
  trainingItems: StaffComplianceItem[];
  certificationItems: StaffComplianceItem[];
  sopItems: StaffComplianceItem[];
}): WorkforceReadinessBlockingIssue[] {
  const issues: WorkforceReadinessBlockingIssue[] = [];

  if (!input.is_active) issues.push("inactive");
  if (!input.signals.hasHrIdentityLink) issues.push("no_hr_identity");
  if (input.signals.syncStatus === "revoked") issues.push("sync_revoked");
  if (isHrOnboardingIncomplete(input.hr)) issues.push("onboarding_incomplete");
  if (isTrainingIncomplete(input.hr)) issues.push("training_incomplete");
  if ((input.hr.certificates_outstanding_count ?? 0) > 0) issues.push("certification_expired");
  if (input.certificationItems.some((i) => i.status === "expired")) issues.push("certification_expired");
  if (input.sopItems.some((i) => i.status === "missing" || i.status === "expired")) {
    issues.push("mandatory_sop_incomplete");
  }
  if (input.compliance.overallStatus === "expired" && input.compliance.counts.expired > 0) {
    issues.push("critical_compliance_expired");
  }

  return [...new Set(issues)];
}

function collectWarnings(input: {
  hr: StaffHrNotificationSummary;
  signals: WorkforceIdentityReadinessSignals;
  working_hours: Record<string, unknown> | null | undefined;
  sopItems: StaffComplianceItem[];
  certificationItems: StaffComplianceItem[];
  competencyItems: StaffComplianceItem[];
  competencyReviewDueAt: string | null;
  now: Date;
}): WorkforceReadinessWarning[] {
  const warnings: WorkforceReadinessWarning[] = [];

  if (input.signals.isAcademySyncStale) warnings.push("academy_sync_stale");
  if (input.signals.isHrSyncStale || input.hr.isSyncStale) warnings.push("hr_sync_stale");
  if (!staffHasConfiguredWorkingHours(input.working_hours)) warnings.push("working_hours_incomplete");

  for (const item of input.sopItems) {
    if (item.status === "due_soon") {
      const exp = parseIsoDate(item.expiresAt);
      if (exp && daysUntil(exp, input.now) <= SOP_EXPIRING_SOON_DAYS) {
        warnings.push("sop_expiring_soon");
        break;
      }
    }
    if (item.status === "current" && item.expiresAt) {
      const exp = parseIsoDate(item.expiresAt);
      if (exp && daysUntil(exp, input.now) <= SOP_EXPIRING_SOON_DAYS) {
        warnings.push("sop_expiring_soon");
        break;
      }
    }
  }

  for (const item of input.certificationItems) {
    if (item.status === "due_soon") {
      const exp = parseIsoDate(item.expiresAt);
      if (exp && daysUntil(exp, input.now) <= CERT_EXPIRING_SOON_DAYS) {
        warnings.push("certification_expiring_soon");
        break;
      }
    }
    if (item.status === "current" && item.expiresAt) {
      const exp = parseIsoDate(item.expiresAt);
      if (exp && daysUntil(exp, input.now) <= CERT_EXPIRING_SOON_DAYS) {
        warnings.push("certification_expiring_soon");
        break;
      }
    }
  }
  if (!warnings.includes("certification_expiring_soon") && (input.hr.certificates_outstanding_count ?? 0) > 0) {
    // HR snapshot flags outstanding certs as a softer signal when item rows are absent.
  }

  const competencyDue = parseIsoDate(input.competencyReviewDueAt);
  if (competencyDue && daysUntil(competencyDue, input.now) <= COMPETENCY_REVIEW_SOON_DAYS) {
    warnings.push("competency_review_due_soon");
  } else if (input.competencyItems.some((i) => i.status === "due_soon")) {
    warnings.push("competency_review_due_soon");
  }

  return [...new Set(warnings)];
}

/**
 * Computes the WorkforceOS 0–100 readiness score from staff, HR, identity, and compliance inputs.
 */
export function calculateWorkforceReadinessScore(
  input: WorkforceReadinessScoreInput
): WorkforceReadinessScoreResult {
  const now = input.now ?? new Date();
  const signals = buildWorkforceIdentityReadinessSignals(input.identityRows, now);
  const competencyReviewDueAt =
    input.competencyReviewDueAt ?? extractCompetencyReviewDueAt(input.identityRows);

  const { trainingItems, certificationItems, sopItems, competencyItems } = partitionComplianceItems(
    input.compliance
  );

  const factors: WorkforceReadinessFactor[] = [
    {
      key: "onboarding",
      label: "Onboarding",
      score: scoreOnboarding(input.hr),
      maxScore: WORKFORCE_READINESS_FACTOR_WEIGHTS.onboarding,
    },
    {
      key: "training",
      label: "Training",
      score: scoreTraining(input.hr, trainingItems),
      maxScore: WORKFORCE_READINESS_FACTOR_WEIGHTS.training,
    },
    {
      key: "certification",
      label: "Certification",
      score: scoreCertification(input.hr, certificationItems),
      maxScore: WORKFORCE_READINESS_FACTOR_WEIGHTS.certification,
    },
    {
      key: "sop_compliance",
      label: "SOP Compliance",
      score: scoreSopCompliance(sopItems),
      maxScore: WORKFORCE_READINESS_FACTOR_WEIGHTS.sop_compliance,
    },
    {
      key: "working_hours",
      label: "Working Hours",
      score: scoreWorkingHours(input.working_hours),
      maxScore: WORKFORCE_READINESS_FACTOR_WEIGHTS.working_hours,
    },
    {
      key: "availability",
      label: "Active Employment",
      score: scoreAvailability(input.is_active),
      maxScore: WORKFORCE_READINESS_FACTOR_WEIGHTS.availability,
    },
    {
      key: "hr_sync",
      label: "HR Sync Freshness",
      score: scoreHrSync(signals, input.hr),
      maxScore: WORKFORCE_READINESS_FACTOR_WEIGHTS.hr_sync,
    },
    {
      key: "academy_sync",
      label: "Academy Sync Freshness",
      score: scoreAcademySync(signals),
      maxScore: WORKFORCE_READINESS_FACTOR_WEIGHTS.academy_sync,
    },
    {
      key: "competency",
      label: "Competency",
      score: scoreCompetency(signals, competencyItems, competencyReviewDueAt, now),
      maxScore: WORKFORCE_READINESS_FACTOR_WEIGHTS.competency,
    },
  ];

  const rawScore = factors.reduce((sum, f) => sum + f.score, 0);
  const score = clampWorkforceReadinessScore(
    Math.round((rawScore / WORKFORCE_READINESS_RAW_MAX) * 100)
  );
  const bandDetail = resolveWorkforceReadinessBand(score);

  const blocking_issues = collectBlockingIssues({
    is_active: input.is_active,
    hr: input.hr,
    signals,
    compliance: input.compliance,
    trainingItems,
    certificationItems,
    sopItems,
  });

  const warnings = collectWarnings({
    hr: input.hr,
    signals,
    working_hours: input.working_hours,
    sopItems,
    certificationItems,
    competencyItems,
    competencyReviewDueAt,
    now,
  });

  return {
    score,
    band: bandDetail.id,
    bandLabel: bandDetail.label,
    bandDetail,
    factors,
    blocking_issues,
    warnings,
    identitySignals: signals,
  };
}

export const WORKFORCE_READINESS_BLOCKING_LABELS: Record<WorkforceReadinessBlockingIssue, string> = {
  inactive: "Staff profile is inactive",
  no_hr_identity: "No IIOHR HR identity link",
  onboarding_incomplete: "Onboarding incomplete",
  training_incomplete: "Mandatory training incomplete",
  certification_expired: "Certification expired or outstanding",
  mandatory_sop_incomplete: "Mandatory SOP incomplete",
  sync_revoked: "Identity sync revoked",
  critical_compliance_expired: "Critical compliance item expired",
};

export const WORKFORCE_READINESS_WARNING_LABELS: Record<WorkforceReadinessWarning, string> = {
  sop_expiring_soon: "SOP expires within 14 days",
  certification_expiring_soon: "Certification expires within 30 days",
  academy_sync_stale: "Academy identity sync is stale",
  hr_sync_stale: "HR sync is older than 14 days",
  working_hours_incomplete: "Working hours not fully configured",
  competency_review_due_soon: "Competency review due soon",
};
