import "server-only";

import type { StaffPinClinicAction } from "./staffPinPermissions";
import { getStaffPinClinicSessionIfValid } from "./staffPinSession.server";
import {
  assertStaffPinMutationDecision,
  evaluateStaffPinMutationAccess,
  StaffPinMutationBlockedError,
  STAFF_PIN_RESTRICTED_MUTATION_MESSAGE,
} from "./staffPinMutationGuard";

export {
  StaffPinMutationBlockedError,
  STAFF_PIN_RESTRICTED_MUTATION_MESSAGE,
  evaluateStaffPinMutationAccess,
};

/**
 * Block restricted mutations while a clinic-floor PIN session is active.
 */
export async function rejectStaffPinSessionForRestrictedMutation(tenantId: string): Promise<void> {
  const pin = await getStaffPinClinicSessionIfValid(tenantId.trim());
  assertStaffPinMutationDecision(evaluateStaffPinMutationAccess(pin));
}

/** Block platform-level mutations while any clinic-floor PIN session cookie is active. */
export async function rejectAnyActiveStaffPinSession(): Promise<void> {
  const pin = await getStaffPinClinicSessionIfValid();
  assertStaffPinMutationDecision(evaluateStaffPinMutationAccess(pin));
}

/**
 * Returns `pin_floor` when an active PIN session may perform the floor action;
 * `none` when no PIN session (caller should apply full admin/operator auth);
 * throws when PIN session is active but the action is not allowed.
 */
export async function resolveStaffPinFloorMutation(
  tenantId: string,
  floorAction?: StaffPinClinicAction
): Promise<"none" | "pin_floor"> {
  const pin = await getStaffPinClinicSessionIfValid(tenantId.trim());
  const decision = evaluateStaffPinMutationAccess(pin, floorAction);
  assertStaffPinMutationDecision(decision);
  if (decision.via === "staff_pin_floor") {
    return "pin_floor";
  }
  return "none";
}
