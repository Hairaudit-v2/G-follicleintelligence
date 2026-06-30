import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export type FiCalendarTone = "consult" | "treatment" | "surgery" | "followup" | "neutral";

const toneMap: Record<FiCalendarTone, string> = {
  consult: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
  treatment: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  surgery: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  followup: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  neutral: "border-white/[0.08] bg-white/[0.03] text-slate-200",
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
        "flex items-center justify-between gap-3 border-b border-white/[0.06] py-2.5 last:border-b-0",
        className
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-100">{title}</p>
        {subtitle ? (
          <p className="text-xs text-slate-500">{subtitle}</p>
        ) : placeholder ? (
          <p className="text-xs text-slate-500">Placeholder schedule · not connected to calendar</p>
        ) : null}
      </div>
      {timeLabel ? (
        <span className="shrink-0 rounded-md bg-white/[0.06] px-2 py-1 text-xs font-medium text-slate-400">{timeLabel}</span>
      ) : null}
    </div>
  );
}
