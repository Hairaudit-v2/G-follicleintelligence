"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { StatCard } from "@/src/components/fi-admin/dashboard-ui";
import {
  pauseGoogleCalendarScheduledSyncAction,
  resumeGoogleCalendarScheduledSyncAction,
  setGoogleCalendarScheduledSyncEnabledAction,
  setGoogleCalendarSyncFrequencyAction,
  enableGoogleCalendarRealtimeSyncAction,
  renewGoogleCalendarRealtimeSyncAction,
} from "@/src/lib/actions/fi-google-calendar-monitoring-actions";
import {
  formatDurationMs,
  formatHealthStatusLabel,
  formatRelativeTime,
  formatRunStatusLabel,
  formatWebhookSyncModeLabel,
  webhookSyncModeBadgeClass,
  type GoogleCalendarMonitoringPageModel,
} from "@/src/lib/googleCalendar/googleCalendarMonitoringCore";
import { formatSyncFrequencyLabel } from "@/src/lib/googleCalendar/googleCalendarSyncHealthCore";

function healthBadgeClass(status: string): string {
  if (status === "healthy") return "bg-emerald-500/15 text-emerald-300";
  if (status === "paused") return "bg-slate-500/15 text-slate-300";
  if (status === "degraded" || status === "warning") return "bg-amber-500/15 text-amber-300";
  return "bg-red-500/15 text-red-300";
}

function runStatusClass(status: string): string {
  if (status === "success") return "text-emerald-300";
  if (status === "partial") return "text-amber-300";
  if (status === "failed") return "text-red-300";
  return "text-slate-400";
}

