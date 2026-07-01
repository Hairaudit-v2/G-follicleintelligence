/**
 * WorkforceOS Phase 2 Sprint 1 — recruitment pipeline (pure types + validation).
 */

export const RECRUITMENT_PIPELINE_STAGES = [
  "applied",
  "screening",
  "interview",
  "clinical_assessment",
  "reference_check",
  "offer",
  "hired",
  "withdrawn",
] as const;

export type RecruitmentPipelineStage = (typeof RECRUITMENT_PIPELINE_STAGES)[number];

export const RECRUITMENT_OFFER_STATUSES = [
  "none",
  "draft",
  "extended",
  "accepted",
  "declined",
  "expired",
] as const;

export type RecruitmentOfferStatus = (typeof RECRUITMENT_OFFER_STATUSES)[number];

export const RECRUITMENT_CANDIDATE_SOURCES = [
  "direct",
  "referral",
  "agency",
  "linkedin",
  "internal",
  "other",
] as const;

export type RecruitmentCandidateSource = (typeof RECRUITMENT_CANDIDATE_SOURCES)[number];

export const RECRUITMENT_PIPELINE_STAGE_LABELS: Record<RecruitmentPipelineStage, string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  clinical_assessment: "Clinical assessment",
  reference_check: "Reference check",
  offer: "Offer",
  hired: "Hired",
  withdrawn: "Withdrawn",
};

export const RECRUITMENT_OFFER_STATUS_LABELS: Record<RecruitmentOfferStatus, string> = {
  none: "No offer",
  draft: "Draft offer",
  extended: "Offer extended",
  accepted: "Offer accepted",
  declined: "Offer declined",
  expired: "Offer expired",
};

export const TERMINAL_RECRUITMENT_STAGES = new Set<RecruitmentPipelineStage>(["hired", "withdrawn"]);

export type WorkforceRoleRequirement = {
  id: string;
  tenantId: string;
  roleCode: string;
  displayName: string;
  description: string | null;
  requirementsJson: Record<string, unknown>;
  onboardingTemplateCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecruitmentCandidate = {
  id: string;
  tenantId: string;
  roleRequirementId: string | null;
  roleCode: string | null;
  roleDisplayName: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  source: RecruitmentCandidateSource;
  pipelineStage: RecruitmentPipelineStage;
  offerStatus: RecruitmentOfferStatus;
  onboardingTemplateCode: string | null;
  notes: string | null;
  assignedToUserId: string | null;
  hiredStaffMemberId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecruitmentStageEvent = {
  id: string;
  tenantId: string;
  candidateId: string;
  fromStage: RecruitmentPipelineStage | null;
  toStage: RecruitmentPipelineStage;
  offerStatus: RecruitmentOfferStatus | null;
  notes: string | null;
  recordedByUserId: string | null;
  recordedAt: string;
};

export type OnboardingTemplateOption = {
  code: string;
  displayName: string;
  description: string | null;
};

export function isRecruitmentPipelineStage(value: string): value is RecruitmentPipelineStage {
  return (RECRUITMENT_PIPELINE_STAGES as readonly string[]).includes(value);
}

export function isRecruitmentOfferStatus(value: string): value is RecruitmentOfferStatus {
  return (RECRUITMENT_OFFER_STATUSES as readonly string[]).includes(value);
}

export function isRecruitmentCandidateSource(value: string): value is RecruitmentCandidateSource {
  return (RECRUITMENT_CANDIDATE_SOURCES as readonly string[]).includes(value);
}

export function normalizeRecruitmentPipelineStage(
  raw: string | null | undefined,
  fallback: RecruitmentPipelineStage = "applied"
): RecruitmentPipelineStage {
  const s = raw?.trim().toLowerCase() ?? "";
  return isRecruitmentPipelineStage(s) ? s : fallback;
}

export function normalizeRecruitmentOfferStatus(
  raw: string | null | undefined,
  fallback: RecruitmentOfferStatus = "none"
): RecruitmentOfferStatus {
  const s = raw?.trim().toLowerCase() ?? "";
  return isRecruitmentOfferStatus(s) ? s : fallback;
}

/** Default offer status when entering the offer stage. */
export function defaultOfferStatusForStage(
  stage: RecruitmentPipelineStage,
  current: RecruitmentOfferStatus
): RecruitmentOfferStatus {
  if (stage === "offer" && current === "none") return "draft";
  if (stage === "hired" && (current === "extended" || current === "draft")) return "accepted";
  if (stage === "withdrawn" && current === "extended") return "declined";
  return current;
}

export function assertRecruitmentStageTransition(
  from: RecruitmentPipelineStage,
  to: RecruitmentPipelineStage
): void {
  if (from === to) return;
  if (TERMINAL_RECRUITMENT_STAGES.has(from)) {
    throw new Error(`Cannot move candidate from terminal stage "${from}".`);
  }
  if (to === "hired" && from !== "offer" && from !== "reference_check") {
    throw new Error("Candidates can only be marked hired from offer or reference check.");
  }
}

export function countCandidatesByStage(
  candidates: Pick<RecruitmentCandidate, "pipelineStage" | "archivedAt">[]
): Record<RecruitmentPipelineStage, number> {
  const out = Object.fromEntries(
    RECRUITMENT_PIPELINE_STAGES.map((s) => [s, 0])
  ) as Record<RecruitmentPipelineStage, number>;
  for (const c of candidates) {
    if (c.archivedAt) continue;
    out[c.pipelineStage] += 1;
  }
  return out;
}

export function resolveCandidateOnboardingTemplate(input: {
  candidateTemplateCode: string | null;
  roleTemplateCode: string | null;
}): string | null {
  const c = input.candidateTemplateCode?.trim();
  if (c) return c;
  const r = input.roleTemplateCode?.trim();
  return r || null;
}

/** Stages a candidate may move to from `from` (excludes no-op same stage). */
export function allowedRecruitmentStageTargets(
  from: RecruitmentPipelineStage
): RecruitmentPipelineStage[] {
  if (TERMINAL_RECRUITMENT_STAGES.has(from)) return [];
  return RECRUITMENT_PIPELINE_STAGES.filter((to) => {
    if (to === from) return false;
    try {
      assertRecruitmentStageTransition(from, to);
      return true;
    } catch {
      return false;
    }
  });
}