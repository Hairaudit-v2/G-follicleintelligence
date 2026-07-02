import "server-only";

import { cache } from "react";

import type { ClinicFloorSession } from "@/src/lib/staffPin/clinicFloorAccess";
import { getClinicFloorSessionIfAllowed } from "@/src/lib/staffPin/clinicFloorAccess";
import { getStaffPinClinicSessionIfValid } from "@/src/lib/staffPin/staffPinSession.server";
import type { CrmShellSession } from "@/src/lib/crm/crmShellAccess";
import {
  getBookingsOperatorSessionIfAllowed,
  getCrmShellSessionIfAllowed,
} from "@/src/lib/crm/crmShellAccess";

function pinToSession(pin: Awaited<ReturnType<typeof getStaffPinClinicSessionIfValid>>): ClinicFloorSession | null {
  if (!pin) return null;
  return {
    authUserId: "",
    fiUserId: pin.staffId,
    role: "staff_pin",
    canUseClinicFeatures: true,
    authMode: "staff_pin",
    operatorStaffId: pin.staffId,
    staffName: pin.staffName,
    staffRole: pin.staffRole,
  };
}

/**
 * Resolve operator context for the D1 workspace shell.
 * Prefer clinic-floor session, then CRM shell, then bookings operator — any
 * session that can load at least one workspace panel bundle.
 */
export const resolveWorkspaceShellOperatorSession = cache(
  async (tenantId: string): Promise<CrmShellSession | ClinicFloorSession | null> => {
    const tid = tenantId.trim();
    if (!tid) return null;

    const pin = await getStaffPinClinicSessionIfValid(tid);
    const pinSession = pinToSession(pin);
    if (pinSession) return pinSession;

    const clinic = await getClinicFloorSessionIfAllowed(tid);
    if (clinic) return clinic;

    const crm = await getCrmShellSessionIfAllowed(tid);
    if (crm) return crm;

    const bookings = await getBookingsOperatorSessionIfAllowed(tid);
    if (bookings) return bookings;

    return null;
  }
);
