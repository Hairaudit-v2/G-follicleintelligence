/**
 * Dev-only console helpers for Clinic guide (guided-assist:*).
 * No-ops in production. Safe for client and server.
 */

const PREFIX = "guided-assist";

export function isGuidedAssistDevLogEnabled(): boolean {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") return false;
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_GUIDED_ASSIST_DEBUG === "0") {
    return false;
  }
  return true;
}

export function guidedAssistDevLog(
  group: string,
  message: string,
  detail?: Record<string, unknown>
): void {
  if (!isGuidedAssistDevLogEnabled()) return;
  const label = `${PREFIX}:${group}`;
  try {
    if (typeof console !== "undefined" && typeof console.groupCollapsed === "function") {
      console.groupCollapsed(`[${label}] ${message}`);
      if (detail && Object.keys(detail).length) console.log(detail);
      console.groupEnd();
    } else if (typeof console !== "undefined") {
      console.log(`[${label}] ${message}`, detail ?? "");
    }
  } catch {
    /* ignore console failures */
  }
}

/** Semantic aliases used in product docs → stored event_kind. */
export const GUIDED_ASSIST_LOG_ALIASES = {
  tip_viewed: "tip_shown",
  tour_step_completed: "tour_step_completed",
  quick_action_clicked: "quick_action_clicked",
  feedback_submitted: "feedback_submitted",
  streak_advanced: "streak_advanced",
} as const;
