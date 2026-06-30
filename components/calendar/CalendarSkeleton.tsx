"use client";

import { motion } from "framer-motion";
import type { CSSProperties } from "react";

import { CALENDAR_HEADER_HEIGHT_PX, CALENDAR_PX_PER_HOUR } from "@/components/calendar/ProviderColumn";
import { cn } from "@/lib/utils";

function Shimmer({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 bg-[length:200%_100%]",
        className
      )}
      style={{ animationDuration: "1.4s", ...style }}
    />
  );
}

function SkeletonColumn({ index }: { index: number }) {
  const tops = [72, 168, 280, 360];
  return (
    <div className="min-w-[var(--col-min)] flex-1 border-l border-white/[0.08] first:border-l-0">
      <div
        className="flex items-center gap-2.5 border-b border-white/[0.08] px-3"
        style={{ height: CALENDAR_HEADER_HEIGHT_PX }}
      >
        <Shimmer className="h-8 w-8 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Shimmer className="h-3.5 w-24" />
          <Shimmer className="h-2.5 w-16" />
        </div>
      </div>
      <div className="relative bg-[#f8fafc]" style={{ height: 12 * CALENDAR_PX_PER_HOUR }}>
        {tops.map((top, i) => (
          <Shimmer
            key={`${index}-${i}`}
            className="absolute inset-x-2 h-14 rounded-xl opacity-80"
            style={{ top, animationDelay: `${(index + i) * 80}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="fi-calendar-shell flex min-h-[min(32rem,72dvh)] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-lg shadow-black/40 lg:min-h-[calc(100dvh-13rem)]"
      aria-busy
      aria-label="Loading calendar"
    >
      {/* Top controls */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] px-4 py-3">
        <Shimmer className="h-9 w-36 rounded-xl" />
        <Shimmer className="h-9 w-32 rounded-xl" />
        <Shimmer className="hidden h-4 w-48 lg:block" />
        <div className="ml-auto flex gap-2">
          <Shimmer className="h-9 w-40 rounded-xl" />
          <Shimmer className="h-9 w-28 rounded-xl" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar rail */}
        <div className="flex w-12 shrink-0 flex-col items-center gap-3 border-r border-white/[0.08] py-4 sm:w-14">
          <Shimmer className="h-9 w-9 rounded-lg" />
          <Shimmer className="h-9 w-9 rounded-lg" />
          <Shimmer className="mt-auto h-6 w-8 rounded-full" />
        </div>

        {/* Grid */}
        <div className="flex min-w-0 flex-1 overflow-hidden">
          <div className="w-11 shrink-0 border-r border-white/[0.08] bg-[#f8fafc] lg:w-14">
            <div style={{ height: CALENDAR_HEADER_HEIGHT_PX }} className="border-b border-white/[0.08]" />
            <div className="space-y-7 px-2 py-3">
              {Array.from({ length: 8 }, (_, i) => (
                <Shimmer key={i} className="ml-auto h-3 w-8" />
              ))}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 overflow-hidden">
            {[0, 1, 2].map((i) => (
              <SkeletonColumn key={i} index={i} />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
