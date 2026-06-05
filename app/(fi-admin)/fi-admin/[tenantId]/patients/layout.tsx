import type { ReactNode } from "react";
import { AppointmentSlideOverProvider } from "@/src/components/fi/appointments/AppointmentSlideOver";
import { PatientSlideOverProvider } from "@/src/components/fi/patients/PatientSlideOver";
import { loadCrmShellScopePickerOptions, loadCrmShellUserPickerOptions } from "@/src/lib/crm/crmShellLoaders";
import { getCrmShellPageSession } from "@/src/lib/crm/crmShellAccess";

export const dynamic = "force-dynamic";

type PatientsShellLayoutProps = {
  children: ReactNode;
  params: Promise<{ tenantId: string }>;
};

/** CRM shell session gate + patient + appointment slide-overs for directory and profile routes. */
export default async function PatientsShellLayout({ children, params }: PatientsShellLayoutProps) {
  const { tenantId } = await params;
  const session = await getCrmShellPageSession(tenantId);
  const [assignees, scope] = await Promise.all([
    loadCrmShellUserPickerOptions(tenantId),
    loadCrmShellScopePickerOptions(tenantId),
  ]);

  return (
    <PatientSlideOverProvider
      tenantId={tenantId}
      operatorFiUserId={session.fiUserId}
      userRole={session.role}
    >
      <AppointmentSlideOverProvider
        tenantId={tenantId}
        operatorFiUserId={session.fiUserId}
        userRole={session.role}
        assignees={assignees}
        clinics={scope.clinics}
        existingBookings={[]}
      >
        {children}
      </AppointmentSlideOverProvider>
    </PatientSlideOverProvider>
  );
}
