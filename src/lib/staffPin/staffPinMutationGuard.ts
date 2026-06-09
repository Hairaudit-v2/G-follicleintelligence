import {
  canUseStaffPinClinicSession,
  type StaffPinClinicAction,
  type StaffPinClinicSession,
} from "./staffPinPermissions";

export const STAFF_PIN_RESTRICTED_MUTATION_MESSAGE = "This action requires full admin login.";

export class StaffPinMutationBlockedError extends Error {
  readonly status = 403;

  constructor(message: string = STAFF_PIN_RESTRICTED_MUTATION_MESSAGE) {
    super(message);
    this.name = "StaffPinMutationBlockedError";
  }
}

export type AllowedStaffPinMutationDecision =
  | { allowed: true; via: "no_pin_session" }
  | { allowed: true; via: "staff_pin_floor"; staffId: string };

export type StaffPinMutationDecision = AllowedStaffPinMutationDecision | { blocked: true; message: string };

/**
 * Pure evaluator for PIN session mutation policy (testable without cookies/DB).
 */
export function evaluateStaffPinMutationAccess(
  pinSession: StaffPinClinicSession | null | undefined,
  floorAction?: StaffPinClinicAction
): StaffPinMutationDecision {
  if (!pinSession) {
    return { allowed: true, via: "no_pin_session" };
  }
  if (floorAction && canUseStaffPinClinicSession(pinSession, floorAction)) {
    return { allowed: true, via: "staff_pin_floor", staffId: pinSession.staffId };
  }
  return { blocked: true, message: STAFF_PIN_RESTRICTED_MUTATION_MESSAGE };
}

export function assertStaffPinMutationDecision(
  decision: StaffPinMutationDecision
): asserts decision is AllowedStaffPinMutationDecision {
  if ("blocked" in decision && decision.blocked) {
    throw new StaffPinMutationBlockedError(decision.message);
  }
}
