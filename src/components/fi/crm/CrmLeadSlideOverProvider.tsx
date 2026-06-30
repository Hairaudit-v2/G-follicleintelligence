"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { CrmLeadSlideOverContext, type CrmShellOperatorContext } from "./crmLeadSlideOverContext";
import { LeadSlideOverPanel } from "./LeadSlideOverPanel";

export function CrmLeadSlideOverProvider({
  tenantId,
  operatorFiUserId,
  userRole,
  canUseClinicFeatures,
  children,
}: CrmShellOperatorContext & { children: ReactNode }) {
  const [leadId, setLeadId] = useState<string | null>(null);
  const openLead = useCallback((id: string) => setLeadId(id.trim()), []);
  const close = useCallback(() => setLeadId(null), []);

  const value = useMemo(
    () => ({
      tenantId,
      operatorFiUserId,
      userRole,
      canUseClinicFeatures,
      activeLeadId: leadId,
      openLead,
      close,
    }),
    [tenantId, operatorFiUserId, userRole, canUseClinicFeatures, leadId, openLead, close]
  );

  return (
    <CrmLeadSlideOverContext.Provider value={value}>
      {children}
      <LeadSlideOverPanel
        tenantId={tenantId}
        leadId={leadId}
        open={leadId != null}
        onClose={close}
        operatorFiUserId={operatorFiUserId}
        userRole={userRole}
        canUseClinicFeatures={canUseClinicFeatures}
      />
    </CrmLeadSlideOverContext.Provider>
  );
}