export function GoogleCalendarMonitoringCard({
  tenantId,
  pageModel,
}: {
  tenantId: string;
  pageModel: GoogleCalendarMonitoringPageModel;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const runAction = useCallback(
    (action: () => Promise<{ ok: boolean; error?: string }>, successMessage: string) => {
      setMessage(null);
      setError(null);
      startTransition(async () => {
        const result = await action();
        if (!result.ok) {
          setError(result.error ?? "Action failed.");
          return;
        }
        setMessage(successMessage);
        refresh();
      });
    },
    [refresh]
  );

  if (!pageModel.connected) {
    return (
      <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/40 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-[#F8FAFC]">Google Calendar Monitoring</h2>
        <p className="mt-2 text-sm text-[#94A3B8]">Connect Google Calendar to view sync health and history.</p>
      </section>
    );
  }

  const schedulerActive =
    pageModel.scheduledSyncEnabled && !pageModel.schedulerPaused && pageModel.syncEnabled;

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#F8FAFC]">Google Calendar Monitoring</h2>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Automated background sync health, real-time webhooks, history, and scheduler controls.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${webhookSyncModeBadgeClass(pageModel.webhook.syncMode)}`}
          >
            {formatWebhookSyncModeLabel(pageModel.webhook.syncMode)}
          </span>
          {pageModel.openAlertCount > 0 ? (
          <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
            {pageModel.openAlertCount} open alert{pageModel.openAlertCount === 1 ? "" : "s"}
          </span>
          ) : null}
        </div>
      </div>

      {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-white/[0.06] bg-[#060d18]/60 p-3">
          <div className="text-xs uppercase tracking-wide text-[#64748B]">Health</div>
          <div className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-sm font-medium ${healthBadgeClass(pageModel.healthStatus)}`}>
            {formatHealthStatusLabel(pageModel.healthStatus)}
          </div>
          <div className="mt-2 text-xs text-[#94A3B8]">Score {pageModel.healthScore}/100</div>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-[#060d18]/60 p-3">
          <div className="text-xs uppercase tracking-wide text-[#64748B]">Last successful sync</div>
          <div className="mt-1 text-sm text-[#F8FAFC]">{formatRelativeTime(pageModel.lastSuccessfulSyncAt)}</div>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-[#060d18]/60 p-3">
          <div className="text-xs uppercase tracking-wide text-[#64748B]">Scheduler</div>
          <div className="mt-1 text-sm text-[#F8FAFC]">{schedulerActive ? "Active" : "Inactive"}</div>
          <div className="mt-1 text-xs text-[#94A3B8]">
            {pageModel.schedulerPaused ? pageModel.schedulerPausedReason ?? "Paused" : "Running on schedule"}
          </div>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-[#060d18]/60 p-3">
          <div className="text-xs uppercase tracking-wide text-[#64748B]">Frequency</div>
          <div className="mt-1 text-sm text-[#F8FAFC]">{formatSyncFrequencyLabel(pageModel.syncFrequencyMinutes)}</div>
          <div className="mt-1 text-xs text-[#94A3B8]">Success rate {pageModel.successRatePercent}%</div>
          <div className="mt-1 text-xs text-[#94A3B8]">Consecutive failures {pageModel.consecutiveFailures}</div>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-[#060d18]/60 p-3">
          <div className="text-xs uppercase tracking-wide text-[#64748B]">Real-time webhook</div>
          <div className="mt-1 text-sm text-[#F8FAFC] capitalize">
            {pageModel.webhook.subscriptionStatus === "none"
              ? "Not subscribed"
              : pageModel.webhook.subscriptionStatus}
          </div>
          <div className="mt-1 text-xs text-[#94A3B8]">
            Last notification {formatRelativeTime(pageModel.webhook.lastNotificationAt)}
          </div>
          <div className="mt-1 text-xs text-[#94A3B8]">
            Expires {formatRelativeTime(pageModel.webhook.expirationAt)}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total sync runs" value={String(pageModel.metrics.totalSyncRuns)} />
        <StatCard label="Events processed" value={String(pageModel.metrics.totalEventsProcessed)} />
        <StatCard label="Review items created" value={String(pageModel.metrics.totalReviewItemsCreated)} />
        <StatCard label="Failed syncs" value={String(pageModel.metrics.failedSyncs)} />
        <StatCard
          label="Average sync time"
          value={formatDurationMs(pageModel.metrics.averageSyncDurationMs)}
        />
      </div>

      {pageModel.canManage ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              runAction(
                () =>
                  setGoogleCalendarScheduledSyncEnabledAction(tenantId, {
                    enabled: !pageModel.scheduledSyncEnabled,
                  }),
                pageModel.scheduledSyncEnabled ? "Scheduled sync disabled." : "Scheduled sync enabled."
              )
            }
            className="rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs font-medium text-[#CBD5E1] hover:bg-white/[0.04] disabled:opacity-50"
          >
            {pageModel.scheduledSyncEnabled ? "Disable scheduler" : "Enable scheduler"}
          </button>
          {pageModel.schedulerPaused ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runAction(() => resumeGoogleCalendarScheduledSyncAction(tenantId), "Scheduled sync resumed.")
              }
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              Resume sync
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runAction(() => pauseGoogleCalendarScheduledSyncAction(tenantId), "Scheduled sync paused.")
              }
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
            >
              Pause sync
            </button>
          )}
          {[5, 15, 30, 60].map((minutes) => (
            <button
              key={minutes}
              type="button"
              disabled={pending || pageModel.syncFrequencyMinutes === minutes}
              onClick={() =>
                runAction(
                  () =>
                    setGoogleCalendarSyncFrequencyAction(tenantId, {
                      frequencyMinutes: minutes as 5 | 15 | 30 | 60,
                    }),
                  `Sync frequency set to ${formatSyncFrequencyLabel(minutes as 5 | 15 | 30 | 60).toLowerCase()}.`
                )
              }
              className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-[#94A3B8] hover:bg-white/[0.04] disabled:opacity-50 data-[active=true]:border-[#22C1FF]/40 data-[active=true]:text-[#22C1FF]"
              data-active={pageModel.syncFrequencyMinutes === minutes}
            >
              {formatSyncFrequencyLabel(minutes as 5 | 15 | 30 | 60)}
            </button>
          ))}
          {pageModel.webhook.syncMode !== "realtime_active" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runAction(
                  () => enableGoogleCalendarRealtimeSyncAction(tenantId),
                  "Real-time sync enabled."
                )
              }
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              Enable real-time sync
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runAction(
                  () => renewGoogleCalendarRealtimeSyncAction(tenantId),
                  "Webhook subscription renewed."
                )
              }
              className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/20 disabled:opacity-50"
            >
              Renew subscription
            </button>
          )}
        </div>
      ) : null}

      <div className="mt-5 overflow-x-auto">
        <h3 className="mb-2 text-sm font-medium text-[#CBD5E1]">Recent sync history</h3>
        {pageModel.recentRuns.length === 0 ? (
          <p className="text-sm text-[#64748B]">No sync runs recorded yet.</p>
        ) : (
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] uppercase tracking-wide text-[#64748B]">
                <th className="px-2 py-1.5 font-medium">Timestamp</th>
                <th className="px-2 py-1.5 font-medium">Duration</th>
                <th className="px-2 py-1.5 font-medium">Calendars</th>
                <th className="px-2 py-1.5 font-medium">Fetched</th>
                <th className="px-2 py-1.5 font-medium">Inserted</th>
                <th className="px-2 py-1.5 font-medium">Updated</th>
                <th className="px-2 py-1.5 font-medium">Skipped</th>
                <th className="px-2 py-1.5 font-medium">Conflicts</th>
                <th className="px-2 py-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {pageModel.recentRuns.map((run) => (
                <tr key={run.id} className="border-b border-white/[0.04] text-[#CBD5E1]">
                  <td className="px-2 py-1.5 whitespace-nowrap">{formatRelativeTime(run.startedAt)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{formatDurationMs(run.durationMs)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{run.calendarsScanned}</td>
                  <td className="px-2 py-1.5 tabular-nums">{run.eventsFetched}</td>
                  <td className="px-2 py-1.5 tabular-nums">{run.eventsInserted}</td>
                  <td className="px-2 py-1.5 tabular-nums">{run.eventsUpdated}</td>
                  <td className="px-2 py-1.5 tabular-nums">{run.eventsSkipped}</td>
                  <td className="px-2 py-1.5 tabular-nums">{run.conflictsDetected}</td>
                  <td className={`px-2 py-1.5 ${runStatusClass(run.status)}`}>
                    {formatRunStatusLabel(run.status)}
                    {run.errorMessage ? (
                      <span className="ml-1 text-[#64748B]" title={run.errorMessage}>
                        ·
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
