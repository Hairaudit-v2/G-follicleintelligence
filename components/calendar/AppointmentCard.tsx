"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { Clock, DoorOpen, GripVertical, Loader2, UserRound } from "lucide-react";
import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { calendarPxPerMinute } from "@/components/calendar/ProviderColumn";
import {
  appointmentStatusBadgeClasses,
  crmDarkProcedureClasses,
  type FiProcedureFamily,
} from "@/lib/design-system";
import {
  durationMinutesFromPx,
  pxFromDurationMinutes,
} from "@/lib/calendar/dndMath";
import { getAppointmentStyle } from "@/lib/calendar/getAppointmentStyle";
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
  /** Enable bottom-edge resize (grid columns only). */
  resizable?: boolean;
  onResizeEnd?: (endIso: string) => void;
  onClick?: () => void;
  className?: string;
  /** When true, dims cancelled / completed cards. */
  dimTerminal?: boolean;
  /** Drag overlay ghost — no grid positioning. */
  isDragPreview?: boolean;
  /** Larger drag/resize handles for touch screens. */
  touchFriendly?: boolean;
  /** Subtle mount animation for grid cards. */
  animateEntry?: boolean;
  /** Saving server state after optimistic move — dims card and blocks drag. */
  isPendingSave?: boolean;
};

const MotionCard = motion.create(Card);

