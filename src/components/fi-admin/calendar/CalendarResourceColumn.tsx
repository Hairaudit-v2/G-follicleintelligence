"use client";

import { cn } from "@/lib/utils";

export function CalendarResourceColumn({
  label,
  subtitle,
  headerClassName,
  children,
  bodyMinHeightPx,
}: {
  label: string;
  subtitle: string | null;
  headerClassName?: string;
  children: React.ReactNode;
  bodyMinHeightPx: number;
}) {
  return (
    <div className="flex min-w-[7.5rem] flex-1 flex-col border-l border-slate-200 first:border-l-0 dark:border-slate-800">
      <div
        className={cn(
          "sticky top-0 z-[2] flex min-h-[3.5rem] flex-col justify-center border-b border-slate-200 bg-slate-50 px-1 py-2 text-center dark:border-slate-800 dark:bg-slate-900",
          headerClassName
        )}
      >
        <div className="truncate text-[11px] font-semibold text-slate-900 dark:text-slate-100">{label}</div>
        {subtitle ? <div className="truncate text-[10px] text-slate-600 dark:text-slate-400">{subtitle}</div> : null}
      </div>
      <div className="relative flex-1 bg-white dark:bg-slate-950" style={{ minHeight: bodyMinHeightPx }}>
        {children}
      </div>
    </div>
  );
}
