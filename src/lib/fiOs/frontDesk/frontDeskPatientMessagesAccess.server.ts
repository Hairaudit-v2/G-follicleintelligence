/**
 * FI-PATIENT-APP-2F.3 — Front Desk patient-message access gate.
 */
import "server-only";

import { staffModuleAccessAllowed } from "@/src/lib/staffAccess/staffAccessGuards.server";

/** Authorised Front Desk / clinical roles via clinic_os or patient_os. */
export async function assertFrontDeskPatientMessagesAccess(
  tenantId: string,
  required: "read" | "edit" = "read"
): Promise<boolean> {
  const tid = tenantId.trim();
  const [clinic, patient] = await Promise.all([
    staffModuleAccessAllowed(tid, "clinic_os", required),
    staffModuleAccessAllowed(tid, "patient_os", required),
  ]);
  return clinic || patient;
}
