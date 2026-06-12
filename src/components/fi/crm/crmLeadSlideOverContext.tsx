"use client";

import { createContext, useContext } from "react";

export type CrmShellOperatorContext = {
  tenantId: string;
  operatorFiUserId: string;
  userRole: string;
  canUseClinicFeatures?: boolean;
};

/** Context value for CRM lead slide-over (list/kanban + provider). */
export type CrmLeadSlideOverValue = CrmShellOperatorContext & {
  /** Lead id currently shown in the slide-over drawer, if any. */
  activeLeadId: string | null;
  openLead: (leadId: string) => void;
  close: () => void;
};

export const CrmLeadSlideOverContext = createContext<CrmLeadSlideOverValue | null>(null);

export function useCrmLeadSlideOver(): CrmLeadSlideOverValue {
  const v = useContext(CrmLeadSlideOverContext);
  if (!v) throw new Error("useCrmLeadSlideOver must be used within CrmLeadSlideOverProvider");
  return v;
}

/** Safe when no provider: returns `null` (never throws). */
export function useCrmLeadSlideOverOptional(): CrmLeadSlideOverValue | null {
  return useContext(CrmLeadSlideOverContext);
}
