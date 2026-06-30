import { INTELLIGENCE_EVENT_NAMES } from "@follicle/intelligence-core";

const CORE_NAMES = new Set<string>(INTELLIGENCE_EVENT_NAMES as readonly string[]);

/**
 * Example governed names from product brief; only names that exist in intelligence-core are enforced.
 * (e.g. `hli.treatment.recommendation.generated` is omitted until added to {@link INTELLIGENCE_EVENT_NAMES}.)
 */
const ENQUEUE_SHADOW_CANDIDATE_NAMES = [
  "hairaudit.audit.completed",
  "hli.treatment.recommendation.generated",
  "hli.progression.review.completed",
] as const;

/** Strict allow-list for `enqueue_shadow` governed replay (subset of intelligence-core names). */
export const GOVERNED_ENQUEUE_SHADOW_EVENT_ALLOWLIST: readonly string[] =
  ENQUEUE_SHADOW_CANDIDATE_NAMES.filter((n) => CORE_NAMES.has(n));

/** Reserved for Stage 16+ real dispatch — intentionally empty in Stage 15. */
export const GOVERNED_DISPATCH_FUTURE_ALLOWLIST: readonly string[] = [];

const ENQUEUE_SET = new Set(GOVERNED_ENQUEUE_SHADOW_EVENT_ALLOWLIST);

export function isEnqueueShadowEventNameAllowlisted(eventName: string | null | undefined): boolean {
  if (!eventName || !eventName.trim()) return false;
  return ENQUEUE_SET.has(eventName.trim());
}

/** Blocks high-sensitivity clinical tier for shadow enqueue paths. */
export function isGovernedPrivacyFilterSafeForShadowEnqueue(
  privacyLevel: string | null | undefined
): boolean {
  if (!privacyLevel || !privacyLevel.trim()) return true;
  return privacyLevel.trim() !== "operational_clinical";
}
