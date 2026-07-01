import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { StaffTimeClockKioskClient } from "@/src/components/fi/staff/StaffTimeClockKioskClient";
import { getStaffPinClinicSessionIfValid } from "@/src/lib/staffPin/staffPinSession.server";
import { loadStaffPinLoginPage } from "@/src/lib/staffPin/staffPinLoginLoader.server";
import {
  listWorkforceTimePunches,
  loadPinBreakSessionState,
} from "@/src/lib/workforce/staffTimeClock.server";
import { loadWorkforceTimeClockPolicy } from "@/src/lib/workforce/staffTimeClockPolicy.server";

export const metadata = {
  title: "Staff time clock",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffTimeClockPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  const [data, pinSession, policy] = await Promise.all([
    loadStaffPinLoginPage(tid),
    getStaffPinClinicSessionIfValid(tid),
    loadWorkforceTimeClockPolicy(tid),
  ]);
  if (!data) notFound();

  let kioskSession = null;
  if (pinSession) {
    const [breakState, punches] = await Promise.all([
      policy.breaksEnabled
        ? loadPinBreakSessionState(tid, pinSession.staffId)
        : Promise.resolve({ hasOpenPunch: false, onBreak: false, punchId: null }),
      listWorkforceTimePunches(tid, { openOnly: true, limit: 1 }),
    ]);
    const openPunch = punches.find((p) => p.fiStaffId === pinSession.staffId) ?? null;
    kioskSession = {
      staffName: pinSession.staffName,
      hasOpenPunch: breakState.hasOpenPunch,
      onBreak: breakState.onBreak,
      clockInAt: openPunch?.clockInAt ?? null,
    };
  }

  return (
    <StaffTimeClockKioskClient
      data={data}
      session={kioskSession}
      breaksEnabled={policy.breaksEnabled}
    />
  );
}