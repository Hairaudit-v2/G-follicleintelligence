import { Scissors, Stethoscope, Syringe, UserRound, Video, type LucideIcon } from "lucide-react";

import {
  appointmentStatusRingClasses,
  fiProcedureAccentClassNames,
  fiProcedureBackgroundTintClassNames,
  fiProcedureBorderClassNames,
  fiProcedureFamilyLabels,
  fiProcedureTextClassNames,
  resolveProcedureFamily,
  type FiProcedureFamily,
} from "@/lib/design-system";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal appointment shape for styling — works with calendar cards and bookings. */
export type AppointmentStyleInput = {
  procedureType: string;
  status: string;
  isVirtual?: boolean;
  procedureLabel?: string;
};

export type AppointmentStyle = {
  procedureFamily: FiProcedureFamily;
  procedureLabel: string;
  /** Tailwind border color classes */
  borderColor: string;
  /** Tailwind background tint classes */
  backgroundTint: string;
  /** Tailwind foreground text classes */
  textColor: string;
  /** Left-edge accent bar */
  accentClass: string;
  /** Status ring overlay (confirmed, arrived, completed, no-show) */
  statusRing: string;
  /** Lucide icon for the procedure family */
  icon: LucideIcon;
  /** Dim cancelled / completed / no-show surfaces */
  isTerminal: boolean;
  /** Pre-composed calendar chip surface classes */
  className: string;
};

// ---------------------------------------------------------------------------
// Procedure icons
// ---------------------------------------------------------------------------

const procedureIconMap: Record<FiProcedureFamily, LucideIcon> = {
  pre_surgery_consult: UserRound,
  full_transplant: Scissors,
  prp_session: Syringe,
  follow_up_nurse_prp: Stethoscope,
  virtual_zoom: Video,
};

// ---------------------------------------------------------------------------
// Status overlays
// ---------------------------------------------------------------------------

const CANCELLED_BORDER = "border-slate-200 dark:border-slate-700";
const CANCELLED_BG = "bg-slate-100/90 dark:bg-slate-900/70";
const CANCELLED_TEXT = "text-slate-600 dark:text-slate-400";

const TERMINAL_STATUSES = new Set(["completed", "cancelled", "no_show"]);

function applyStatusOverlay(
  status: string,
  base: Pick<AppointmentStyle, "borderColor" | "backgroundTint" | "textColor" | "statusRing">
): Pick<
  AppointmentStyle,
  "borderColor" | "backgroundTint" | "textColor" | "statusRing" | "isTerminal"
> {
  const normalized = status.trim();

  if (normalized === "cancelled") {
    return {
      borderColor: CANCELLED_BORDER,
      backgroundTint: CANCELLED_BG,
      textColor: CANCELLED_TEXT,
      statusRing: "",
      isTerminal: true,
    };
  }

  const statusRing = appointmentStatusRingClasses(normalized);

  if (normalized === "no_show") {
    return {
      ...base,
      statusRing,
      isTerminal: true,
    };
  }

  if (normalized === "completed") {
    return {
      ...base,
      statusRing,
      isTerminal: true,
    };
  }

  return {
    ...base,
    statusRing,
    isTerminal: TERMINAL_STATUSES.has(normalized),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve calendar surface styling from procedure type and booking status.
 *
 * Procedure families: Consultation, Transplant, PRP, Follow-up, Virtual.
 * Status influences ring emphasis and terminal muting (cancelled, completed, no-show).
 */
export function getAppointmentStyle(appointment: AppointmentStyleInput): AppointmentStyle {
  const family = resolveProcedureFamily({
    bookingType: appointment.procedureType,
    isVirtual: appointment.isVirtual,
  });

  const procedureLabel =
    appointment.procedureLabel?.trim() ||
    fiProcedureFamilyLabels[family] ||
    appointment.procedureType;

  const base = {
    borderColor: fiProcedureBorderClassNames[family],
    backgroundTint: fiProcedureBackgroundTintClassNames[family],
    textColor: fiProcedureTextClassNames[family],
    statusRing: appointmentStatusRingClasses(appointment.status),
  };

  const withStatus = applyStatusOverlay(appointment.status, base);

  const className = cn(
    withStatus.borderColor,
    withStatus.backgroundTint,
    withStatus.textColor,
    withStatus.statusRing,
    withStatus.isTerminal && "opacity-75 saturate-[0.9]"
  );

  return {
    procedureFamily: family,
    procedureLabel,
    borderColor: withStatus.borderColor,
    backgroundTint: withStatus.backgroundTint,
    textColor: withStatus.textColor,
    accentClass: fiProcedureAccentClassNames[family],
    statusRing: withStatus.statusRing,
    icon: procedureIconMap[family],
    isTerminal: withStatus.isTerminal,
    className,
  };
}
