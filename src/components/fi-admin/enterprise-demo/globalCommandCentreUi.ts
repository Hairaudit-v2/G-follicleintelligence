import { cn } from "@/lib/utils";

/** TITAN Global Command Centre — gold-accent enterprise dashboard tokens. */
export const globalCommandCentreClasses = {
  page: "mx-auto max-w-[1920px] space-y-6 pb-10",
  header: "flex flex-col gap-3 border-b border-amber-400/15 pb-5 lg:flex-row lg:items-end lg:justify-between",
  kicker: "text-xs font-semibold uppercase tracking-[0.32em] text-amber-300/90",
  title: "mt-1.5 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl",
  subtitle: "mt-1 text-sm text-slate-400",
  badge:
    "inline-flex items-center rounded-full border border-amber-400/25 bg-amber-950/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/90",
  kpiGrid: "grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8",
  kpiTile:
    "rounded-xl border border-white/[0.07] bg-gradient-to-br from-[#0f1524]/90 via-[#0a101c]/85 to-[#060912]/90 px-3 py-3 shadow-[inset_0_1px_0_rgb(255_255_255_/0.05),0_12px_40px_rgb(0_0_0_/0.35)] backdrop-blur-sm",
  kpiLabel: "text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500",
  kpiValue: "mt-1 text-lg font-semibold tabular-nums tracking-tight text-slate-50 sm:text-xl",
  kpiFoot: "mt-0.5 text-[10px] text-slate-600",
  panel:
    "rounded-2xl border border-white/[0.08] bg-[#0a101c]/80 shadow-[0_20px_60px_rgb(0_0_0_/0.4),inset_0_1px_0_rgb(255_255_255_/0.04)] backdrop-blur-md",
  panelHeader: "border-b border-white/[0.06] px-4 py-3 sm:px-5",
  panelTitle: "text-sm font-semibold text-slate-100",
  panelKicker: "text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-400/75",
  panelBody: "px-4 py-3 sm:px-5 sm:py-4",
  table: "w-full text-left text-xs",
  th: "pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500",
  td: "border-t border-white/[0.05] py-2.5 align-top text-slate-300",
  riskPill: (score: number) =>
    cn(
      "inline-flex min-w-[2.25rem] justify-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums",
      score >= 70
        ? "bg-rose-950/50 text-rose-200 ring-1 ring-rose-400/30"
        : score >= 45
          ? "bg-amber-950/50 text-amber-200 ring-1 ring-amber-400/30"
          : "bg-emerald-950/40 text-emerald-200 ring-1 ring-emerald-400/25"
    ),
  alertItem: (severity: "critical" | "warning" | "info") =>
    cn(
      "rounded-xl border px-3 py-3",
      severity === "critical"
        ? "border-rose-400/25 bg-rose-950/20"
        : severity === "warning"
          ? "border-amber-400/20 bg-amber-950/15"
          : "border-cyan-400/15 bg-cyan-950/10"
    ),
  metricGrid: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
  metricTile: "rounded-lg border border-white/[0.06] bg-[#060912]/60 px-3 py-2.5",
  metricLabel: "text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500",
  metricValue: "mt-1 text-base font-semibold tabular-nums text-slate-100",
  readOnlyBanner:
    "rounded-lg border border-amber-400/20 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90",
  emptyPanel:
    "rounded-lg border border-dashed border-white/10 bg-[#060912]/40 px-4 py-8 text-center text-xs leading-relaxed text-slate-500",
  emptyPanelTitle: "text-sm font-medium text-slate-400",
};

export function formatCommandCentreMoney(cents: number, currency: string): string {
  const value = cents / 100;
  return `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function formatCommandCentrePct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

export function formatCommandCentreNumber(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function formatAlertTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
