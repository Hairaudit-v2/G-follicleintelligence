"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { StatCard } from "@/src/components/fi-admin/dashboard-ui";
import {
  refreshGoogleInboundCalendarScopesAction,
  runGoogleCalendarInboundSyncNowAction,
  toggleGoogleInboundSyncCalendarAction,
} from "@/src/lib/actions/fi-google-calendar-inbound-scope-actions";
import type {
  GoogleCalendarInboundScopePageModel,
  GoogleCalendarInboundSyncNowSummary,
} from "@/src/lib/googleCalendar/googleCalendarInboundScopeCore";

function formatIso(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleString();
}

function formatSyncStatus(status: string): string {
  if (status === "success") return "Success";
  if (status === "failed") return "Failed";
  if (status === "never_synced") return "Not synced yet";
  return status;
}

function SyncNowSummaryPanel({ summary }: { summary: GoogleCalendarInboundSyncNowSummary }) {
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-white/[0.06] bg-[#060d18]/60 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Sync summary</p>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Calendars scanned", value: summary.calendarsScanned },
          { label: "Fetched", value: summary.fetched },
          { label: "Inserted", value: summary.inserted },
          { label: "Updated", value: summary.updated },
          { label: "Skipped", value: summary.skipped },
          { label: "Failed", value: summary.failed },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-white/[0.04] px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wide text-[#64748B]">{item.label}</div>
            <div className="text-lg font-semibold tabular-nums text-[#F8FAFC]">{item.value}</div>
          </div>
        ))}
      </div>

      {summary.perCalendar.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] uppercase tracking-wide text-[#64748B]">
                <th className="px-2 py-1.5 font-medium">Calendar</th>
                <th className="px-2 py-1.5 font-medium">Fetched</th>
                <th className="px-2 py-1.5 font-medium">Inserted</th>
                <th className="px-2 py-1.5 font-medium">Updated</th>
                <th className="px-2 py-1.5 font-medium">Skipped</th>
                <th className="px-2 py-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.perCalendar.map((row) => (
                <tr key={row.calendarId} className="border-b border-white/[0.04] text-[#CBD5E1]">
                  <td className="px-2 py-1.5">
                    <div>{row.calendarSummary ?? row.calendarId}</div>
                    <div className="font-mono text-[10px] text-[#64748B]">{row.calendarId}</div>
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{row.fetched}</td>
                  <td className="px-2 py-1.5 tabular-nums">{row.inserted}</td>
                  <td className="px-2 py-1.5 tabular-nums">{row.updated}</td>
                  <td className="px-2 py-1.5 tabular-nums">{row.skipped}</td>
                  <td className="px-2 py-1.5">
                    {row.failed ? (
                      <span className="text-amber-300" title={row.error ?? undefined}>
                        Failed
                      </span>
                    ) : (
                      <span className="text-emerald-300">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export function GoogleCalendarInboundScopeCard({
  tenantId,
  pageModel,
}: {
  tenantId: string;
  pageModel: GoogleCalendarInboundScopePageModel;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<GoogleCalendarInboundSyncNowSummary | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const runAction = useCallback(
    (fn: () => Promise<{ ok: boolean; error?: string; message?: string; summary?: GoogleCalendarInboundSyncNowSummary }>) => {
      setError(null);
      setActionMessage(null);
      startTransition(async () => {
        const result = await fn();
        if (!result.ok) {
          setError(result.error ?? "Action failed.");
          if (result.summary) setSyncSummary(result.summary);
          return;
        }
        setActionMessage(result.message ?? "Done.");
        if (result.summary) setSyncSummary(result.summary);
        router.refresh();
      });
    },
    [router]
  );

  const handleToggle = useCallback(
    (calendarRowId: string, isEnabled: boolean) => {
      if (!pageModel.canManage) return;
      setError(null);
      setTogglingId(calendarRowId);
      startTransition(async () => {
        const result = await toggleGoogleInboundSyncCalendarAction(tenantId, {
          calendarRowId,
          isEnabled,
        });
        setTogglingId(null);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setActionMessage(
          isEnabled
            ? "Calendar enabled for inbound sync."
            : "Calendar disabled for inbound sync."
        );
        router.refresh();
      });
    },
    [pageModel.canManage, router, tenantId]
  );

  const { stats } = pageModel;

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/80 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#F8FAFC]">Inbound calendar sync scope</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
            Choose which Google calendars are scanned during inbound sync. Outbound appointment
            creation still uses the configured default calendar
            {pageModel.outboundCalendarId ? (
              <>
                {" "}
                (<code className="text-[#22C1FF]">{pageModel.outboundCalendarId}</code>)
              </>
            ) : null}
            .
          </p>
        </div>
      </div>

      {!pageModel.connected ? (
        <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Connect Google Calendar above to discover calendars and manage inbound sync scope.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Discovered" value={stats.calendarsDiscovered} />
            <StatCard label="Enabled" value={stats.calendarsEnabled} />
            <StatCard label="Last sync" value={formatIso(stats.lastSyncAt)} />
            <StatCard
              label="Last sync result"
              value={
                stats.lastSyncResult
                  ? formatSyncStatus(stats.lastSyncResult.status)
                  : "—"
              }
              className={
                stats.lastSyncResult
                  ? stats.lastSyncResult.status === "success"
                    ? "[&_.text-2xl]:text-emerald-300"
                    : stats.lastSyncResult.status === "failed"
                      ? "[&_.text-2xl]:text-amber-300"
                      : undefined
                  : undefined
              }
            />
          </div>

          <div className="mt-3 divide-y divide-white/[0.06] rounded-lg border border-white/[0.06] bg-[#060d18]/60 px-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <span className="text-sm text-[#94A3B8]">Connected account</span>
              <span className="text-sm font-medium text-[#E2E8F0]">
                {pageModel.googleAccountEmail ?? "—"}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <span className="text-sm text-[#94A3B8]">Outbound / default calendar</span>
              <span className="font-mono text-xs text-[#E2E8F0]">
                {pageModel.outboundCalendarId ?? "—"}
              </span>
            </div>
          </div>

          {pageModel.canManage ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  runAction(async () => refreshGoogleInboundCalendarScopesAction(tenantId))
                }
                className="inline-flex items-center rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-[#E2E8F0] hover:border-white/20 disabled:opacity-50"
              >
                {pending ? "Working…" : "Refresh calendars"}
              </button>
              <button
                type="button"
                disabled={pending || stats.calendarsEnabled === 0}
                onClick={() =>
                  runAction(async () => runGoogleCalendarInboundSyncNowAction(tenantId))
                }
                className="inline-flex items-center rounded-lg border border-[#22C1FF]/40 bg-[#22C1FF]/10 px-4 py-2 text-sm font-medium text-[#22C1FF] hover:bg-[#22C1FF]/20 disabled:opacity-50"
              >
                {pending ? "Syncing…" : "Run sync now"}
              </button>
              {stats.calendarsEnabled === 0 ? (
                <span className="text-xs text-amber-300">
                  Enable at least one calendar before running sync.
                </span>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-xs text-[#64748B]">
              Tenant admin access is required to change inbound sync scope or trigger sync.
            </p>
          )}

          {error ? (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}
          {actionMessage ? (
            <p className="mt-3 text-sm text-[#94A3B8]">{actionMessage}</p>
          ) : null}
          {syncSummary ? <SyncNowSummaryPanel summary={syncSummary} /> : null}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wide text-[#64748B]">
                  <th className="px-2 py-2 font-medium">Name</th>
                  <th className="px-2 py-2 font-medium">Google calendar ID</th>
                  <th className="px-2 py-2 font-medium">Inbound sync</th>
                  <th className="px-2 py-2 font-medium">Primary</th>
                  <th className="px-2 py-2 font-medium">Access role</th>
                  <th className="px-2 py-2 font-medium">Time zone</th>
                  <th className="px-2 py-2 font-medium">Last synced</th>
                  <th className="px-2 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {pageModel.calendars.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-2 py-6 text-center text-[#64748B]">
                      No calendars discovered yet. Connect or reconnect Google Calendar, then use
                      Refresh calendars to pull your calendarList.
                    </td>
                  </tr>
                ) : (
                  pageModel.calendars.map((cal) => (
                    <tr key={cal.id} className="border-b border-white/[0.04] text-[#CBD5E1]">
                      <td className="px-2 py-2">{cal.summary ?? "—"}</td>
                      <td className="px-2 py-2 font-mono text-xs">{cal.googleCalendarId}</td>
                      <td className="px-2 py-2">
                        {pageModel.canManage ? (
                          <label className="inline-flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={cal.isEnabled}
                              disabled={pending || togglingId === cal.id}
                              onChange={(e) => handleToggle(cal.id, e.target.checked)}
                              className="rounded border-white/20"
                            />
                            <span className="text-xs">{cal.isEnabled ? "Enabled" : "Disabled"}</span>
                          </label>
                        ) : (
                          <span
                            className={
                              cal.isEnabled
                                ? "text-emerald-300"
                                : "text-slate-400"
                            }
                          >
                            {cal.isEnabled ? "Enabled" : "Disabled"}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2">{cal.isPrimary ? "Yes" : "—"}</td>
                      <td className="px-2 py-2">{cal.accessRole ?? "—"}</td>
                      <td className="px-2 py-2">{cal.timeZone ?? "—"}</td>
                      <td className="px-2 py-2 text-xs text-[#94A3B8]">
                        {formatIso(cal.lastSyncedAt)}
                      </td>
                      <td className="px-2 py-2 text-xs text-[#94A3B8]">
                        {formatIso(cal.updatedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {stats.lastSyncResult?.errorSummary ? (
            <p className="mt-3 text-xs text-amber-300">
              Last sync error: {stats.lastSyncResult.errorSummary}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
