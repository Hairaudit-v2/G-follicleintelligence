import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type NetworkBadgeTone = "neutral" | "accent" | "success" | "warning";

const toneClasses: Record<NetworkBadgeTone, string> = {
  neutral: "border-white/10 bg-white/[0.06] text-foreground/90",
  accent: "border-amber-400/25 bg-amber-400/10 text-amber-100",
  success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-50",
};

export type NetworkBadgeProps = {
  children: ReactNode;
  className?: string;
  tone?: NetworkBadgeTone;
};

export function NetworkBadge({ children, className, tone = "neutral" }: NetworkBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
