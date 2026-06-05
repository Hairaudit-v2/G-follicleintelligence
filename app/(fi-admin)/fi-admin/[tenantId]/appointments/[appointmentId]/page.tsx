import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AppointmentDetailPageView } from "@/src/components/fi/appointments/detail/AppointmentDetailPageView";
import { AppointmentSlideOverProvider } from "@/src/components/fi/appointments/AppointmentSlideOver";
import { appointmentTitleFromBooking } from "@/src/lib/bookings/appointmentDisplay";
import { parseAppointmentDetailTab } from "@/src/lib/bookings/appointmentDetailTabs";
import { parseAppointmentPreviewSearchParam } from "@/src/lib/bookings/appointmentPreviewQuery";
import { loadAppointmentShellDetailPagePayload } from "@/src/lib/bookings/appointmentSlideOverLoader";
import { getCrmShellPageSession } from "@/src/lib/crm/crmShellAccess";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; appointmentId: string }>;
}): Promise<Metadata> {
  const { tenantId, appointmentId } = await params;
  const payload = await loadAppointmentShellDetailPagePayload(tenantId, appointmentId);
  const title = payload ? appointmentTitleFromBooking(payload.booking) : "Appointment";
  return {
    title: `${title} · Appointments`,
    robots: { index: false, follow: false },
  };
}

export default async function AppointmentDetailRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string; appointmentId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId, appointmentId } = await params;
  const session = await getCrmShellPageSession(tenantId);
  const sp = (await searchParams) ?? {};
  const previewAppointmentId = parseAppointmentPreviewSearchParam(sp.preview);
  const activeTab = parseAppointmentDetailTab(sp.tab);
  const payload = await loadAppointmentShellDetailPagePayload(tenantId, appointmentId);

  if (!payload) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-6">
        <h1 className="text-lg font-semibold text-gray-900">Appointment not found</h1>
        <p className="text-sm text-gray-600">
          No appointment <code className="font-mono text-xs">{appointmentId}</code> for this tenant.
        </p>
        <Link href={`/fi-admin/${tenantId}/appointments`} className="text-sm text-blue-600 hover:underline">
          ← Appointments
        </Link>
      </div>
    );
  }

  return (
    <AppointmentSlideOverProvider
      tenantId={tenantId}
      operatorFiUserId={session.fiUserId}
      userRole={session.role}
      assignees={payload.assignees}
      clinics={payload.clinics}
      existingBookings={[payload.booking]}
      calendarTimezone={payload.calendarTimezone}
    >
      <Suspense fallback={<div className="mx-auto max-w-6xl animate-pulse space-y-4 py-6" aria-busy="true" aria-hidden />}>
        <AppointmentDetailPageView
          tenantId={tenantId}
          appointmentId={appointmentId}
          initialPayload={payload}
          activeTab={activeTab}
          previewAppointmentId={previewAppointmentId}
        />
      </Suspense>
    </AppointmentSlideOverProvider>
  );
}
