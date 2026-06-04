import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type FiStatusBadgeProps = {
  tone: "neutral" | "success" | "warning" | "danger" | "info";
  children: ReactNode;
  className?: string;
};

const tones: Record<FiStatusBadgeProps["tone"], string> = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  danger: "border-red-200 bg-red-50 text-red-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
};

export function FiStatusBadge({ tone, children, className }: FiStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
