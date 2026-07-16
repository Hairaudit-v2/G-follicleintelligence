"use client";

import { useEffect, useState } from "react";

import { loadGuidedAssistHealthSnapshotAction } from "@/lib/actions/fi-onboarding-os-guided-assist-actions";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import type { GuidedAssistHealthSnapshot } from "@/src/lib/onboarding-os/guidedAssistTypes";

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{value}</dd>
      {hint ? <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}

function RankList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: readonly { key: string; label: string; meta: string }[];
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <h4 className="text-xs font-semibold text-slate-200">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">{empty}</p>
      ) : (
        <ol className="mt-2 space-y-1.5">
          {items.map((item, i) => (
            <li
              key={item.key}
              className="flex items-start justify-between gap-2 text-xs text-slate-300"
            >
              <span className="min-w-0">
                <span className="mr-1.5 tabular-nums text-slate-500">{i + 1}.</span>
                <span className="font-medium text-slate-200">{item.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-500">{item.meta}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * Admin-only Clinic guide health: adoption, feedback, popular tips & pain points.
 * Tenant-scoped; operational UX metrics only.
 */
export function GuidedAssistHealthPanel({
  tenantId,
  windowDays = 30,
}: {
  tenantId: string;
  windowDays?: number;
}) {
  const [health, setHealth] = useState<GuidedAssistHealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadGuidedAssistHealthSnapshotAction(tenantId, windowDays).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setHealth(res.health);
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId, windowDays]);

  if (error) {
    return (
      <p className="text-sm text-slate-400" role="alert">
        {error}
      </p>
    );
  }

  if (!health) {
    return (
      <div
        className="space-y-3"
        aria-busy="true"
        aria-label="Loading Guide Health"
        data-testid="guided-assist-health-skeleton"
      >
        <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.06]" />
          ))}
        </div>
        <div className="h-24 animate-pulse rounded-xl bg-white/[0.06]" />
      </div>
    );
  }

  return (
    <section
      className="space-y-4"
      data-testid="guided-assist-health-panel"
      aria-label="Clinic guide health"
    >
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>Clinic guide · Health</p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-[#F8FAFC]">
          Guide Health ({health.windowDays} days)
        </h3>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#94A3B8]">
          A calm snapshot of how the team uses operational tips — never clinical content. Helps you
          see adoption, what lands well, and where a tip may need a warmer rewrite.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          label="Adoption"
          value={formatPercent(health.adoptionRate)}
          hint={`${health.usersWithGuideOn} of ${health.usersWithPreferenceRow} with guide on`}
        />
        <Metric
          label="Thumbs up"
          value={formatPercent(health.thumbsUpRate)}
          hint={`${health.thumbsUp} up · ${health.thumbsDown} down`}
        />
        <Metric label="Tips shown" value={health.tipsShown} />
        <Metric
          label="Quick actions"
          value={health.quickActionsClicked}
          hint={`${health.toursCompleted} tours completed`}
        />
      </dl>

      <div className="grid gap-3 sm:grid-cols-2">
        <RankList
          title="Most used tips"
          empty="No tip views in this window yet."
          items={health.topTips.map((t) => ({
            key: t.code,
            label: t.title,
            meta: `${t.count}×`,
          }))}
        />
        <RankList
          title="Most used quick actions"
          empty="No quick actions clicked yet."
          items={health.topQuickActions.map((t) => ({
            key: t.code,
            label: t.title,
            meta: `${t.count}×`,
          }))}
        />
      </div>

      <RankList
        title="Top pain points (thumbs down)"
        empty="No unhelpful votes yet — that’s a good sign."
        items={health.painPoints.map((t) => ({
          key: t.code,
          label: t.title,
          meta: `${t.thumbsDown} down · ${t.thumbsUp} up`,
        }))}
      />
    </section>
  );
}
