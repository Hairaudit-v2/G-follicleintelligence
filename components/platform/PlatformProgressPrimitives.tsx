"use client";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import type { PlatformProgressStatus } from "@/lib/marketing/platformProgressPageContent";

export const PLATFORM_PROGRESS_STATUS_STYLES: Record<
  PlatformProgressStatus,
  { badge: string; dot: string; bar: string }
> = {
  Live: {
    badge:
      "border-emerald-400/35 bg-emerald-950/40 text-emerald-200/95 shadow-[0_0_20px_rgb(52_211_153_/0.12)]",
    dot: "bg-emerald-400 shadow-[0_0_10px_rgb(52_211_153_/0.55)]",
    bar: "from-emerald-400/90 via-emerald-300/70 to-cyan-400/60",
  },
  Production: {
    badge:
      "border-amber-400/35 bg-amber-950/35 text-amber-100/95 shadow-[0_0_20px_rgb(212_175_55_/0.1)]",
    dot: "bg-amber-300 shadow-[0_0_10px_rgb(212_175_55_/0.5)]",
    bar: "from-amber-400/95 via-amber-300/75 to-amber-200/55",
  },
  "Pilot Ready": {
    badge:
      "border-violet-400/30 bg-violet-950/35 text-violet-100/95 shadow-[0_0_20px_rgb(167_139_250_/0.1)]",
    dot: "bg-violet-400 shadow-[0_0_10px_rgb(167_139_250_/0.45)]",
    bar: "from-violet-400/85 via-fuchsia-400/55 to-violet-300/60",
  },
  "Operational beta": {
    badge: "border-sky-400/30 bg-sky-950/35 text-sky-100/95 shadow-[0_0_20px_rgb(56_189_248_/0.1)]",
    dot: "bg-sky-400 shadow-[0_0_10px_rgb(56_189_248_/0.45)]",
    bar: "from-sky-400/85 via-cyan-400/55 to-sky-300/60",
  },
  "Active Development": {
    badge:
      "border-cyan-400/30 bg-cyan-950/30 text-cyan-100/95 shadow-[0_0_20px_rgb(34_211_238_/0.08)]",
    dot: "bg-cyan-400 shadow-[0_0_10px_rgb(34_211_238_/0.45)]",
    bar: "from-cyan-400/85 via-[hsl(var(--primary)/0.85)] to-cyan-300/55",
  },
  "Infrastructure Complete": {
    badge: "border-white/15 bg-white/[0.04] text-foreground/90",
    dot: "bg-slate-300/80",
    bar: "from-slate-400/70 via-slate-300/50 to-white/30",
  },
};

export function PlatformProgressStatusBadge({
  status,
  label,
}: {
  status: PlatformProgressStatus;
  label?: string;
}) {
  const styles = PLATFORM_PROGRESS_STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-2 whitespace-nowrap rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] sm:text-[10px] sm:tracking-[0.16em]",
        styles.badge
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", styles.dot)} aria-hidden />
      {label ?? status}
    </span>
  );
}

export function PlatformProgressAnimatedBar({
  percent,
  status,
  delay = 0,
  className,
}: {
  percent: number;
  status: PlatformProgressStatus;
  delay?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const styles = PLATFORM_PROGRESS_STATUS_STYLES[status];

  return (
    <div
      className={cn(
        "relative h-2 overflow-hidden rounded-full border border-white/[0.06] bg-black/30 shadow-[inset_0_1px_2px_rgb(0_0_0_/0.35)]",
        className
      )}
    >
      <motion.div
        className={cn("absolute inset-y-0 left-0 rounded-full bg-gradient-to-r", styles.bar)}
        initial={{ width: reduceMotion ? `${percent}%` : "0%" }}
        whileInView={{ width: `${percent}%` }}
        viewport={{ once: true }}
        transition={{
          duration: reduceMotion ? 0 : 1.1,
          delay: reduceMotion ? 0 : delay,
          ease: [0.22, 1, 0.36, 1],
        }}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      />
      {!reduceMotion ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-white/25 to-transparent"
          initial={{ x: "-100%", opacity: 0 }}
          whileInView={{ x: "320%", opacity: [0, 1, 0] }}
          viewport={{ once: true }}
          transition={{
            duration: 1.4,
            delay: delay + 0.35,
            ease: "easeOut",
          }}
        />
      ) : null}
    </div>
  );
}
