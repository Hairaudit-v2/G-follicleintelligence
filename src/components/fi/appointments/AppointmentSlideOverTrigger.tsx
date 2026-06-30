"use client";

import type { ReactNode } from "react";
import { useAppointmentSlideOverOptional } from "./AppointmentSlideOver";

type Props = {
  appointmentId: string;
  children: ReactNode;
  className?: string;
  /** When true, throws if used outside {@link AppointmentSlideOverProvider}. Default: false (no-op if no provider). */
  requireProvider?: boolean;
};

/**
 * Button-style trigger that opens the appointment slide-over when a provider is mounted.
 * Use inside {@link AppointmentSlideOverProvider}, or set `requireProvider` to surface a clear error during development.
 */
export function AppointmentSlideOverTrigger({
  appointmentId,
  children,
  className,
  requireProvider,
}: Props) {
  const slide = useAppointmentSlideOverOptional();
  if (!slide) {
    if (requireProvider) {
      throw new Error("AppointmentSlideOverTrigger requires AppointmentSlideOverProvider.");
    }
    return <span className={className}>{children}</span>;
  }
  return (
    <button
      type="button"
      className={className}
      onClick={() => slide.openAppointment(appointmentId)}
    >
      {children}
    </button>
  );
}
