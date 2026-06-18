/**
 * ReceptionOS Phase 5 — end-of-day closeout permissions (pure).
 */

import type { ReceptionOsViewerRole } from "@/src/lib/receptionOs/receptionOsBoardModel";

export function receptionCloseoutCloseDayAllowed(role: ReceptionOsViewerRole): boolean {
  return role === "admin" || role === "clinic_manager";
}

export function receptionCloseoutViewAllowed(_role: ReceptionOsViewerRole): boolean {
  return true;
}
