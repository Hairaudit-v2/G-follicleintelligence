"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Clock,
  DoorOpen,
  Scissors,
  Stethoscope,
  Syringe,
  UserRound,
  Video,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  appointmentStatusBadgeClasses,
  fiProcedureAccentClassNames,
  fiProcedureFamilyLabels,
  resolveProcedureFamily,
  type FiProcedureFamily,
} from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { bookingStatusLabel } from "@/src/lib/bookings/operatorBookingLabels";
import { isBookingCancelled } from "@/src/lib/bookings";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { parseAppointmentInvoicePreview } from "@/src/lib/bookings/appointmentInvoicePreview";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AppointmentCardData = {
  id: string;
  patientName: string;
  procedureType: string;
  procedureLabel?: string;
  startAt: string;
  endAt: string;
  durationMin?: number;
  room?: string | null;
  provider?: string | null;
  price?: string | null;
  currency?: string | null;
  status: string;
  isVirtual?: boolean;
  avatarUrl?: string | null;
};

export type AppointmentCardLayout = {
  topPx: number;
  heightPx: number;
  /** Horizontal placement when appointments overlap (0–100). */
  leftPct?: number;
  widthPct?: number;
  zIndex?: number;
};

export type AppointmentCardProps = {
  appointment: AppointmentCardData;
  /** Absolute positioning for time-grid calendar columns. */
  layout?: AppointmentCardLayout;
  draggable?: boolean;
  onClick?: () => void;
  className?: string;
  /** When true, dims cancelled / completed cards. */
  dimTerminal?: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function patientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function formatTimeRange(startAt: string, endAt: string, timezone?: string | null): string {
  const opts: Intl.DateTimeFormatOptions = { timeStyle: "short", timeZone: timezone?.trim() || "UTC" };
  const start = new Date(startAt).toLocaleTimeString(undefined, opts);
  const end = new Date(endAt).toLocaleTimeString(undefined, opts);
  return `${start} – ${end}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatPrice(price: string | null | undefined, currency: string | null | undefined): string | null {
  if (!price?.trim()) return null;
  const cur = (currency?.trim() || "GBP").toUpperCase();
  const numeric = Number(price.replace(/[^0-9.-]/g, ""));
  if (Number.isFinite(numeric)) {
    try {
      return new Intl.NumberFormat("en-GB", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(
        numeric
      );
    } catch {
      return `${cur} ${price}`;
    }
  }
  return price.trim();
}

const procedureIconMap: Record<FiProcedureFamily, LucideIcon> = {
  pre_surgery_consult: UserRound,
  full_transplant: Scissors,
  prp_session: Syringe,
  follow_up_nurse_prp: Stethoscope,
  virtual_zoom: Video,
};

function procedureIcon(family: FiProcedureFamily): LucideIcon {
  return procedureIconMap[family];
}

function durationFromRange(startAt: string, endAt: string): number {
  const a = Date.parse(startAt);
  const b = Date.parse(endAt);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round((b - a) / 60_000);
}

/** Map a `FiBookingRow` + display bundle into `AppointmentCardData`. */
export function appointmentCardDataFromBooking(
  booking: FiBookingRow,
  display?: {
    anchorLabel?: string;
    durationMin?: number;
    providerName?: string | null;
    roomName?: string | null;
  }
): AppointmentCardData {
  const invoice = parseAppointmentInvoicePreview(booking);
  const meta = booking.metadata ?? {};
  const isVirtual = Boolean(meta.is_virtual ?? meta.virtual ?? meta.zoom);

  return {
    id: booking.id,
    patientName: display?.anchorLabel?.trim() || booking.title?.trim() || "Patient",
    procedureType: booking.booking_type,
    startAt: booking.start_at,
    endAt: booking.end_at,
    durationMin: display?.durationMin ?? durationFromRange(booking.start_at, booking.end_at),
    room: display?.roomName ?? booking.location,
    provider: display?.providerName ?? null,
    price: invoice.totalLabel,
    currency: invoice.currency,
    status: booking.booking_status,
    isVirtual,
    avatarUrl: typeof meta.avatar_url === "string" ? meta.avatar_url : null,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppointmentCard({
  appointment,
  layout,
  draggable = false,
  onClick,
  className,
  dimTerminal = true,
}: AppointmentCardProps) {
  const family = resolveProcedureFamily({
    bookingType: appointment.procedureType,
    isVirtual: appointment.isVirtual,
  });
  const ProcedureIcon = procedureIcon(family);
  const accentClass = fiProcedureAccentClassNames[family];
  const procedureLabel =
    appointment.procedureLabel?.trim() || fiProcedureFamilyLabels[family] || appointment.procedureType;
  const durationMin = appointment.durationMin ?? durationFromRange(appointment.startAt, appointment.endAt);
  const timeLabel = formatTimeRange(appointment.startAt, appointment.endAt);
  const priceLabel = formatPrice(appointment.price, appointment.currency);
  const statusLabel = bookingStatusLabel(appointment.status);
  const statusClasses = appointmentStatusBadgeClasses(appointment.status);

  const isTerminal =
    dimTerminal &&
    (appointment.status === "completed" ||
      appointment.status === "cancelled" ||
      appointment.status === "no_show");

  const isCompact = layout ? layout.heightPx < 72 : false;
  const isMedium = layout ? layout.heightPx >= 72 && layout.heightPx < 110 : false;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appointment.id,
    disabled: !draggable || isTerminal,
    data: { type: "appointment", appointment },
  });

  const hasOverlapLayout = layout?.leftPct != null && layout?.widthPct != null;

  const dragStyle: React.CSSProperties = {
    ...(layout
      ? {
          top: layout.topPx,
          height: layout.heightPx,
          minHeight: 48,
          ...(hasOverlapLayout
            ? {
                left: `calc(${layout.leftPct}% + 2px)`,
                width: `calc(${layout.widthPct}% - 4px)`,
                right: "auto",
              }
            : {}),
          zIndex: isDragging ? 50 : layout.zIndex,
        }
      : undefined),
    ...(transform ? { transform: CSS.Translate.toString(transform), zIndex: isDragging ? 50 : undefined } : undefined),
  };

  const roomProvider = [appointment.room?.trim(), appointment.provider?.trim()].filter(Boolean).join(" · ");

  return (
    <Card
      ref={setNodeRef}
      {...(draggable && !isTerminal ? { ...listeners, ...attributes } : {})}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={dragStyle}
      className={cn(
        "group relative overflow-hidden border-slate-200/90 bg-white/95 text-left shadow-sm backdrop-blur-sm transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 focus-visible:ring-offset-1",
        "dark:border-slate-800 dark:bg-slate-950/95 dark:hover:border-slate-700 dark:hover:shadow-lg dark:hover:shadow-black/20",
        layout && (hasOverlapLayout ? "absolute z-[1]" : "absolute inset-x-1 z-[1]"),
        layout && draggable && !isTerminal && "cursor-grab active:cursor-grabbing",
        isDragging && "scale-[1.02] opacity-90 shadow-lg ring-2 ring-sky-400/30",
        isTerminal && "opacity-60 saturate-[0.85]",
        !layout && "w-full",
        className
      )}
    >
      {/* Procedure accent bar */}
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1 rounded-l-xl", accentClass)}
      />

      <div
        className={cn(
          "flex h-full min-h-0 gap-2 pl-3 pr-2.5",
          layout ? "py-1.5" : "p-3 sm:gap-3 sm:p-3.5",
          isCompact ? "items-center" : "items-start"
        )}
      >
        {/* Avatar */}
        {!isCompact ? (
          <Avatar className={cn("mt-0.5", layout ? "h-7 w-7" : "h-9 w-9 sm:h-10 sm:w-10")}>
            {appointment.avatarUrl ? (
              <AvatarImage src={appointment.avatarUrl} alt={appointment.patientName} />
            ) : null}
            <AvatarFallback className="bg-slate-100 text-[10px] dark:bg-slate-800">
              {patientInitials(appointment.patientName)}
            </AvatarFallback>
          </Avatar>
        ) : null}

        <div className="min-w-0 flex-1">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {isCompact ? (
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                      accentClass,
                      "text-white shadow-sm"
                    )}
                  >
                    <ProcedureIcon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                  </span>
                ) : null}
                <p
                  className={cn(
                    "truncate font-semibold tracking-tight text-slate-900 dark:text-slate-50",
                    layout ? "text-[11px] leading-tight" : "text-sm sm:text-[15px]"
                  )}
                >
                  {appointment.patientName}
                </p>
              </div>

              {!isCompact ? (
                <div className="mt-0.5 flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <ProcedureIcon
                    className={cn("shrink-0", layout || isMedium ? "h-3 w-3" : "h-3.5 w-3.5")}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <p className={cn("truncate font-medium", layout || isMedium ? "text-[10px]" : "text-xs")}>
                    {procedureLabel}
                  </p>
                </div>
              ) : (
                <p className="truncate text-[10px] font-medium text-slate-600 dark:text-slate-400">{procedureLabel}</p>
              )}
            </div>

            {!isCompact && !layout ? (
              <Badge variant="outline" className={cn("shrink-0 border", statusClasses)}>
                {statusLabel}
              </Badge>
            ) : null}
          </div>

          {/* Time + duration */}
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-500 dark:text-slate-400",
              isCompact ? "mt-0" : "mt-1"
            )}
          >
            <span className={cn("inline-flex items-center gap-1 tabular-nums", layout || isMedium ? "text-[10px]" : "text-xs")}>
              <Clock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              {timeLabel}
            </span>
            {durationMin > 0 ? (
              <span className={cn("font-medium", layout || isMedium ? "text-[10px]" : "text-xs")}>
                {formatDuration(durationMin)}
              </span>
            ) : null}
          </div>

          {/* Room / provider — hidden in compact grid */}
          {!isCompact && roomProvider ? (
            <p
              className={cn(
                "mt-1 inline-flex items-center gap-1 truncate text-slate-500 dark:text-slate-400",
                layout || isMedium ? "text-[10px]" : "text-xs"
              )}
            >
              <DoorOpen className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              {roomProvider}
            </p>
          ) : null}

          {/* Footer: price + status (list / tall grid) */}
          {!isCompact && (priceLabel || layout) ? (
            <div className="mt-1.5 flex items-center justify-between gap-2">
              {priceLabel ? (
                <span
                  className={cn(
                    "font-semibold tabular-nums text-slate-800 dark:text-slate-200",
                    layout || isMedium ? "text-[10px]" : "text-xs"
                  )}
                >
                  {priceLabel}
                </span>
              ) : (
                <span />
              )}
              {layout || isMedium ? (
                <Badge variant="outline" className={cn("shrink-0 border px-1.5 py-0 text-[9px]", statusClasses)}>
                  {statusLabel}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/** Convenience wrapper when you already have a `FiBookingRow`. */
export function AppointmentCardFromBooking({
  booking,
  display,
  layout,
  draggable,
  onClick,
  className,
}: {
  booking: FiBookingRow;
  display?: {
    anchorLabel?: string;
    durationMin?: number;
    providerName?: string | null;
    roomName?: string | null;
  };
  layout?: AppointmentCardLayout;
  draggable?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const appointment = appointmentCardDataFromBooking(booking, display);
  const cancelled = isBookingCancelled(booking);
  const dimTerminal = cancelled || booking.booking_status === "completed";

  return (
    <AppointmentCard
      appointment={appointment}
      layout={layout}
      draggable={draggable && !dimTerminal}
      onClick={onClick}
      className={className}
      dimTerminal={dimTerminal}
    />
  );
}
