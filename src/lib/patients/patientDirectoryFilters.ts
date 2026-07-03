/**
 * PatientOS directory legacy filters and saved views (FI-LEGACY-PATIENTOS-FILTER-1).
 */

import {
  legacyDirectoryFiltersAreActive,
  type LegacyPatientDirectoryFilterKey,
  type LegacyPatientDirectoryFilters,
} from "./legacyPatientVisibilityCore";

export type PatientDirectoryLegacyQueryFields = {
  returningFromTimely: boolean | null;
  hasLegacySource: boolean | null;
  historicalIncomplete: boolean | null;
  hasFollowUpEncounter: boolean | null;
  hasPhotosCaptured: boolean | null;
  aiReviewPending: boolean | null;
  clinicianApprovedAi: boolean | null;
  needsMergeReview: boolean | null;
  photosNoAiApproval: boolean | null;
  followUpSince: string | null;
  savedView: PatientOsSavedViewId | null;
};

export type PatientOsSavedViewId =
  | "returning_timely"
  | "legacy_followups_this_week"
  | "imaging_ai_review_pending"
  | "historical_incomplete"
  | "needs_merge_review"
  | "photos_no_ai_approval";

export type PatientOsSavedView = {
  id: PatientOsSavedViewId;
  label: string;
  description: string;
  /** Partial query applied when the saved view is selected. */
  query: Partial<PatientDirectoryLegacyQueryFields>;
};

function startOfUtcWeekIso(now = new Date()): string {
  const d = new Date(now);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export const PATIENT_OS_LEGACY_SAVED_VIEWS: readonly PatientOsSavedView[] = [
  {
    id: "returning_timely",
    label: "Returning Timely patients",
    description: "Patients linked to Timely or marked as returning from Timely.",
    query: { returningFromTimely: true, savedView: "returning_timely" },
  },
  {
    id: "legacy_followups_this_week",
    label: "Legacy follow-ups this week",
    description: "Patients with a follow-up encounter created this week.",
    query: {
      hasFollowUpEncounter: true,
      followUpSince: startOfUtcWeekIso(),
      savedView: "legacy_followups_this_week",
    },
  },
  {
    id: "imaging_ai_review_pending",
    label: "Imaging AI review pending",
    description: "Follow-up imaging awaiting clinician AI review.",
    query: { aiReviewPending: true, savedView: "imaging_ai_review_pending" },
  },
  {
    id: "historical_incomplete",
    label: "Historical record incomplete",
    description: "Returning patients whose Timely history is not fully imported.",
    query: { historicalIncomplete: true, savedView: "historical_incomplete" },
  },
  {
    id: "needs_merge_review",
    label: "Needs merge review",
    description: "Possible duplicate or manual merge review flagged.",
    query: { needsMergeReview: true, savedView: "needs_merge_review" },
  },
  {
    id: "photos_no_ai_approval",
    label: "Photos captured, review not approved",
    description: "Follow-up photos exist without clinician-approved AI review.",
    query: { photosNoAiApproval: true, savedView: "photos_no_ai_approval" },
  },
] as const;

export function resolvePatientOsSavedView(
  id: string | null | undefined
): PatientOsSavedView | null {
  const key = id?.trim();
  if (!key) return null;
  return PATIENT_OS_LEGACY_SAVED_VIEWS.find((v) => v.id === key) ?? null;
}

export function applySavedViewToLegacyQueryFields<T extends PatientDirectoryLegacyQueryFields>(
  query: T,
  savedViewId: string | null | undefined
): T {
  const view = resolvePatientOsSavedView(savedViewId);
  if (!view) return query;
  return { ...query, ...view.query };
}

export const LEGACY_DIRECTORY_FILTER_LABELS: Record<LegacyPatientDirectoryFilterKey, string> = {
  returningFromTimely: "Returning from Timely",
  hasLegacySource: "Has legacy source",
  historicalIncomplete: "Historical record incomplete",
  hasFollowUpEncounter: "Has follow-up encounter",
  hasPhotosCaptured: "Photos captured",
  aiReviewPending: "AI review pending",
  clinicianApprovedAi: "Clinician approved",
  needsMergeReview: "Needs merge review",
  photosNoAiApproval: "Photos without AI approval",
};

export function patientDirectoryLegacyFiltersFromQuery(
  query: PatientDirectoryLegacyQueryFields
): LegacyPatientDirectoryFilters {
  return {
    returningFromTimely: query.returningFromTimely === true ? true : undefined,
    hasLegacySource: query.hasLegacySource === true ? true : undefined,
    historicalIncomplete: query.historicalIncomplete === true ? true : undefined,
    hasFollowUpEncounter: query.hasFollowUpEncounter === true ? true : undefined,
    hasPhotosCaptured: query.hasPhotosCaptured === true ? true : undefined,
    aiReviewPending: query.aiReviewPending === true ? true : undefined,
    clinicianApprovedAi: query.clinicianApprovedAi === true ? true : undefined,
    needsMergeReview: query.needsMergeReview === true ? true : undefined,
    photosNoAiApproval: query.photosNoAiApproval === true ? true : undefined,
    followUpSince: query.followUpSince ?? undefined,
  };
}

export function patientDirectoryHasLegacyFilters(query: PatientDirectoryLegacyQueryFields): boolean {
  return legacyDirectoryFiltersAreActive(patientDirectoryLegacyFiltersFromQuery(query));
}