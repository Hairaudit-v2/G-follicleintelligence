"use client";

import type { ReactNode } from "react";
import { usePatientSlideOverOptional } from "./PatientSlideOver";

type Props = {
  patientId: string;
  children: ReactNode;
  className?: string;
  /** When true, throws if used outside {@link PatientSlideOverProvider}. Default: false (no-op if no provider). */
  requireProvider?: boolean;
};

/**
 * Button-style trigger that opens the patient slide-over when a provider is mounted.
 * Use inside {@link PatientSlideOverProvider}, or set `requireProvider` to surface a clear error during development.
 */
export function PatientSlideOverTrigger({ patientId, children, className, requireProvider }: Props) {
  const slide = usePatientSlideOverOptional();
  if (!slide) {
    if (requireProvider) {
      throw new Error("PatientSlideOverTrigger requires PatientSlideOverProvider.");
    }
    return <span className={className}>{children}</span>;
  }
  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) {
          window.open(`/fi-admin/${slide.tenantId}/patients/${patientId}`, "_blank", "noopener,noreferrer");
          return;
        }
        slide.openPatient(patientId);
      }}
    >
      {children}
    </button>
  );
}
