import type { ReactNode } from "react";
import { AppointmentSlideOverProvider } from "@/src/components/fi/appointments/AppointmentSlideOver";
import { PatientSlideOverProvider } from "@/src/components/fi/patients/PatientSlideOver";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { loadCrmShellScopePickerOptions, loadCrmShellStaffPickerOptions } from "@/src/lib/crm/crmShellLoaders";
import { getClinicFloorPageSession } from "@/src/lib/staffPin/clinicFloorAccess";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";

export const dynamic = "force-dynamic";

type PatientsShellLayoutProps = {
  children: ReactNode;
  params: Promise<{ tenantId: string }>;
};

/** CRM shell session gate + patient + appointment slide-overs for directory and profile routes. */
export default async function PatientsShellLayout({ children, params }: PatientsShellLayoutProps) {
  const { tenantId } = await params;
  const session = await getClinicFloorPageSession(tenantId);
  const [assignees, scope, calendarSettings, services] = await Promise.all([
    loadCrmShellStaffPickerOptions(tenantId),
    loadCrmShellScopePickerOptions(tenantId),
    loadTenantOperationalCalendarSettings(tenantId),
    loadFiServicesForTenant(tenantId),
  ]);

  return (
    <PatientSlideOverProvider
      tenantId={tenantId}
      operatorFiUserId={session.fiUserId}
      userRole={session.role}
      canUseClinicFeatures={session.canUseClinicFeatures}
    >
      <AppointmentSlideOverProvider
        tenantId={tenantId}
        operatorFiUserId={session.fiUserId}
        userRole={session.role}
        canUseClinicFeatures={session.canUseClinicFeatures}
        assignees={assignees}
        clinics={scope.clinics}
        existingBookings={[]}
        calendarTimezone={calendarSettings.calendarTimezone}
        services={services}
      >
        {children}
      </AppointmentSlideOverProvider>
    </PatientSlideOverProvider>
  );
}
