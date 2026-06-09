import type { ReactNode } from "react";
import { CalendarToastProvider } from "@/components/calendar/CalendarToast";
import { CrmLeadSlideOverProvider } from "@/src/components/fi/crm/LeadSlideOver";
import { getCrmShellPageSession } from "@/src/lib/crm/crmShellAccess";

export const dynamic = "force-dynamic";

type CrmShellLayoutProps = {
  children: ReactNode;
  params: Promise<{ tenantId: string }>;
};

export default async function CrmShellLayout({ children, params }: CrmShellLayoutProps) {
  const { tenantId } = await params;
  const session = await getCrmShellPageSession(tenantId);

  return (
    <CalendarToastProvider>
      <CrmLeadSlideOverProvider
        tenantId={tenantId}
        operatorFiUserId={session.fiUserId}
        userRole={session.role}
        canUseClinicFeatures={session.canUseClinicFeatures}
      >
        {children}
      </CrmLeadSlideOverProvider>
    </CalendarToastProvider>
  );
}
