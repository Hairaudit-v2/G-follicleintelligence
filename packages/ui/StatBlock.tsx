import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type NetworkStatBlockProps = {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
};

export function NetworkStatBlock({ label, value, detail, className }: NetworkStatBlockProps) {
  return (
    <div className={cn("rounded-2xl border border-border/40 bg-background/30 p-5 backdrop-blur-sm", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-4xl font-semibold tracking-tight text-foreground">{value}</p>
      {detail ? <p className="mt-2 text-sm text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
