import "server-only";

import { cache } from "react";

import {
  getBookingsOperatorPageSession,
  getBookingsOperatorSessionIfAllowed,
  type CrmShellSession,
} from "@/src/lib/crm/crmShellAccess";

import { getStaffPinClinicSessionIfValid } from "./staffPinSession.server";
import type { StaffPinClinicSession } from "./staffPinPermissions";

export type ClinicFloorSession = CrmShellSession & {
  authMode: "supabase" | "staff_pin";
  operatorStaffId?: string;
  staffName?: string;
  staffRole?: string;
};

function pinToClinicFloorSession(pin: StaffPinClinicSession): ClinicFloorSession {
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

export async function getClinicFloorSessionIfAllowed(
  tenantId: string
): Promise<ClinicFloorSession | null> {
  const pin = await getStaffPinClinicSessionIfValid(tenantId);
  if (pin) return pinToClinicFloorSession(pin);

  const booking = await getBookingsOperatorSessionIfAllowed(tenantId);
  if (!booking) return null;
  return { ...booking, authMode: "supabase" };
}

export const getClinicFloorPageSession = cache(
  async (tenantId: string): Promise<ClinicFloorSession> => {
    const session = await getClinicFloorSessionIfAllowed(tenantId);
    if (session) return session;

    // Fall back to bookings operator flow (redirects when Supabase session exists but unauthorized).
    const booking = await getBookingsOperatorPageSession(tenantId);
    return { ...booking, authMode: "supabase" };
  }
);

export async function assertClinicFloorPageAccess(tenantId: string): Promise<ClinicFloorSession> {
  return getClinicFloorPageSession(tenantId);
}

export function isStaffPinAuthSession(session: ClinicFloorSession): boolean {
  return session.authMode === "staff_pin";
}
