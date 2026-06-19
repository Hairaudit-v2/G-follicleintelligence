"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { FiCalendarWorkspaceDisplayTheme } from "@/src/components/fi-admin/calendar/fiCalendarWorkspaceDisplayTheme";

export type CalendarToolbarFilterOption = { value: string; label: string };

export function CalendarToolbarFilterSelect({
  value,
  options,
  onValueChange,
  placeholder,
  icon: Icon,
  ariaLabel,
  variant = "default",
  displayTheme = "dark",
  maxWidthClass = "max-w-[9rem] sm:max-w-[11rem]",
}: {
  value: string;
  options: CalendarToolbarFilterOption[];
  onValueChange: (value: string) => void;
  placeholder: string;
  icon: LucideIcon;
  ariaLabel: string;
  variant?: "default" | "fiOs";
  displayTheme?: FiCalendarWorkspaceDisplayTheme;
  maxWidthClass?: string;
}) {
  const isFiOs = variant === "fiOs";
  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder;

  const triggerShell = isFiOs
    ? "border-[color:var(--fi-cal-ws-controls-inset-border,rgba(255,255,255,0.08))] bg-[var(--fi-cal-ws-controls-inset-bg,rgb(6_13_24/0.9))] text-[var(--fi-cal-ws-text,#e2e8f0)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    : "border-[#1e2937] bg-[#0b1220] text-slate-200 shadow-sm shadow-black/20";

  const menuShell = isFiOs
    ? "border-[color:var(--fi-cal-ws-controls-inset-border,#e2e8f0)] bg-[var(--fi-cal-ws-controls-inset-bg,#ffffff)] text-[var(--fi-cal-ws-text,#0f172a)]"
    : "border-[#1e2937] bg-[#0f172a] text-slate-100";

  const itemActive = isFiOs
    ? displayTheme === "light"
      ? "bg-cyan-500/15 font-semibold text-cyan-900"
      : "bg-cyan-500/15 font-semibold text-cyan-100"
    : "bg-sky-500/20 font-semibold text-sky-100";

  const itemIdle = isFiOs
    ? displayTheme === "light"
      ? "text-[var(--fi-cal-ws-text,#0f172a)] focus:bg-slate-100 focus:text-[var(--fi-cal-ws-text,#0f172a)]"
      : "text-[var(--fi-cal-ws-text,#f1f5f9)] focus:bg-white/[0.08] focus:text-[var(--fi-cal-ws-text,#f1f5f9)]"
    : "text-slate-200 focus:bg-slate-800 focus:text-white";

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        type="button"
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-400/40",
          triggerShell
        )}
        aria-label={ariaLabel}
      >
        <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        <span className={cn("truncate", maxWidthClass)}>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn("z-[200] max-h-[min(20rem,70dvh)] overflow-y-auto shadow-lg", menuShell)}>
        <DropdownMenuItem
          className={cn("cursor-pointer", !value ? itemActive : itemIdle)}
          onSelect={() => onValueChange("")}
        >
          {placeholder}
        </DropdownMenuItem>
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            className={cn("cursor-pointer", value === o.value ? itemActive : itemIdle)}
            onSelect={() => onValueChange(o.value)}
          >
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
