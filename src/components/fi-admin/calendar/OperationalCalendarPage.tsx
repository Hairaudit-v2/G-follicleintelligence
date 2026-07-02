"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CalendarToastProvider } from "@/components/calendar/CalendarToast";
import { CalendarPage } from "@/components/calendar/CalendarPage";
import { AppointmentSlideOverProvider } from "@/src/components/fi/appointments/AppointmentSlideOver";
import type {
  OperationalCalendarGridPatch,
  OperationalCalendarPageData,
} from "@/src/lib/calendar/operationalCalendarTypes";
import { mergeOperationalCalendarShellAndGrid } from "@/src/lib/calendar/operationalCalendarMerge";
import type { CrmShellSession } from "@/src/lib/crm/crmShellAccess";
import {
  OperationalCalendarStreamProvider,
  type OperationalCalendarStreamContextValue,
} from "@/src/components/fi-admin/calendar/operationalCalendarStreamContext";
import { StaffUatClarityFeedback } from "@/src/components/fi-admin/staff-uat/StaffUatClarityFeedback";
import { StaffUatScreenGuide } from "@/src/components/fi-admin/staff-uat/StaffUatScreenGuide";

function shellFingerprint(shell: OperationalCalendarPageData): string {
  return [
    shell.tenantId,
    shell.query.view,
    shell.query.dateAnchor,
    shell.rangeStartIso,
    shell.rangeEndIso,
    shell.query.staffId ?? "",
    shell.query.clinicId ?? "",
    shell.query.roomId ?? "",
    shell.query.resourceView ?? "",
    shell.query.search ?? "",
    shell.query.bookingType ?? "",
    shell.query.status ?? "",
  ].join("|");
}

/** FI Admin tenant calendar — toast host, optional appointment slide-over, and shared {@link CalendarPage} shell. */
export function OperationalCalendarPage({
  shell,
  session,
  children,
}: {
  shell: OperationalCalendarPageData;
  session: CrmShellSession | null;
  children: React.ReactNode;
}) {
  const [gridPatch, setGridPatch] = useState<OperationalCalendarGridPatch | null>(null);
  const shellResetKey = shellFingerprint(shell);

  useEffect(() => {
    setGridPatch(null);
  }, [shellResetKey]);

  const mergedData = useMemo(
    () => (gridPatch ? mergeOperationalCalendarShellAndGrid(shell, gridPatch) : shell),
    [gridPatch, shell]
  );

  const applyGridPatch = useCallback((patch: OperationalCalendarGridPatch) => {
    setGridPatch(patch);
  }, []);

  const streamValue = useMemo<OperationalCalendarStreamContextValue>(
    () => ({ applyGridPatch }),
    [applyGridPatch]
  );

  const page = (
    <OperationalCalendarStreamProvider value={streamValue}>
      <CalendarPage
        data={mergedData}
        route="fi-admin"
        crmShellSession={session}
        workspaceVariant="fiOs"
      />
      {children}
    </OperationalCalendarStreamProvider>
  );

  const wrapped = session ? (
    <AppointmentSlideOverProvider
      tenantId={mergedData.tenantId}
      operatorFiUserId={session.fiUserId}
      userRole={session.role}
      canUseClinicFeatures={session.canUseClinicFeatures}
      assignees={mergedData.staffDirectory}
      clinics={mergedData.clinics}
      existingBookings={mergedData.bookings}
      calendarTimezone={mergedData.calendarTimezone}
      services={mergedData.services}
    >
      {page}
    </AppointmentSlideOverProvider>
  ) : (
    page
  );
  return (
    <CalendarToastProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <StaffUatScreenGuide screenKey="calendar" />
        {wrapped}
        <StaffUatClarityFeedback screenKey="calendar" />
      </div>
    </CalendarToastProvider>
  );
}
