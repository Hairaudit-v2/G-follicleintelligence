"use client";

import type { CSSProperties } from "react";

import { CALENDAR_HEADER_HEIGHT_PX, CALENDAR_PX_PER_HOUR } from "@/components/calendar/ProviderColumn";
import { cn } from "@/lib/utils";

function Pulse({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn("animate-pulse rounded-lg bg-white/[0.06]", className)} style={style} aria-hidden />;
}

/** FI OS body-only placeholder while booking overlap + enrichment streams in. */
export function FiOsCalendarGridSkeleton() {
  return (
    <div
      className="flex min-h-[min(28rem,65dvh)] flex-1 flex-col overflow-hidden border-t border-white/[0.06] bg-[#050a14]"
      aria-busy
      aria-label="Loading calendar appointments"
    >
      <div className="flex min-h-0 flex-1">
        <div className="flex w-11 shrink-0 flex-col border-r border-white/[0.06] bg-[#070f1a] lg:w-14">
          <div style={{ height: CALENDAR_HEADER_HEIGHT_PX }} className="border-b border-white/[0.06]" />
          <div className="space-y-6 px-2 py-3">
            {Array.from({ length: 8 }, (_, i) => (
              <Pulse key={i} className="ml-auto h-3 w-9" />
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 overflow-hidden">
          {[0, 1, 2].map((col) => (
            <div
              key={col}
              className="min-w-[var(--col-min)] flex-1 border-l border-white/[0.06] first:border-l-0"
            >
              <div
                className="flex items-center gap-2 border-b border-white/[0.06] px-3"
                style={{ height: CALENDAR_HEADER_HEIGHT_PX }}
              >
                <Pulse className="h-8 w-8 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Pulse className="h-3 w-24" />
                  <Pulse className="h-2.5 w-16" />
                </div>
              </div>
              <div className="relative bg-[#060d18]" style={{ height: 12 * CALENDAR_PX_PER_HOUR }}>
                {[80, 200, 320].map((top, i) => (
                  <Pulse key={i} className="absolute inset-x-2 h-14 rounded-xl" style={{ top: top + col * 12 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
