"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type CalendarColumnPagerProps = {
  labels: string[];
  subtitles?: (string | null)[];
  activeIndex: number;
  onSelect: (index: number) => void;
  className?: string;
};

export function CalendarColumnPager({
  labels,
  subtitles = [],
  activeIndex,
  onSelect,
  className,
}: CalendarColumnPagerProps) {
  const total = labels.length;
  if (total <= 1) return null;

  const safeIndex = Math.max(0, Math.min(activeIndex, total - 1));
  const subtitle = subtitles[safeIndex];

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-3 py-2 lg:hidden",
        className
      )}
      role="toolbar"
      aria-label="Calendar column navigation"
    >
      <button
        type="button"
        onClick={() => onSelect(safeIndex - 1)}
        disabled={safeIndex <= 0}
        className="fi-calendar-touch-target inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-300 transition enabled:hover:bg-[#0F1629]/80 backdrop-blur-md disabled:opacity-40"
        aria-label="Previous column"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>

      <div className="min-w-0 flex-1 text-center">
        <p className="truncate text-sm font-semibold text-slate-100">{labels[safeIndex]}</p>
        {subtitle ? (
          <p className="truncate text-[11px] font-medium text-slate-500">{subtitle}</p>
        ) : (
          <p className="text-[11px] font-medium tabular-nums text-slate-500">
            {safeIndex + 1} of {total}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onSelect(safeIndex + 1)}
        disabled={safeIndex >= total - 1}
        className="fi-calendar-touch-target inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-300 transition enabled:hover:bg-[#0F1629]/80 backdrop-blur-md disabled:opacity-40"
        aria-label="Next column"
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
