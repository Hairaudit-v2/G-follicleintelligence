"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  BookingConflictMessage,
  BookingConflictPreviewResult,
} from "@/src/lib/calendar/bookingConflictPreview.server";

export type BookingConflictPreviewVariant = "dark" | "light";

const STATUS_LABEL: Record<BookingConflictPreviewResult["status"], string> = {
  available: "Available",
  warning: "Available with warnings",
  blocked: "Conflicts found",
};

const CONTAINER_CLASSES: Record<
  BookingConflictPreviewVariant,
  Record<BookingConflictPreviewResult["status"], string>
> = {
  dark: {
    available: "border-emerald-500/30 bg-emerald-950/25 text-emerald-100",
    warning: "border-amber-500/30 bg-amber-950/25 text-amber-100",
    blocked: "border-rose-500/35 bg-rose-950/25 text-rose-100",
  },
  light: {
    available: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    warning: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    blocked: "border-rose-500/20 bg-rose-500/10 text-rose-300",
  },
};

const HEADER_CLASSES: Record<
  BookingConflictPreviewVariant,
  Record<BookingConflictPreviewResult["status"], string>
> = {
  dark: {
    available: "text-emerald-200",
    warning: "text-amber-200",
    blocked: "text-rose-200",
  },
  light: {
    available: "text-emerald-300",
    warning: "text-amber-300",
    blocked: "text-rose-300",
  },
};

function severityIconClass(
  severity: BookingConflictMessage["severity"],
  variant: BookingConflictPreviewVariant
): string {
  if (severity === "error") return variant === "dark" ? "text-rose-300" : "text-rose-300";
  if (severity === "warning") return variant === "dark" ? "text-amber-300" : "text-amber-300";
  return variant === "dark" ? "text-sky-300" : "text-cyan-300";
}

function SeverityIcon({
  severity,
  variant,
}: {
  severity: BookingConflictMessage["severity"];
  variant: BookingConflictPreviewVariant;
}) {
  const className = cn("mt-0.5 h-3.5 w-3.5 shrink-0", severityIconClass(severity, variant));
  if (severity === "error") return <XCircle className={className} aria-hidden />;
  if (severity === "warning") return <AlertTriangle className={className} aria-hidden />;
  return <Info className={className} aria-hidden />;
}

/**
 * Live availability panel for booking drawers. Green = available, amber = warnings,
 * red = save would be blocked by server validation.
 */
export function BookingConflictPreview({
  preview,
  loading = false,
  variant = "dark",
  className,
}: {
  preview: BookingConflictPreviewResult | null;
  loading?: boolean;
  variant?: BookingConflictPreviewVariant;
  className?: string;
}) {
  if (loading) {
    return (
      <div
        className={cn(
          "rounded-xl border px-3 py-2.5 text-xs",
          variant === "dark"
            ? "border-white/[0.1] bg-slate-950/25 text-slate-400"
            : "border-white/[0.08] bg-white/[0.03] text-gray-500",
          className
        )}
        role="status"
        aria-live="polite"
      >
        Checking availability…
      </div>
    );
  }

  if (!preview) return null;

  const { status, messages } = preview;

  return (
    <div
      className={cn("rounded-xl border px-3 py-2.5", CONTAINER_CLASSES[variant][status], className)}
      role="status"
      aria-live="polite"
    >
      <p
        className={cn(
          "flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide",
          HEADER_CLASSES[variant][status]
        )}
      >
        {status === "available" ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        ) : status === "warning" ? (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        ) : (
          <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
        {STATUS_LABEL[status]}
      </p>
      {messages.length > 0 ? (
        <ul className="mt-1.5 space-y-1 text-xs leading-snug">
          {messages.map((m, i) => (
            <li key={`${m.type}-${i}`} className="flex items-start gap-1.5">
              <SeverityIcon severity={m.severity} variant={variant} />
              <span>{m.message}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs opacity-80">
          No conflicts for the selected time, room, and staff.
        </p>
      )}
    </div>
  );
}
