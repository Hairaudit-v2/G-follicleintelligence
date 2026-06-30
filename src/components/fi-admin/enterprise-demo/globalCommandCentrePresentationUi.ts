import { cn } from "@/lib/utils";

/** TITAN Global Command Centre — Phase 1H presentation mode tokens. */
export const globalCommandCentrePresentationClasses = {
  root: "relative flex min-h-[100dvh] flex-col bg-[#03060d] text-slate-100",
  backdrop:
    "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.12),transparent),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(14,165,233,0.06),transparent)]",
  topBar:
    "relative z-20 flex shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] bg-[#03060d]/90 px-4 py-3 backdrop-blur-md sm:px-6",
  brandKicker: "text-[10px] font-semibold uppercase tracking-[0.34em] text-amber-300/90",
  brandTitle: "mt-0.5 text-sm font-semibold text-slate-50 sm:text-base",
  badge:
    "inline-flex items-center rounded-full border border-amber-400/25 bg-amber-950/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/90",
  exitLink:
    "inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-amber-400/30 hover:text-amber-100",
  painStrip:
    "relative z-10 shrink-0 border-b border-white/[0.06] bg-[#050912]/95 px-4 py-3 backdrop-blur-md sm:px-6",
  painGrid: "grid gap-2 sm:grid-cols-2 xl:grid-cols-5",
  painCard: (severity: "critical" | "warning" | "info") =>
    cn(
      "rounded-xl border px-3 py-2.5",
      severity === "critical"
        ? "border-rose-400/25 bg-rose-950/20"
        : severity === "warning"
          ? "border-amber-400/20 bg-amber-950/15"
          : "border-cyan-400/15 bg-cyan-950/10"
    ),
  painTitle: "text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400",
  painHeadline: "mt-1 text-xs font-medium leading-snug text-slate-100",
  painMetric: "mt-1 text-[10px] tabular-nums text-slate-500",
  main: "relative z-10 min-h-0 flex-1 overflow-y-auto scroll-smooth",
  sectionNav: "fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2 lg:flex",
  sectionDot: (active: boolean) =>
    cn(
      "h-2 w-2 rounded-full border transition",
      active
        ? "border-amber-300 bg-amber-300"
        : "border-white/20 bg-transparent hover:border-amber-400/50"
    ),
  storySection:
    "scroll-mt-4 border-b border-white/[0.05] px-4 py-10 sm:px-8 sm:py-14 lg:min-h-[min(72vh,820px)] lg:py-16",
  storyIndex: "text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-400/80",
  storyTitle: "mt-2 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl",
  storySubtitle: "mt-1 text-sm text-slate-400",
  storyNarrative: "mt-5 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base",
  highlightGrid: "mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  highlightTile:
    "rounded-xl border border-white/[0.07] bg-gradient-to-br from-[#0f1524]/80 via-[#0a101c]/70 to-[#060912]/80 px-4 py-3 shadow-[inset_0_1px_0_rgb(255_255_255_/0.04)]",
  highlightLabel: "text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500",
  highlightValue: "mt-1.5 text-lg font-semibold tabular-nums text-slate-50",
  footer:
    "relative z-20 shrink-0 border-t border-white/[0.06] px-4 py-2 text-center text-[10px] text-slate-600 sm:px-6",
};
