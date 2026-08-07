/**
 * Technical generation lifecycle for the shared imaging projection service.
 * Clinical approval and patient sharing are product-owned — never co-located here as “approved”.
 */

export const SHARED_PROJECTION_LIFECYCLE_STATES = [
  "awaiting_plan_approval",
  "awaiting_hairline_approval",
  "ready_to_generate",
  "generation_requested",
  "processing",
  "provider_completed",
  "asset_validating",
  "technical_review_required",
  "clinician_review",
  "technically_rejected",
  "provider_failed",
  "superseded",
] as const;

export type SharedProjectionLifecycleState =
  (typeof SHARED_PROJECTION_LIFECYCLE_STATES)[number];

const ALLOWED: Record<SharedProjectionLifecycleState, SharedProjectionLifecycleState[]> = {
  awaiting_plan_approval: ["awaiting_hairline_approval", "ready_to_generate", "superseded"],
  awaiting_hairline_approval: ["ready_to_generate", "awaiting_plan_approval", "superseded"],
  ready_to_generate: ["generation_requested", "awaiting_plan_approval", "awaiting_hairline_approval", "superseded"],
  generation_requested: ["processing", "provider_failed", "superseded"],
  processing: ["provider_completed", "provider_failed", "superseded"],
  provider_completed: ["asset_validating", "provider_failed", "superseded"],
  asset_validating: [
    "technical_review_required",
    "clinician_review",
    "technically_rejected",
    "provider_failed",
    "superseded",
  ],
  technical_review_required: ["clinician_review", "technically_rejected", "superseded"],
  clinician_review: ["superseded"],
  technically_rejected: ["superseded"],
  provider_failed: ["superseded", "generation_requested"],
  superseded: [],
};

export function isSharedProjectionLifecycleState(
  value: unknown
): value is SharedProjectionLifecycleState {
  return (
    typeof value === "string" &&
    (SHARED_PROJECTION_LIFECYCLE_STATES as readonly string[]).includes(value)
  );
}

export function canTransitionSharedProjectionLifecycle(
  from: SharedProjectionLifecycleState,
  to: SharedProjectionLifecycleState
): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertSharedProjectionLifecycleTransition(
  from: SharedProjectionLifecycleState,
  to: SharedProjectionLifecycleState
): void {
  if (!canTransitionSharedProjectionLifecycle(from, to)) {
    throw new Error(`illegal_shared_projection_lifecycle:${from}->${to}`);
  }
}

/** Terminal technical states (no further provider work). */
export function isTerminalSharedProjectionLifecycle(
  state: SharedProjectionLifecycleState
): boolean {
  return (
    state === "clinician_review" ||
    state === "technically_rejected" ||
    state === "provider_failed" ||
    state === "superseded"
  );
}

/**
 * Prerequisite readiness → technical lifecycle before a generation call.
 * Clinical “approved” for patient sharing is never returned here.
 */
export function lifecycleFromPrerequisites(input: {
  planApproved: boolean;
  hairlineApproved: boolean;
}): Extract<
  SharedProjectionLifecycleState,
  "awaiting_plan_approval" | "awaiting_hairline_approval" | "ready_to_generate"
> {
  if (!input.planApproved) return "awaiting_plan_approval";
  if (!input.hairlineApproved) return "awaiting_hairline_approval";
  return "ready_to_generate";
}
