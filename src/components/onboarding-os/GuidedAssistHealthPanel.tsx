"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Download } from "lucide-react";

import {
  exportGuidedAssistHealthCsvAction,
  loadGuidedAssistHealthSnapshotAction,
} from "@/lib/actions/fi-onboarding-os-guided-assist-actions";
import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import type {
  GuidedAssistHealthSnapshot,
  GuidedAssistHealthWindowDays,
  GuidedAssistTodayRoleKey,
} from "@/src/lib/onboarding-os/guidedAssistTypes";

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

const ROLE_OPTIONS: { value: GuidedAssistTodayRoleKey | "all"; label: string }[] = [
  { value: "all", label: "All roles" },
  { value: "reception", label: "Reception" },
  { value: "consultant", label: "Consultant" },
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "finance", label: "Finance" },
  { value: "admin", label: "Admin" },
];

function MetricCard({
  label,
  value,
  hint,
  barPercent,
  accent = "cyan",
  animate,
}: {
  label: string;
  value: string | number;
  hint?: string;
  /** Optional 0–100 fill bar under the value. */
  barPercent?: number;
  accent?: "cyan" | "emerald" | "amber" | "slate";
  animate?: boolean;
}) {
  const fill =
    accent === "emerald"
      ? "bg-emerald-400/80"
      : accent === "amber"
        ? "bg-amber-400/70"
        : accent === "slate"
          ? "bg-slate-400/60"
          : "bg-cyan-400/75";
  const ring =
    accent === "emerald"
      ? "border-emerald-400/20"
      : accent === "amber"
        ? "border-amber-400/20"
        : "border-white/[0.08]";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-gradient-to-b from-white/[0.04] to-transparent px-3.5 py-3 shadow-sm shadow-black/10 transition-opacity duration-500 sm:px-4 sm:py-3.5",
        ring,
        animate ? "opacity-100" : "opacity-95"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-slate-50 sm:text-[1.65rem]">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
      {typeof barPercent === "number" ? (
        <div
          className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
          role="presentation"
        >
          <div
            className={cn("h-full rounded-full transition-[width] duration-700 ease-out", fill)}
            style={{ width: `${Math.max(0, Math.min(100, barPercent))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function RankCard({
  title,
  empty,
  items,
  accent = "cyan",
}: {
  title: string;
  empty: string;
  items: readonly {
    key: string;
    label: string;
    preview?: string;
    meta: string;
    barPercent: number;
  }[];
  accent?: "cyan" | "amber";
}) {
  const fill = accent === "amber" ? "bg-amber-400/65" : "bg-cyan-400/70";
  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 sm:p-4">
      <h4 className="text-xs font-semibold tracking-tight text-slate-100">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-500">{empty}</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {items.map((item, i) => (
            <li key={item.key} className="min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-200">
                    <span className="mr-1.5 tabular-nums text-slate-500">{i + 1}.</span>
                    {item.label}
                  </p>
                  {item.preview ? (
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">
                      {item.preview}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[11px] font-medium tabular-nums text-slate-400">
                  {item.meta}
                </span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-700 ease-out", fill)}
                  style={{ width: `${item.barPercent}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Admin-only Clinic guide health: adoption, feedback, popular tips & pain points.
 * Tenant-scoped; operational UX metrics only. Lightweight Tailwind bars (no chart lib).
 */
export function GuidedAssistHealthPanel({
  tenantId,
  windowDays: initialWindowDays = 30,
}: {
  tenantId: string;
  windowDays?: GuidedAssistHealthWindowDays;
}) {
  const [windowDays, setWindowDays] = useState<GuidedAssistHealthWindowDays>(
    initialWindowDays === 7 ? 7 : 30
  );
  const [role, setRole] = useState<GuidedAssistTodayRoleKey | "all">("all");
  const [health, setHealth] = useState<GuidedAssistHealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [pending, startTransition] = useTransition();
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    startTransition(() => {
      void loadGuidedAssistHealthSnapshotAction(tenantId, { windowDays, role }).then((res) => {
        if (!res.ok) {
          setError(res.error);
          setHealth(null);
          return;
        }
        setHealth(res.health);
        setLoadedOnce(true);
      });
    });
  }, [tenantId, windowDays, role]);

  useEffect(() => {
    load();
  }, [load]);

  const onExport = () => {
    setExportError(null);
    startTransition(() => {
      void exportGuidedAssistHealthCsvAction(tenantId, { windowDays, role }).then((res) => {
        if (!res.ok) {
          setExportError(res.error);
          return;
        }
        downloadCsv(res.csv, res.filename);
      });
    });
  };

  const filterBar = (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Time window">
        {([7, 30] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setWindowDays(d)}
            disabled={pending}
            className={cn(
              "min-h-10 rounded-xl border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
              windowDays === d
                ? "border-cyan-400/45 bg-cyan-500/20 text-cyan-50"
                : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
            )}
            aria-pressed={windowDays === d}
          >
            Last {d} days
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="guide-health-role">
          Filter by role
        </label>
        <select
          id="guide-health-role"
          value={role}
          disabled={pending}
          onChange={(e) => setRole(e.target.value as GuidedAssistTodayRoleKey | "all")}
          className="min-h-10 rounded-xl border border-white/10 bg-[#0B1220] px-3 text-xs font-medium text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onExport}
          disabled={pending}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 disabled:opacity-50"
          data-testid="guided-assist-health-export"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Export CSV
        </button>
      </div>
    </div>
  );

  if (error && !health) {
    return (
      <div className="space-y-3" data-testid="guided-assist-health-panel">
        {filterBar}
        <p className="text-sm text-slate-400" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!health) {
    return (
      <div
        className="space-y-4"
        aria-busy="true"
        aria-label="Loading Guide Health"
        data-testid="guided-assist-health-skeleton"
      >
        {filterBar}
        <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[5.5rem] animate-pulse rounded-2xl bg-white/[0.06]" />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-40 animate-pulse rounded-2xl bg-white/[0.06]" />
          <div className="h-40 animate-pulse rounded-2xl bg-white/[0.06]" />
        </div>
      </div>
    );
  }

  const animate = loadedOnce && !pending;

  return (
    <section
      className="space-y-4"
      data-testid="guided-assist-health-panel"
      aria-label="Clinic guide health"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className={fiOsChromeClasses.sectionEyebrow}>Clinic guide · Health</p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-[#F8FAFC] sm:text-lg">
            Guide Health
          </h3>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#94A3B8]">
            A calm, actionable snapshot of how the team uses operational tips — never clinical
            content. Filter by time or role, then export if you want a closer look offline.
          </p>
        </div>
        {pending ? (
          <span className="shrink-0 text-[11px] text-slate-500" aria-live="polite">
            Updating…
          </span>
        ) : null}
      </div>

      {filterBar}
      {exportError ? (
        <p className="text-xs text-amber-300" role="alert">
          {exportError}
        </p>
      ) : null}

      <div
        className={cn(
          "grid grid-cols-2 gap-2.5 transition-opacity duration-500 sm:grid-cols-4 sm:gap-3",
          animate ? "opacity-100" : "opacity-90"
        )}
      >
        <MetricCard
          label="Adoption"
          value={formatPercent(health.adoptionRate)}
          hint={`${health.usersWithGuideOn} of ${health.usersWithPreferenceRow} with guide on`}
          barPercent={Math.round(health.adoptionRate * 100)}
          accent="cyan"
          animate={animate}
        />
        <MetricCard
          label="Thumbs up"
          value={formatPercent(health.thumbsUpRate)}
          hint={`${health.thumbsUp} up · ${health.thumbsDown} down`}
          barPercent={Math.round(health.thumbsUpRate * 100)}
          accent="emerald"
          animate={animate}
        />
        <MetricCard
          label="Tips shown"
          value={health.tipsShown}
          hint={
            health.roleFilter !== "all"
              ? `Filtered · ${health.roleFilter}`
              : `${health.windowDays}-day window`
          }
          accent="slate"
          animate={animate}
        />
        <MetricCard
          label="Quick actions"
          value={health.quickActionsClicked}
          hint={`${health.toursCompleted} tours completed`}
          accent="amber"
          animate={animate}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <RankCard
          title="Top 5 tips"
          empty="No tip views in this window yet — that’s okay; metrics grow as people explore."
          items={health.topTips.map((t) => ({
            key: t.code,
            label: t.title,
            preview: t.preview,
            meta: `${t.count}×`,
            barPercent: t.barPercent,
          }))}
        />
        <RankCard
          title="Top 5 quick actions"
          empty="No quick actions clicked yet. Clinical roles will light this up on busy days."
          items={health.topQuickActions.map((t) => ({
            key: t.code,
            label: t.title,
            preview: t.preview,
            meta: `${t.count}×`,
            barPercent: t.barPercent,
          }))}
        />
      </div>

      <RankCard
        title="Pain points (thumbs down)"
        empty="No unhelpful votes yet — a quiet win. Check back after the first week."
        accent="amber"
        items={health.painPoints.map((t) => ({
          key: t.code,
          label: t.title,
          preview: t.preview,
          meta: `${t.thumbsDown} down · ${t.thumbsUp} up`,
          barPercent: t.barPercent,
        }))}
      />

      <p className="text-[11px] leading-relaxed text-slate-600">
        Role filter uses tip audience from the catalog and any{" "}
        <code className="rounded bg-white/5 px-1">todayRole</code> on newer events. Adoption is
        clinic-wide (not role-sliced).
      </p>
    </section>
  );
}
