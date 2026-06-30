import type {
  HieConsultationChecklistSourceSystem,
  HieConsultationChecklistStatus,
  HieConsultationConsentComplexityLevel,
  HieConsultationPriorityLevel,
  HieConsultationReviewStatus,
} from "./types";
import {
  HIE_CONSULTATION_CHECKLIST_SOURCE_SYSTEMS,
  HIE_CONSULTATION_CHECKLIST_STATUSES,
  HIE_CONSULTATION_CONSENT_COMPLEXITY_LEVELS,
  HIE_CONSULTATION_PRIORITY_LEVELS,
  HIE_CONSULTATION_REVIEW_STATUSES,
} from "./types";

export function normalizeHieConsultationSourceSystem(
  raw: unknown
): HieConsultationChecklistSourceSystem {
  const s = String(raw ?? "").trim();
  return (HIE_CONSULTATION_CHECKLIST_SOURCE_SYSTEMS as readonly string[]).includes(s)
    ? (s as HieConsultationChecklistSourceSystem)
    : "fi_os";
}

export function normalizeHieConsultationChecklistStatus(
  raw: unknown
): HieConsultationChecklistStatus {
  const s = String(raw ?? "").trim();
  return (HIE_CONSULTATION_CHECKLIST_STATUSES as readonly string[]).includes(s)
    ? (s as HieConsultationChecklistStatus)
    : "generated";
}

export function normalizeHieConsultationPriorityLevel(raw: unknown): HieConsultationPriorityLevel {
  const s = String(raw ?? "").trim();
  return (HIE_CONSULTATION_PRIORITY_LEVELS as readonly string[]).includes(s)
    ? (s as HieConsultationPriorityLevel)
    : "low";
}

export function normalizeHieConsultationConsentComplexity(
  raw: unknown
): HieConsultationConsentComplexityLevel | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  return (HIE_CONSULTATION_CONSENT_COMPLEXITY_LEVELS as readonly string[]).includes(s)
    ? (s as HieConsultationConsentComplexityLevel)
    : "unknown";
}

export function normalizeHieConsultationReviewStatus(raw: unknown): HieConsultationReviewStatus {
  const s = String(raw ?? "").trim();
  return (HIE_CONSULTATION_REVIEW_STATUSES as readonly string[]).includes(s)
    ? (s as HieConsultationReviewStatus)
    : "pending";
}

export function clampConsultationChecklistConfidence(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
