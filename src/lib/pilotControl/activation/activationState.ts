/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — activation state transitions (pure).
 */

import {
  HUMAN_ONLY_ACTIVATION_STATES,
  PILOT_ACTIVATION_STATES,
  SOFTWARE_SETTABLE_ACTIVATION_STATES,
  type PilotActivationState,
} from "./activationTypes";

const STATE_SET = new Set<string>(PILOT_ACTIVATION_STATES);
const SOFTWARE_SET = new Set<string>(SOFTWARE_SETTABLE_ACTIVATION_STATES);
const HUMAN_SET = new Set<string>(HUMAN_ONLY_ACTIVATION_STATES);

export function isPilotActivationState(value: unknown): value is PilotActivationState {
  return typeof value === "string" && STATE_SET.has(value);
}

/**
 * Allowed transitions. Human-only targets require humanDecision=true.
 * hold and paused remain distinguishable.
 */
const ALLOWED: Record<PilotActivationState, readonly PilotActivationState[]> = {
  planned: ["technical_validation", "hold", "cancelled"],
  technical_validation: ["governance_review", "hold", "planned", "cancelled"],
  governance_review: [
    "approved_for_initial_invites",
    "hold",
    "technical_validation",
    "cancelled",
  ],
  approved_for_initial_invites: [
    "initial_cohort_active",
    "hold",
    "paused",
    "cancelled",
  ],
  initial_cohort_active: ["paused", "hold", "completed", "cancelled"],
  hold: [
    "planned",
    "technical_validation",
    "governance_review",
    "paused",
    "cancelled",
  ],
  paused: [
    "approved_for_initial_invites",
    "initial_cohort_active",
    "hold",
    "cancelled",
    "completed",
  ],
  completed: [],
  cancelled: [],
};

export type ActivationTransitionIntent = {
  from: PilotActivationState;
  to: PilotActivationState;
  /** Explicit auditable human decision — required for human-only states. */
  humanDecision?: boolean;
  criticalStopCondition?: boolean;
};

export type ActivationTransitionResult =
  | {
      ok: true;
      next: PilotActivationState;
      historyEntry: ActivationHistoryEntry;
    }
  | {
      ok: false;
      reason: string;
    };

export type ActivationHistoryEntry = {
  from: PilotActivationState;
  to: PilotActivationState;
  at: string;
  humanDecision: boolean;
  reason?: string;
};

export function canTransitionActivationState(
  intent: ActivationTransitionIntent
): boolean {
  if (intent.criticalStopCondition) {
    // Critical stop may only move to hold or paused (containment), never forward.
    return intent.to === "hold" || intent.to === "paused";
  }
  if (intent.from === intent.to) return true;
  if (!ALLOWED[intent.from].includes(intent.to)) return false;
  if (HUMAN_SET.has(intent.to) && !intent.humanDecision) return false;
  return true;
}

export function transitionActivationState(
  intent: ActivationTransitionIntent & { at?: string; reason?: string }
): ActivationTransitionResult {
  if (!canTransitionActivationState(intent)) {
    if (intent.criticalStopCondition && intent.to !== "hold" && intent.to !== "paused") {
      return {
        ok: false,
        reason: "critical_stop_blocks_progression",
      };
    }
    if (HUMAN_SET.has(intent.to) && !intent.humanDecision) {
      return {
        ok: false,
        reason: "human_decision_required",
      };
    }
    return { ok: false, reason: "transition_not_allowed" };
  }

  const at = intent.at ?? new Date().toISOString();
  return {
    ok: true,
    next: intent.to,
    historyEntry: {
      from: intent.from,
      to: intent.to,
      at,
      humanDecision: Boolean(intent.humanDecision),
      reason: intent.reason,
    },
  };
}

/** Append-only history — rejected/deferred decisions remain. */
export function appendActivationHistory(
  history: readonly ActivationHistoryEntry[],
  entry: ActivationHistoryEntry
): ActivationHistoryEntry[] {
  return [...history, entry];
}

export function softwareMaySetActivationState(state: PilotActivationState): boolean {
  return SOFTWARE_SET.has(state);
}

export function requiresHumanDecisionForState(state: PilotActivationState): boolean {
  return HUMAN_SET.has(state);
}

/**
 * Invitation enablement — only when activation state is approved_for_initial_invites
 * or initial_cohort_active AND no critical stop AND human decision recorded.
 * Software never flips invites on its own.
 */
export function mayEnableInitialInvites(args: {
  activationState: PilotActivationState;
  humanApprovedForInitialInvites: boolean;
  criticalStopCondition: boolean;
  realPatientInvitesEnabled: boolean;
}): { allowed: boolean; reason: string } {
  if (args.criticalStopCondition) {
    return { allowed: false, reason: "critical_stop_condition" };
  }
  if (
    args.activationState === "planned" ||
    args.activationState === "technical_validation" ||
    args.activationState === "governance_review" ||
    args.activationState === "hold" ||
    args.activationState === "paused" ||
    args.activationState === "cancelled" ||
    args.activationState === "completed"
  ) {
    return { allowed: false, reason: `activation_state:${args.activationState}` };
  }
  if (
    args.activationState !== "approved_for_initial_invites" &&
    args.activationState !== "initial_cohort_active"
  ) {
    return { allowed: false, reason: "activation_state_not_invite_ready" };
  }
  if (!args.humanApprovedForInitialInvites) {
    return { allowed: false, reason: "human_decision_required" };
  }
  // Even when state is approved, invites stay off until an explicit separate enablement
  // flag is set by a human-governed write path (not implemented in 1B read-only).
  if (!args.realPatientInvitesEnabled) {
    return { allowed: false, reason: "invites_remain_disabled_until_explicit_enablement" };
  }
  return { allowed: true, reason: "ok" };
}

export function programmePauseStopsNewInvitations(
  activationState: PilotActivationState
): boolean {
  return (
    activationState === "paused" ||
    activationState === "hold" ||
    activationState === "cancelled"
  );
}