/** Procedure-colored hover glow for dark CRM calendar chips. */
const PROCEDURE_HOVER_GLOW: Record<FiProcedureFamily, string> = {
  pre_surgery_consult:
    "hover:shadow-indigo-500/25 hover:ring-indigo-400/30 dark:hover:shadow-indigo-500/30 dark:hover:ring-indigo-400/35",
  full_transplant:
    "hover:shadow-rose-500/25 hover:ring-rose-400/30 dark:hover:shadow-rose-500/30 dark:hover:ring-rose-400/35",
  prp_session:
    "hover:shadow-emerald-500/25 hover:ring-emerald-400/30 dark:hover:shadow-emerald-500/30 dark:hover:ring-emerald-400/35",
  follow_up_nurse_prp:
    "hover:shadow-sky-500/25 hover:ring-sky-400/30 dark:hover:shadow-sky-500/30 dark:hover:ring-sky-400/35",
  virtual_zoom:
    "hover:shadow-amber-500/25 hover:ring-amber-400/30 dark:hover:shadow-amber-500/30 dark:hover:ring-amber-400/35",
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
// Resize handle
// ---------------------------------------------------------------------------

function ResizeHandle({
  onResizeEnd,
  onLiveHeightChange,
  startAt,
  baseHeightPx,
  isResizing,
  touchFriendly,
}: {
  onResizeEnd: (endIso: string) => void;
  onLiveHeightChange: (heightPx: number | null) => void;
  startAt: string;
  baseHeightPx: number;
  isResizing: boolean;
  touchFriendly?: boolean;
}) {
  const ppm = calendarPxPerMinute();
  const minHeightPx = pxFromDurationMinutes(15);

  const finishResize = React.useCallback(
    (heightPx: number) => {
      const durationMin = durationMinutesFromPx(heightPx);
      const startMs = Date.parse(startAt);
      if (!Number.isFinite(startMs)) return;
      onResizeEnd(new Date(startMs + durationMin * 60_000).toISOString());
      onLiveHeightChange(null);
    },
    [onLiveHeightChange, onResizeEnd, startAt]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const startY = e.clientY;
    const originHeight = baseHeightPx;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startY;
      const raw = Math.max(minHeightPx, originHeight + dy);
      onLiveHeightChange(pxFromDurationMinutes(raw / ppm));
    };

    const onUp = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      const dy = ev.clientY - startY;
      const raw = Math.max(minHeightPx, originHeight + dy);
      finishResize(pxFromDurationMinutes(raw / ppm));
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  };

  return (
    <button
      type="button"
      aria-label="Resize appointment"
      onPointerDown={onPointerDown}
      className={cn(
        "absolute inset-x-1 bottom-0 z-20 flex cursor-ns-resize touch-none items-center justify-center rounded-b-xl",
        touchFriendly ? "h-6 opacity-100" : "h-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
        isResizing && "opacity-100"
      )}
    >
      <span
        className={cn(
          "rounded-full bg-slate-400/80 shadow-sm ring-1 ring-white/80 dark:bg-slate-500 dark:ring-slate-700",
          touchFriendly ? "h-1.5 w-12" : "h-1 w-8"
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PriceBadge({ label, compact }: { label: string; compact?: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 border-slate-600/50 bg-slate-800/90 font-semibold tabular-nums text-slate-100 shadow-sm",
        "ring-1 ring-inset ring-white/[0.06] dark:border-slate-600/50 dark:bg-slate-800/90 dark:text-slate-100",
        compact ? "px-1.5 py-0 text-[9px]" : "px-2 py-0.5 text-[10px]"
      )}
    >
      {label}
    </Badge>
  );
}

function StatusBadge({ status, compact }: { status: string; compact?: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 border font-medium",
        appointmentStatusBadgeClasses(status),
        compact ? "px-1.5 py-0 text-[9px]" : "px-2 py-0.5 text-[10px]"
      )}
    >
      {bookingStatusLabel(status)}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function AppointmentCardInner({
  appointment,
  layout,
  draggable = false,
  resizable = false,
  onResizeEnd,
  onClick,
  className,
  dimTerminal = true,
  isDragPreview = false,
  touchFriendly = false,
  animateEntry = false,
  isPendingSave = false,
}: AppointmentCardProps) {
  const style = getAppointmentStyle(appointment);
  const darkProcedure = crmDarkProcedureClasses(style.procedureFamily);
  const ProcedureIcon = style.icon;
  const procedureLabel = style.procedureLabel;
  const durationMin = appointment.durationMin ?? durationFromRange(appointment.startAt, appointment.endAt);
  const timeLabel = formatTimeRange(appointment.startAt, appointment.endAt);
  const priceLabel = formatPrice(appointment.price, appointment.currency);

  const isTerminal = dimTerminal && style.isTerminal;

  const canDrag = draggable && !isTerminal && !isDragPreview && !isPendingSave;
  const canResize = resizable && !isTerminal && layout != null && Boolean(onResizeEnd) && !isDragPreview && !isPendingSave;
  const [resizeHeightPx, setResizeHeightPx] = React.useState<number | null>(null);
  const displayHeightPx = resizeHeightPx ?? layout?.heightPx;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appointment.id,
    disabled: !canDrag,
    data: { type: "appointment", appointment },
  });

  const isCompact = layout ? layout.heightPx < 72 : false;
  const isMedium = layout ? layout.heightPx >= 72 && layout.heightPx < 110 : false;
  const showMeta = !isCompact;
  const showFooter = showMeta && (Boolean(priceLabel) || Boolean(layout));

  const hasOverlapLayout = layout?.leftPct != null && layout?.widthPct != null;

  const dragStyle: React.CSSProperties = {
    ...(layout && !isDragPreview
      ? {
          top: layout.topPx,
          height: displayHeightPx,
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

  const room = appointment.room?.trim();
  const provider = appointment.provider?.trim();
  const useMotion = animateEntry && layout != null && !isDragPreview;
  const Shell = useMotion ? MotionCard : Card;

  const textSize = layout || isMedium ? "text-[10px]" : "text-xs";
  const nameSize = layout ? "text-[11px] leading-tight" : "text-sm sm:text-[15px]";

  return (
    <Shell
      ref={setNodeRef}
      initial={useMotion ? { opacity: 0, scale: 0.98, y: 2 } : false}
      animate={useMotion ? { opacity: 1, scale: 1, y: 0 } : undefined}
      transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
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
        "group relative overflow-hidden rounded-xl text-left ring-1 ring-inset ring-white/[0.04]",
        "border border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-sm",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-px hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0f172a]",
        "dark:border-[#1e2937] dark:bg-[#0f172a]/95 dark:shadow-black/30",
        "dark:hover:shadow-lg",
        PROCEDURE_HOVER_GLOW[style.procedureFamily],
        layout && cn(style.borderColor, style.backgroundTint, style.textColor, style.statusRing),
        layout && !isDragPreview && (hasOverlapLayout ? "absolute z-[1]" : "absolute inset-x-1 z-[1]"),
        isDragging && "scale-[1.02] opacity-90 shadow-xl ring-2 ring-sky-400/35",
        isDragPreview && "w-full rotate-[0.5deg] shadow-2xl ring-2 ring-sky-400/30 dark:shadow-black/50",
        isTerminal && "opacity-55 saturate-[0.8]",
        isPendingSave && "opacity-80 ring-2 ring-amber-400/35",
        !layout && "w-full",
        className
      )}
    >
      {/* Procedure accent bar */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1.5 rounded-l-xl transition-shadow duration-200",
          style.accentClass,
          "group-hover:shadow-[2px_0_14px_-2px] group-hover:shadow-current/40"
        )}
      />

      {isPendingSave ? (
        <div
          className="absolute right-1.5 top-1.5 z-30 flex items-center gap-1 rounded-md border border-amber-500/35 bg-amber-950/80 px-1.5 py-0.5 text-[9px] font-semibold text-amber-100 shadow-sm"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
          Saving
        </div>
      ) : null}

      {canDrag ? (
        <button
          type="button"
          aria-label="Drag appointment"
          className={cn(
            "absolute left-0.5 top-0.5 z-20 flex cursor-grab items-center justify-center rounded-md text-slate-400",
            "touch-none transition-opacity hover:text-slate-600 active:cursor-grabbing",
            "dark:text-slate-500 dark:hover:text-slate-300",
            touchFriendly
              ? "fi-calendar-touch-target h-10 w-9 bg-white/80 opacity-100 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800/90 dark:ring-[#1e2937]"
              : "h-5 w-4 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
            isDragging && "opacity-100"
          )}
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className={cn(touchFriendly ? "h-4 w-4" : "h-3.5 w-3.5")} strokeWidth={2} aria-hidden />
        </button>
      ) : null}

      <div
        className={cn(
          "flex h-full min-h-0 gap-2 pl-3.5 pr-2.5",
          canDrag && (touchFriendly ? "pl-11" : "pl-5"),
          layout ? "py-1.5" : "p-3.5 sm:gap-3 sm:p-4",
          isCompact ? "items-center" : "items-start"
        )}
      >
        {/* Avatar / compact procedure icon */}
        {isCompact ? (
          <span
            className={cn(
              "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-white/10",
              style.accentClass,
              "text-white"
            )}
          >
            <ProcedureIcon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
          </span>
        ) : (
          <Avatar
            className={cn(
              "mt-0.5 ring-2 ring-[#1e2937] dark:ring-[#1e2937]",
              layout ? "h-7 w-7" : "h-9 w-9 sm:h-10 sm:w-10"
            )}
          >
            {appointment.avatarUrl ? (
              <AvatarImage src={appointment.avatarUrl} alt={appointment.patientName} />
            ) : null}
            <AvatarFallback
              className={cn(
                "bg-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-600",
                "dark:bg-slate-800 dark:text-slate-300"
              )}
            >
              {patientInitials(appointment.patientName)}
            </AvatarFallback>
          </Avatar>
        )}

        <div className="min-w-0 flex-1">
          {/* Patient + status */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate font-bold tracking-tight text-slate-900 dark:text-slate-50",
                  nameSize
                )}
              >
                {appointment.patientName}
              </p>

              {showMeta ? (
                <div className={cn("mt-0.5 flex items-center gap-1.5", darkProcedure.accent)}>
                  <ProcedureIcon
                    className={cn("shrink-0 opacity-90", layout || isMedium ? "h-3 w-3" : "h-3.5 w-3.5")}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <p className={cn("truncate font-semibold text-slate-700 dark:text-slate-200", textSize)}>
                    {procedureLabel}
                  </p>
                </div>
              ) : (
                <p className={cn("truncate font-medium text-slate-600 dark:text-slate-400", textSize)}>
                  {procedureLabel}
                </p>
              )}
            </div>

            {!isCompact && !layout ? (
              <StatusBadge status={appointment.status} />
            ) : null}
          </div>

          {/* Time + duration */}
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-500 dark:text-slate-400",
              isCompact ? "mt-0" : "mt-1"
            )}
          >
            <span className={cn("inline-flex items-center gap-1 tabular-nums", textSize)}>
              <Clock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              {timeLabel}
            </span>
            {durationMin > 0 ? (
              <span className={cn("font-medium tabular-nums", textSize)}>{formatDuration(durationMin)}</span>
            ) : null}
          </div>

          {/* Room + provider */}
          {showMeta && (room || provider) ? (
            <div className={cn("mt-1 flex flex-col gap-0.5 text-slate-500 dark:text-slate-400", textSize)}>
              {room ? (
                <p className="inline-flex items-center gap-1 truncate">
                  <DoorOpen className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                  {room}
                </p>
              ) : null}
              {provider ? (
                <p className="inline-flex items-center gap-1 truncate">
                  <UserRound className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                  {provider}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Price + status badges */}
          {showFooter ? (
            <div className="mt-1.5 flex items-center justify-between gap-2">
              {priceLabel ? <PriceBadge label={priceLabel} compact={Boolean(layout || isMedium)} /> : <span />}
              {layout || isMedium ? (
                <StatusBadge status={appointment.status} compact />
              ) : !priceLabel ? (
                <StatusBadge status={appointment.status} />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {canResize && onResizeEnd ? (
        <ResizeHandle
          onResizeEnd={onResizeEnd}
          onLiveHeightChange={setResizeHeightPx}
          startAt={appointment.startAt}
          baseHeightPx={layout!.heightPx}
          isResizing={resizeHeightPx != null}
          touchFriendly={touchFriendly}
        />
      ) : null}
    </Shell>
  );
}

export const AppointmentCard = React.memo(AppointmentCardInner);

/** Convenience wrapper when you already have a `FiBookingRow`. */
export const AppointmentCardFromBooking = React.memo(function AppointmentCardFromBooking({
  booking,
  display,
  layout,
  draggable,
  resizable,
  onResizeEnd,
  onClick,
  className,
  isDragPreview,
  touchFriendly,
  animateEntry,
  isPendingSave,
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
  resizable?: boolean;
  onResizeEnd?: (endIso: string) => void;
  onClick?: () => void;
  className?: string;
  isDragPreview?: boolean;
  touchFriendly?: boolean;
  animateEntry?: boolean;
  /** Awaiting PATCH confirmation after optimistic reschedule. */
  isPendingSave?: boolean;
}) {
  const appointment = appointmentCardDataFromBooking(booking, display);
  const cancelled = isBookingCancelled(booking);
  const dimTerminal = cancelled || booking.booking_status === "completed";

  return (
    <AppointmentCard
      appointment={appointment}
      layout={layout}
      draggable={draggable && !dimTerminal}
      resizable={resizable && !dimTerminal}
      onResizeEnd={onResizeEnd}
      onClick={onClick}
      className={className}
      dimTerminal={dimTerminal}
      isDragPreview={isDragPreview}
      touchFriendly={touchFriendly}
      animateEntry={animateEntry}
      isPendingSave={isPendingSave}
    />
  );
});
