"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { StatCard } from "@/src/components/fi-admin/dashboard-ui";
import { runGoogleCalendarBackfillAction } from "@/src/lib/actions/fi-google-calendar-backfill-actions";
import type {
  GoogleCalendarBackfillDryRunSummary,
  GoogleCalendarBackfillWriteSummary,
} from "@/src/lib/integrations/googleCalendar/googleCalendarBackfillCore";
import type { GoogleCalendarBackfillDiagnostics } from "@/src/lib/integrations/googleCalendar/googleCalendarBackfillCore";

function formatIso(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleString();
}

function SummaryGrid({
  summary,
  dryRun,
}: {
  summary: GoogleCalendarBackfillDryRunSummary | GoogleCalendarBackfillWriteSummary;
  dryRun: boolean;
}) {
  const write = summary as GoogleCalendarBackfillWriteSummary;
  const items = dryRun
    ? [
        { label: "Source events", value: summary.sourceEventsFound },
        { label: "Already imported", value: summary.alreadyImported },
        { label: "To create", value: summary.toCreate },
        { label: "To update", value: summary.toUpdate },
        { label: "Cancelled", value: summary.cancelled },
        { label: "Review required", value: summary.ambiguousReviewRequired },
        { label: "Failed", value: summary.failed },
      ]
    : [
        { label: "Calendar created", value: write.createdCalendarEvents },
        { label: "Calendar updated", value: write.updatedCalendarEvents },
        { label: "Bookings created", value: write.createdBookings },
        { label: "Bookings updated", value: write.updatedBookings },
        { label: "Sent to review", value: write.sentToReview },
        { label: "Skipped duplicates", value: write.skippedDuplicates },
        { label: "Failed", value: summary.failed },
      ];

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-white/[0.04] px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-wide text-[#64748B]">{item.label}</div>
          <div className="text-lg font-semibold tabular-nums text-[#F8FAFC]">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function GoogleCalendarBackfillCard({
  tenantId,
  connected,
  canManage,
  calendarSources,
  backfillDiagnostics,
}: {
  tenantId: string;
  connected: boolean;
  canManage: boolean;
  calendarSources: { calendarId: string; summary: string | null; isEnabled: boolean }[];
  backfillDiagnostics: GoogleCalendarBackfillDiagnostics;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(
    backfillDiagnostics.googleCalendarBackfillLastRangeStart ?? ""
  );
  const [endDate, setEndDate] = useState(
    backfillDiagnostics.googleCalendarBackfillLastRangeEnd ?? ""
  );
  const [calendarSourceId, setCalendarSourceId] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [lastSummary, setLastSummary] = useState<
    GoogleCalendarBackfillDryRunSummary | GoogleCalendarBackfillWriteSummary | null
  >(null);
  const [lastWasDryRun, setLastWasDryRun] = useState(true);

  const runBackfill = useCallback(
    (opts?: { preset?: "next_14_days" | "july_2026" }) => {
      setError(null);
      setMessage(null);
      startTransition(async () => {
        const result = await runGoogleCalendarBackfillAction(tenantId, {
          startDate: opts?.preset ? undefined : startDate || undefined,
          endDate: opts?.preset ? undefined : endDate || undefined,
          calendarSourceId: calendarSourceId || undefined,
          dryRun,
          promoteSafeBookings: true,
          preset: opts?.preset ?? "default",
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        const backfill = result.result;
        setMessage(result.message);
        setLastSummary(backfill.summary);
        setLastWasDryRun(backfill.dryRun);
        if (!backfill.dryRun) router.refresh();
      });
    },
    [tenantId, startDate, endDate, calendarSourceId, dryRun, router]
  );

  const enabledSources = calendarSources.filter((c) => c.isEnabled);

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#F8FAFC]">
            Import existing Google Calendar bookings
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-[#94A3B8]">
            Backfill historical Google Calendar events into FI OS CalendarOS. Live webhook sync is
            unchanged — use this for appointments already visible in Google Calendar before FI was
            connected.
          </p>
        </div>
      </div>

      {!connected ? (
        <p className="mt-4 text-sm text-[#94A3B8]">
          Connect Google Calendar above before running a backfill.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Last backfill"
              value={formatIso(backfillDiagnostics.googleCalendarBackfillLastRunAt)}
            />
            <StatCard
              label="Last range"
              value={
                backfillDiagnostics.googleCalendarBackfillLastRangeStart &&
                backfillDiagnostics.googleCalendarBackfillLastRangeEnd
                  ? `${backfillDiagnostics.googleCalendarBackfillLastRangeStart} → ${backfillDiagnostics.googleCalendarBackfillLastRangeEnd}`
                  : "—"
              }
            />
            <StatCard
              label="Imported (last run)"
              value={String(backfillDiagnostics.googleCalendarBackfillImportedCount)}
            />
            <StatCard
              label="Review (last run)"
              value={String(backfillDiagnostics.googleCalendarBackfillReviewCount)}
            />
          </div>

          {backfillDiagnostics.warnings.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-amber-300">
              {backfillDiagnostics.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[#94A3B8]">Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={!canManage || pending}
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#060d18] px-3 py-2 text-[#F8FAFC]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[#94A3B8]">End date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={!canManage || pending}
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#060d18] px-3 py-2 text-[#F8FAFC]"
              />
            </label>
            <label className="block text-sm lg:col-span-2">
              <span className="text-[#94A3B8]">Calendar source</span>
              <select
                value={calendarSourceId}
                onChange={(e) => setCalendarSourceId(e.target.value)}
                disabled={!canManage || pending}
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#060d18] px-3 py-2 text-[#F8FAFC]"
              >
                <option value="">All enabled inbound calendars</option>
                {enabledSources.map((c) => (
                  <option key={c.calendarId} value={c.calendarId}>
                    {c.summary ?? c.calendarId}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-[#CBD5E1]">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={!canManage || pending}
            />
            Dry run (preview only — no writes)
          </label>

          {canManage ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => runBackfill()}
                disabled={pending}
                className="rounded-lg bg-[#22C1FF] px-4 py-2 text-sm font-medium text-[#0a1424] hover:bg-[#4dd0ff] disabled:opacity-50"
              >
                {pending ? "Running…" : dryRun ? "Run dry run" : "Import bookings"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  runBackfill({ preset: "next_14_days" });
                }}
                disabled={pending}
                className="rounded-lg border border-white/[0.12] px-4 py-2 text-sm text-[#CBD5E1] hover:bg-white/[0.04] disabled:opacity-50"
              >
                Next 14 days
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate("2026-07-01");
                  setEndDate("2026-07-31");
                  runBackfill({ preset: "july_2026" });
                }}
                disabled={pending}
                className="rounded-lg border border-white/[0.12] px-4 py-2 text-sm text-[#CBD5E1] hover:bg-white/[0.04] disabled:opacity-50"
              >
                July 2026
              </button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#64748B]">Tenant admin access required to run import.</p>
          )}

          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
          {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}

          {lastSummary ? (
            <div className="mt-4 rounded-lg border border-white/[0.06] bg-[#060d18]/60 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
                {lastWasDryRun ? "Dry run summary" : "Import summary"}
              </p>
              <SummaryGrid summary={lastSummary} dryRun={lastWasDryRun} />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
