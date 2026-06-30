"use client";

import { cn } from "@/lib/utils";
import type { ReceptionOsSeverity } from "@/src/lib/receptionOs/receptionOsBoardModel";
import { RECEPTION_OS_SEVERITY_LABELS } from "@/src/lib/receptionOs/receptionOsBoardModel";

export const RECEPTION_OS_SEVERITY_SURFACE: Record<
  ReceptionOsSeverity,
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

export function ReceptionOsSeverityBadge(props: {
  severity: ReceptionOsSeverity;
  className?: string;
}) {
  const styles = RECEPTION_OS_SEVERITY_SURFACE[props.severity];
  return (
    <span
      className={cn(
        "rounded px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
        styles.badge,
        props.className
      )}
    >
      {RECEPTION_OS_SEVERITY_LABELS[props.severity]}
    </span>
  );
}

export function receptionOsSeverityRowClass(severity: ReceptionOsSeverity): string {
  const s = RECEPTION_OS_SEVERITY_SURFACE[severity];
  return cn("border", s.border, s.bg);
}
