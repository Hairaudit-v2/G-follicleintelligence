import type { ReactNode } from "react";
import { AppointmentSlideOverProvider } from "@/src/components/fi/appointments/AppointmentSlideOver";
import { PatientSlideOverProvider } from "@/src/components/fi/patients/PatientSlideOver";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { loadCrmShellScopePickerOptions } from "@/src/lib/crm/crmShellLoaders";
import { loadClinicalStaffPickerOptions } from "@/src/lib/staff/clinicalStaffPickerLoader.server";
import { getClinicFloorPageSession } from "@/src/lib/staffPin/clinicFloorAccess";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";
import { getPatientImagingCaptureCapability } from "@/src/lib/patientImages/patientImagingCaptureAccess.server";

export const dynamic = "force-dynamic";

type PatientsShellLayoutProps = {
  children: ReactNode;
  params: Promise<{ tenantId: string }>;
};

/** CRM shell session gate + patient + appointment slide-overs for directory and profile routes. */
export default async function PatientsShellLayout({ children, params }: PatientsShellLayoutProps) {
  const { tenantId } = await params;
  const session = await getClinicFloorPageSession(tenantId);
  const [assignees, scope, calendarSettings, services, imagingCaptureCap] = await Promise.all([
    loadClinicalStaffPickerOptions(tenantId),
    loadCrmShellScopePickerOptions(tenantId),
    loadTenantOperationalCalendarSettings(tenantId),
    loadFiServicesForTenant(tenantId),
    getPatientImagingCaptureCapability(tenantId),
  ]);

  return (
    <PatientSlideOverProvider
      tenantId={tenantId}
      operatorFiUserId={session.fiUserId}
      userRole={session.role}
      canUseClinicFeatures={session.canUseClinicFeatures}
      canCapturePatientPhotos={imagingCaptureCap.canCapture}
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
