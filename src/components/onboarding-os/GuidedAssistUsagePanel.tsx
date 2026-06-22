"use client";

import { useEffect, useState } from "react";

import { loadGuidedAssistUsageSummaryAction } from "@/lib/actions/fi-onboarding-os-guided-assist-actions";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import type { GuidedAssistUsageSummary } from "@/src/lib/onboarding-os/guidedAssistTypes";

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

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className={fiOsChromeClasses.sectionEyebrow}>OnboardingOS · Phase D</p>
      <h3 className="mt-1 text-sm font-medium text-slate-100">Guided Assist usage ({summary.windowDays} days)</h3>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">Events</dt>
          <dd className="font-medium text-slate-100">{summary.totalEvents}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Active users</dt>
          <dd className="font-medium text-slate-100">{summary.uniqueUsers}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Tips shown</dt>
          <dd className="font-medium text-slate-100">{summary.tipsShown}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Next actions</dt>
          <dd className="font-medium text-slate-100">{summary.nextActionsClicked}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Dismissed</dt>
          <dd className="font-medium text-slate-100">{summary.tipsDismissed}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Snoozed</dt>
          <dd className="font-medium text-slate-100">{summary.tipsSnoozed}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Enabled users</dt>
          <dd className="font-medium text-slate-100">{summary.assistEnabledUsers}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Disabled users</dt>
          <dd className="font-medium text-slate-100">{summary.assistDisabledUsers}</dd>
        </div>
      </dl>
      {summary.topTips.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Most engaged tips</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {summary.topTips.slice(0, 5).map((row) => (
              <li key={row.guidanceCode} className="flex justify-between gap-2">
                <span className="truncate">{row.guidanceCode}</span>
                <span className="shrink-0 text-slate-500">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
