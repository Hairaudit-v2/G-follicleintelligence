"use client";

import { CalendarToastProvider } from "@/components/calendar/CalendarToast";
import { CalendarPage } from "@/components/calendar/CalendarPage";
import { AppointmentSlideOverProvider } from "@/src/components/fi/appointments/AppointmentSlideOver";
import type { OperationalCalendarPageData } from "@/src/lib/calendar/operationalCalendarTypes";
import type { CrmShellSession } from "@/src/lib/crm/crmShellAccess";

/** FI Admin tenant calendar — toast host, optional appointment slide-over, and shared {@link CalendarPage} shell. */
export function OperationalCalendarPage({
  data,
  session,
}: {
  data: OperationalCalendarPageData;
  session: CrmShellSession | null;
}) {
  const page = <CalendarPage data={data} route="fi-admin" crmShellSession={session} />;
  const wrapped = session ? (
    <AppointmentSlideOverProvider
      tenantId={data.tenantId}
      operatorFiUserId={session.fiUserId}
      userRole={session.role}
      assignees={data.staffDirectory}
      clinics={data.clinics}
      existingBookings={data.bookings}
      calendarTimezone={data.calendarTimezone}
    >
      {page}
    </AppointmentSlideOverProvider>
  ) : (
    page
  );
  return <CalendarToastProvider>{wrapped}</CalendarToastProvider>;
}
