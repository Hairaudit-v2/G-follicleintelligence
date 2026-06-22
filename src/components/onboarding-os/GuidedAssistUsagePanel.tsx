"use client";

import { useEffect, useState } from "react";

import { loadGuidedAssistUsageSummaryAction } from "@/lib/actions/fi-onboarding-os-guided-assist-actions";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { getGuidedAssistTipByCode } from "@/src/lib/onboarding-os/guidedAssistCatalog";
import type { GuidedAssistUsageSummary } from "@/src/lib/onboarding-os/guidedAssistTypes";
import { GUIDED_ASSIST_AREA_LABELS } from "@/src/lib/onboarding-os/guidedAssistTypes";

function tipLabel(code: string): string {
  return getGuidedAssistTipByCode(code)?.title ?? code;
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function GuidedAssistUsagePanel({ tenantId, windowDays = 30 }: { tenantId: string; windowDays?: number }) {
  const [summary, setSummary] = useState<GuidedAssistUsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadGuidedAssistUsageSummaryAction(tenantId, windowDays).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSummary(res.summary);
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId, windowDays]);

  if (error) {
    return <p className="text-sm text-slate-400">{error}</p>;
  }

  if (!summary) {
    return <p className="text-sm text-slate-400">Loading guided assist usage…</p>;
  }

  const hasActivity = summary.totalEvents > 0;

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0F1629]/75 p-4 shadow-lg shadow-black/25 backdrop-blur-md sm:p-5">
      <p className={fiOsChromeClasses.sectionEyebrow}>OnboardingOS · Phase D</p>
      <h3 className="mt-1 text-base font-semibold tracking-tight text-[#F8FAFC]">
        Guided Assist usage ({summary.windowDays} days)
      </h3>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
        See where team members rely on operational tips, which guidance they dismiss, and which FI OS modules may need
        clearer onboarding paths. All metrics are deterministic — no clinical advice is generated or tracked.
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Metric label="Active users" value={summary.uniqueUsers} />
        <Metric label="Tips shown" value={summary.tipsShown} />
        <Metric label="Dismissed" value={summary.tipsDismissed} />
        <Metric label="Snoozed" value={summary.tipsSnoozed} />
        <Metric label="Next actions" value={summary.nextActionsClicked} />
        <Metric label="Assist enabled" value={summary.assistEnabledUsers} />
        <Metric label="Assist disabled" value={summary.assistDisabledUsers} />
        <Metric label="Total events" value={summary.totalEvents} />
      </dl>

      {!hasActivity ? (
        <p className="mt-4 text-sm text-[#94A3B8]">
          No guided assist activity in this window yet. Metrics appear after users view tips in the tenant workspace.
        </p>
      ) : null}

      {summary.reliantUsers.length > 0 ? (
        <InsightBlock title="Users relying on help most">
          <ul className="space-y-2 text-sm text-[#CBD5E1]">
            {summary.reliantUsers.map((row) => (
              <li key={row.fiUserId} className="flex items-center justify-between gap-3">
                <span className="truncate">{row.email ?? `User ${row.fiUserId.slice(0, 8)}…`}</span>
                <span className="shrink-0 text-xs text-[#64748B]">{row.tipsShown} tips viewed</span>
              </li>
            ))}
          </ul>
        </InsightBlock>
      ) : null}

      {summary.topReliedTips.length > 0 ? (
        <InsightBlock title="Most viewed guidance">
          <ul className="space-y-2 text-sm text-[#CBD5E1]">
            {summary.topReliedTips.map((row) => (
              <li key={row.guidanceCode} className="flex items-start justify-between gap-3">
                <span>{tipLabel(row.guidanceCode)}</span>
                <span className="shrink-0 text-xs text-[#64748B]">
                  {row.shownCount} shown
                  {row.dismissedCount > 0 ? ` · ${row.dismissedCount} dismissed` : ""}
                </span>
              </li>
            ))}
          </ul>
        </InsightBlock>
      ) : null}

      {summary.topDismissedTips.length > 0 ? (
        <InsightBlock title="Frequently dismissed tips">
          <ul className="space-y-2 text-sm text-[#CBD5E1]">
            {summary.topDismissedTips.map((row) => (
              <li key={row.guidanceCode} className="flex items-start justify-between gap-3">
                <span>{tipLabel(row.guidanceCode)}</span>
                <span className="shrink-0 text-xs text-amber-300/90">{row.count} dismissed</span>
              </li>
            ))}
          </ul>
        </InsightBlock>
      ) : null}

      {summary.modulesNeedingGuidanceReview.length > 0 ? (
        <InsightBlock title="Modules needing onboarding review">
          <p className="mb-2 text-xs text-[#94A3B8]">
            High dismiss rates with repeated tip views suggest the module workflow may need clearer in-app guidance or
            training.
          </p>
          <ul className="space-y-2">
            {summary.areaInsights
              .filter((row) => row.needsGuidanceReview)
              .map((row) => (
                <li
                  key={row.guidanceArea}
                  className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-amber-100">{GUIDED_ASSIST_AREA_LABELS[row.guidanceArea]}</span>
                  <span className="shrink-0 text-xs text-amber-200/90">
                    {formatPercent(row.dismissRate)} dismiss · {row.tipsShown} shown
                  </span>
                </li>
              ))}
          </ul>
        </InsightBlock>
      ) : summary.areaInsights.length > 0 ? (
        <InsightBlock title="Module activity">
          <ul className="space-y-2 text-sm text-[#CBD5E1]">
            {summary.areaInsights.slice(0, 7).map((row) => (
              <li key={row.guidanceArea} className="flex items-center justify-between gap-3">
                <span>{GUIDED_ASSIST_AREA_LABELS[row.guidanceArea]}</span>
                <span className="shrink-0 text-xs text-[#64748B]">
                  {row.tipsShown} shown · {row.tipsDismissed} dismissed
                </span>
              </li>
            ))}
          </ul>
        </InsightBlock>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-[#64748B]">{label}</dt>
      <dd className="font-medium text-[#F8FAFC]">{value}</dd>
    </div>
  );
}

function InsightBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 border-t border-white/[0.06] pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
