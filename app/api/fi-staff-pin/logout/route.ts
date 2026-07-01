import { NextResponse } from "next/server";

import {
  endStaffPinClinicSession,
  getStaffPinClinicSessionIfValid,
} from "@/src/lib/staffPin/staffPinSession.server";
import { clockOutFromPinLogout } from "@/src/lib/workforce/staffTimeClock.server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getStaffPinClinicSessionIfValid();
    let clockOut: Awaited<ReturnType<typeof clockOutFromPinLogout>> = null;
    if (session) {
      clockOut = await clockOutFromPinLogout({
        tenantId: session.tenantId,
        fiStaffId: session.staffId,
      });
      await endStaffPinClinicSession(
        session.sessionToken,
        session.tenantId,
        session.staffId
      );
    }
    return NextResponse.json({
      ok: true,
      clockOut: clockOut
        ? {
            workDate: clockOut.punch.workDate,
            clockOutAt: clockOut.punch.clockOutAt,
            minutesWorked: clockOut.punch.minutesWorked,
            timesheetEntryId: clockOut.timesheetEntryId,
            timesheetPendingReason: clockOut.timesheetPendingReason,
          }
        : null,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 }
    );
  }
}
