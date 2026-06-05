"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { CalendarPlus, CalendarX2, Inbox, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { emptyStateVariants } from "@/lib/calendar/calendarMotion";
import { cn } from "@/lib/utils";

const PRESETS = {
  column: {
    icon: CalendarX2,
    title: "No appointments",
    description: "This slot is open. Drag from the waitlist or press N to book.",
  },
  day: {
    icon: Inbox,
    title: "Clear schedule",
    description: "No bookings for this day in the current filters.",
  },
  agenda: {
    icon: CalendarPlus,
    title: "Nothing scheduled",
    description: "Upcoming appointments will appear here.",
  },
  waitlist: {
    icon: Users,
    title: "Waitlist is empty",
    description: "Patients awaiting a slot will show up here.",
  },
} as const satisfies Record<
  string,
  { icon: LucideIcon; title: string; description: string }
>;

export type CalendarEmptyPreset = keyof typeof PRESETS;

export function CalendarEmptyState({
  preset,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  preset?: CalendarEmptyPreset;
  title?: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const base = preset ? PRESETS[preset] : null;
  const Icon = base?.icon ?? Inbox;
  const heading = title ?? base?.title ?? "Nothing here";
  const body = description ?? base?.description ?? "";

  return (
    <motion.div
      variants={emptyStateVariants}
      initial="hidden"
      animate="show"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-3 py-6" : "px-6 py-10",
        className
      )}
      role="status"
    >
      <span
        className={cn(
          "mb-3 inline-flex items-center justify-center rounded-2xl bg-slate-100 text-slate-500 ring-1 ring-slate-200/80",
          compact ? "h-10 w-10" : "h-12 w-12"
        )}
      >
        <Icon className={cn(compact ? "h-5 w-5" : "h-6 w-6")} strokeWidth={1.75} aria-hidden />
      </span>
      <p className={cn("font-semibold tracking-tight text-slate-800", compact ? "text-xs" : "text-sm")}>
        {heading}
      </p>
      {body ? (
        <p className={cn("mt-1 max-w-[16rem] text-slate-500", compact ? "text-[10px] leading-relaxed" : "text-xs leading-relaxed")}>
          {body}
        </p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </motion.div>
  );
}
