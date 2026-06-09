import { Suspense } from "react";
import { AppointmentsPage } from "@/src/components/fi/appointments/AppointmentsPage";
import { AppointmentSlideOverProvider } from "@/src/components/fi/appointments/AppointmentSlideOver";
import { loadAppointmentsPageData } from "@/src/lib/bookings/appointmentsPageLoader";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { getClinicFloorPageSession } from "@/src/lib/staffPin/clinicFloorAccess";

export const metadata = {
  title: "Appointments",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function mergeBookingsForAvailability(operatorRows: FiBookingRow[], calendarRows: FiBookingRow[] | null): FiBookingRow[] {
  const byId = new Map<string, FiBookingRow>();
  for (const b of operatorRows) byId.set(b.id, b);
  for (const b of calendarRows ?? []) byId.set(b.id, b);
  return Array.from(byId.values());
}

export default async function AppointmentsOperatorRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId } = await params;
  const session = await getClinicFloorPageSession(tenantId);
  const sp = (await searchParams) ?? {};
  const data = await loadAppointmentsPageData(tenantId, sp);
  const existingBookings = mergeBookingsForAvailability(data.operator.bookings, data.calendar?.bookings ?? null);

  return (
    <AppointmentSlideOverProvider
      tenantId={tenantId}
      operatorFiUserId={session.fiUserId}
      userRole={session.role}
      canUseClinicFeatures={session.canUseClinicFeatures}
      assignees={data.operator.clinicalStaffOptions}
      clinics={data.operator.clinics}
      existingBookings={existingBookings}
      calendarTimezone={data.operator.calendarTimezone}
      services={data.services}
    >
      <Suspense fallback={<div className="mx-auto max-w-7xl animate-pulse space-y-4 py-6" aria-busy="true" />}>
        <AppointmentsPage data={data} />
      </Suspense>
    </AppointmentSlideOverProvider>
  );
}
