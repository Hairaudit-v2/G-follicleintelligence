/**
 * Compose dimension state from signals (pure). Optional never forces blocked.
 */

import { signalIsBlocking } from "./signalHelpers";
import type {
  PilotBlocker,
  PilotReadinessWarning,
  ReadinessDimension,
  ReadinessDimensionResult,
  ReadinessDimensionState,
  ReadinessProvenance,
  ReadinessSignalResult,
} from "./readinessTypes";

export function composeDimensionState(args: {
  dimension: ReadinessDimension;
  signals: ReadinessSignalResult[];
  blockers: PilotBlocker[];
  warnings: PilotReadinessWarning[];
  evaluatedAt: string;
  /** When identity integrity fails, force blocked. */
  forceBlocked?: boolean;
}): ReadinessDimensionResult {
  const mandatorySignals = args.signals.filter((s) => s.requirement === "mandatory");
  const optionalSignals = args.signals.filter((s) => s.requirement !== "mandatory");

  let state: ReadinessDimensionState = "not_started";

  if (args.forceBlocked) {
    state = "blocked";
  } else {
    const applicable = args.signals.filter((s) => s.requirement !== "not_applicable");
    if (applicable.length === 0) {
      state = "not_applicable";
    } else if (
      args.signals.every(
        (s) => s.requirement === "not_applicable" || s.status === "not_applicable"
      )
    ) {
      state = "not_applicable";
    } else if (args.signals.some((s) => signalIsBlocking(s))) {
      state = "blocked";
    } else if (args.signals.some((s) => s.status === "review_required" && s.blocking)) {
      state = "awaiting_review";
    } else if (
      args.warnings.some((w) => w.severity === "attention" || w.severity === "high") ||
      args.signals.some(
        (s) => s.severity === "attention" && s.status !== "satisfied" && s.requirement !== "optional"
          ? false
          : s.severity === "attention" &&
            s.status !== "satisfied" &&
            s.requirement === "optional"
      )
    ) {
      // Optional attention (e.g. inactivity, failed push) → attention_required
      const hasOptionalAttention = args.signals.some(
        (s) =>
          s.requirement === "optional" &&
          s.severity === "attention" &&
          s.status !== "satisfied"
      );
      const hasWarningAttention = args.warnings.some(
        (w) => w.severity === "attention" || w.severity === "high"
      );
      if (hasOptionalAttention || hasWarningAttention) {
        state = "attention_required";
      } else {
        state = "in_progress";
      }
    } else {
      const mandatoryOk = mandatorySignals.every(
        (s) => s.status === "satisfied" || s.status === "not_applicable"
      );
      const blockingConditionalOk = args.signals
        .filter((s) => s.requirement === "conditional" && s.blocking)
        .every((s) => s.status === "satisfied" || s.status === "not_applicable");
      // Non-blocking conditional/optional incompleteness must not prevent ready.
      if (mandatoryOk && blockingConditionalOk) {
        const hasPendingWork = args.signals.some(
          (s) =>
            (s.requirement === "mandatory" || s.blocking) &&
            (s.status === "pending" || s.status === "missing" || s.status === "review_required")
        );
        state = hasPendingWork ? "in_progress" : "ready";
      } else if (
        applicable.some(
          (s) =>
            s.status === "pending" ||
            s.status === "missing" ||
            s.status === "review_required" ||
            s.status === "satisfied"
        )
      ) {
        state = "in_progress";
      }
    }
  }

  const provenance: ReadinessProvenance[] = args.signals.flatMap((s) => s.provenance);

  return {
    dimension: args.dimension,
    state,
    mandatorySignals,
    optionalSignals,
    blockers: args.blockers,
    warnings: args.warnings,
    provenance,
    evaluatedAt: args.evaluatedAt,
  };
}
