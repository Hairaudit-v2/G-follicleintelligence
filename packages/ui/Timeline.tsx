import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type NetworkTimelineItem = {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
};

export type NetworkTimelineProps = {
  items: readonly NetworkTimelineItem[];
  className?: string;
};

export function NetworkTimeline({ items, className }: NetworkTimelineProps) {
  return (
    <ol className={cn("relative space-y-8 border-l border-border/40 pl-8", className)}>
      {items.map((item, idx) => (
        <li key={idx} className="relative">
          <span
            className="absolute -left-[9px] top-1.5 h-3 w-3 rounded-full border border-amber-400/40 bg-amber-400/25"
            aria-hidden
          />
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-3">
              <h4 className="font-display text-base font-semibold text-foreground">{item.title}</h4>
              {item.meta ? <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.meta}</span> : null}
            </div>
            {item.description ? <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
