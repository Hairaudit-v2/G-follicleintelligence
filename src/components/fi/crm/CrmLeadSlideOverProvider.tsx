"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useWorkspaceShellOptional } from "@/src/components/fi-os/workspace/WorkspaceShellContext";
import { CrmLeadSlideOverContext, type CrmShellOperatorContext } from "./crmLeadSlideOverContext";
import { LeadSlideOverPanel } from "./LeadSlideOverPanel";

export function CrmLeadSlideOverProvider({
  tenantId,
  operatorFiUserId,
  userRole,
  canUseClinicFeatures,
  children,
}: CrmShellOperatorContext & { children: ReactNode }) {
  const workspaceShell = useWorkspaceShellOptional();
  const [leadId, setLeadId] = useState<string | null>(null);
  const openLead = useCallback((id: string) => setLeadId(id.trim()), []);
  const close = useCallback(() => setLeadId(null), []);

  const bridgedOpenLead = useCallback(
    (id: string) => {
      if (workspaceShell) {
        workspaceShell.openWorkspace({ kind: "lead", id: id.trim() });
        return;
      }
      openLead(id);
    },
    [workspaceShell, openLead]
  );

  const bridgedClose = useCallback(() => {
    if (workspaceShell) {
      workspaceShell.closeAll();
      return;
    }
    close();
  }, [workspaceShell, close]);

  const activeLeadId = workspaceShell
    ? (workspaceShell.activeOfKind("lead")?.id ?? null)
    : leadId;

  const value = useMemo(
    () => ({
      tenantId,
      operatorFiUserId,
      userRole,
      canUseClinicFeatures,
      activeLeadId,
      openLead: bridgedOpenLead,
      close: bridgedClose,
    }),
    [tenantId, operatorFiUserId, userRole, canUseClinicFeatures, activeLeadId, bridgedOpenLead, bridgedClose]
  );

  if (workspaceShell) {
    return (
      <CrmLeadSlideOverContext.Provider value={value}>{children}</CrmLeadSlideOverContext.Provider>
    );
  }

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
