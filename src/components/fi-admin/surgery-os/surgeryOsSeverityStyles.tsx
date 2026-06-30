"use client";

import { cn } from "@/lib/utils";
import type { SurgeryOsSeverity } from "@/src/lib/surgeryOs/surgeryOsBoardModel";
import { SURGERY_OS_SEVERITY_LABELS } from "@/src/lib/surgeryOs/surgeryOsBoardModel";

export const SURGERY_OS_SEVERITY_SURFACE: Record<
  SurgeryOsSeverity,
  { border: string; bg: string; text: string; badge: string }
> = {
  info: {
    border: "border-sky-500/20",
    bg: "bg-sky-500/[0.05]",
    text: "text-sky-400",
    badge: "bg-sky-500/15 text-sky-300",
  },
  warning: {
    border: "border-amber-500/25",
    bg: "bg-amber-500/[0.06]",
    text: "text-amber-400",
    badge: "bg-amber-500/15 text-amber-300",
  },
  critical: {
    border: "border-rose-500/30",
    bg: "bg-rose-500/[0.07]",
    text: "text-rose-400",
    badge: "bg-rose-500/20 text-rose-300",
  },
  blocked: {
    border: "border-fuchsia-500/35",
    bg: "bg-fuchsia-500/[0.08]",
    text: "text-fuchsia-300",
    badge: "bg-fuchsia-500/20 text-fuchsia-200",
  },
};

export function SurgeryOsSeverityBadge(props: { severity: SurgeryOsSeverity; className?: string }) {
  const styles = SURGERY_OS_SEVERITY_SURFACE[props.severity];
  return (
    <span
      className={cn(
        "rounded px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
        styles.badge,
        props.className
      )}
    >
      {SURGERY_OS_SEVERITY_LABELS[props.severity]}
    </span>
  );
}

export function surgeryOsSeverityRowClass(severity: SurgeryOsSeverity): string {
  const s = SURGERY_OS_SEVERITY_SURFACE[severity];
  return cn("border", s.border, s.bg);
}

export const SURGERY_OS_LIVE_STATUS_SURFACE: Record<string, { dot: string; text: string }> = {
  waiting: { dot: "bg-slate-400", text: "text-slate-400" },
  active: { dot: "bg-emerald-400", text: "text-emerald-400" },
  break: { dot: "bg-amber-400", text: "text-amber-400" },
  delayed: { dot: "bg-orange-400", text: "text-orange-400" },
  blocked: { dot: "bg-fuchsia-400", text: "text-fuchsia-300" },
  completed: { dot: "bg-cyan-400", text: "text-cyan-400" },
};

export const SURGERY_OS_RISK_SURFACE: Record<string, { border: string; bg: string; text: string }> =
  {
    low: { border: "border-emerald-500/20", bg: "bg-emerald-500/[0.06]", text: "text-emerald-400" },
    medium: { border: "border-amber-500/25", bg: "bg-amber-500/[0.06]", text: "text-amber-400" },
    high: { border: "border-rose-500/30", bg: "bg-rose-500/[0.07]", text: "text-rose-400" },
    blocked: {
      border: "border-fuchsia-500/35",
      bg: "bg-fuchsia-500/[0.08]",
      text: "text-fuchsia-300",
    },
  };
