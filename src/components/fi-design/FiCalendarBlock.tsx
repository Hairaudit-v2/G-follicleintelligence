import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export type FiCalendarTone = "consult" | "treatment" | "surgery" | "followup" | "neutral";

const toneMap: Record<FiCalendarTone, string> = {
  consult: "border-sky-200 bg-sky-50 text-sky-900",
  treatment: "border-violet-200 bg-violet-50 text-violet-900",
  surgery: "border-amber-200 bg-amber-50 text-amber-900",
  followup: "border-emerald-200 bg-emerald-50 text-emerald-900",
  neutral: "border-slate-200 bg-slate-50 text-slate-800",
};

export type FiCalendarBlockProps = {
  title: string;
  subtitle?: string;
  timeLabel?: string;
  tone?: FiCalendarTone;
  placeholder?: boolean;
  className?: string;
  style?: CSSProperties;
};

/**
 * Appointment-style block — list row or absolutely positioned day cell.
 */
export function FiCalendarBlock({
  title,
  subtitle,
  timeLabel,
  tone = "neutral",
  placeholder,
  className,
  style,
}: FiCalendarBlockProps) {
  const isAbsolute = style != null && ("top" in style || "height" in style);

  if (isAbsolute) {
    return (
      <div
        role="listitem"
        className={cn(
          "absolute left-0 right-0 overflow-hidden rounded-md border px-2 py-1.5 shadow-sm",
          toneMap[tone],
          placeholder && "border-dashed",
          className
        )}
        style={style}
      >
        <p className="text-xs font-semibold leading-tight">{title}</p>
        {subtitle ? (
          <p className="mt-0.5 text-[10px] font-medium opacity-80">{subtitle}</p>
        ) : placeholder ? (
          <p className="mt-0.5 text-[10px] font-medium opacity-80">Sample · not a live booking</p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-b-0",
        className
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        {subtitle ? (
          <p className="text-xs text-slate-500">{subtitle}</p>
        ) : placeholder ? (
          <p className="text-xs text-slate-500">Placeholder schedule · not connected to calendar</p>
        ) : null}
      </div>
      {timeLabel ? (
        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{timeLabel}</span>
      ) : null}
    </div>
  );
}
