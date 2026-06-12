"use client";

import type { ReactNode } from "react";
import { useCrmLeadSlideOverOptional } from "./crmLeadSlideOverContext";

type Props = {
  leadId: string;
  children: ReactNode;
  className?: string;
  /** When true, throws if used outside {@link CrmLeadSlideOverProvider}. Default: false (no-op if no provider). */
  requireProvider?: boolean;
};

/**
 * Button-style trigger that opens the CRM lead slide-over when a provider is mounted.
 * Use inside {@link CrmLeadSlideOverProvider}, or set `requireProvider` to surface a clear error during development.
 */
export function LeadSlideOverTrigger({ leadId, children, className, requireProvider }: Props) {
  const slide = useCrmLeadSlideOverOptional();
  if (!slide) {
    if (requireProvider) {
      throw new Error("LeadSlideOverTrigger requires CrmLeadSlideOverProvider.");
    }
    return <span className={className}>{children}</span>;
  }
  return (
    <button type="button" className={className} onClick={() => slide.openLead(leadId)}>
      {children}
    </button>
  );
}
