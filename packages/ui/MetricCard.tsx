import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { NetworkCard } from "./Card";

export type NetworkMetricCardProps = {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
  trend?: ReactNode;
};

export function NetworkMetricCard({ label, value, hint, trend, className }: NetworkMetricCardProps) {
  return (
    <NetworkCard variant="elevated" padding="sm" className={cn(className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}
        </div>
        {trend ? <div className="shrink-0 text-xs text-muted-foreground">{trend}</div> : null}
      </div>
    </NetworkCard>
  );
}
