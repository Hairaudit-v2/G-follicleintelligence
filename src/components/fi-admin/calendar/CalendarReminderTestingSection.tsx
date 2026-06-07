"use client";

import { useCallback, useState } from "react";
import { Bell, Mail, MessageSquare, X } from "lucide-react";

import {
  listCalendarReminderJobsForBookingAction,
  previewCalendarBookingReminderJobAction,
  sendTestCalendarBookingReminderEmailAction,
} from "@/lib/actions/fi-calendar-reminder-testing-actions";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiStatusBadge } from "@/src/components/fi-design/FiStatusBadge";
import type { CalendarReminderTestingPayload } from "@/src/lib/calendar/calendarTestingTypes";
import type { ReminderJobStatus } from "@/src/lib/reminders/reminderConstants";

import { cn } from "@/lib/utils";

function jobTone(s: ReminderJobStatus): "success" | "warning" | "danger" | "neutral" {
  if (s === "sent") return "success";
  if (s === "failed") return "danger";
  if (s === "cancelled") return "neutral";
  if (s === "processing") return "warning";
  return "neutral";
}

type BookingJobRow = {
  id: string;
  scheduled_at: string;
  status: string;
  template_name: string;
  template_trigger_event: string;
  template_type: string;
  error_log: string | null;
};

export function CalendarReminderTestingSection({
  tenantId,
  reminders,
}: {
  tenantId: string;
  reminders: CalendarReminderTestingPayload;
}) {
  const tid = tenantId.trim();
  const [bookingId, setBookingId] = useState("");
  const [bookingJobs, setBookingJobs] = useState<BookingJobRow[] | null>(null);
  const [bookingErr, setBookingErr] = useState<string | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);

  const [preview, setPreview] = useState<{
    jobId: string;
    templateName: string;
    triggerEvent: string;
    channel: string;
    subject: string | null;
    body: string;
  } | null>(null);
  const [previewBusy, setPreviewBusy] = useState<string | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);

  const [sendBusy, setSendBusy] = useState<string | null>(null);
  const [sendMsg, setSendMsg] = useState<string | null>(null);
  const [sendErr, setSendErr] = useState<string | null>(null);

  const onLoadBookingJobs = useCallback(async () => {
    setBookingBusy(true);
    setBookingErr(null);
    setBookingJobs(null);
    try {
      const r = await listCalendarReminderJobsForBookingAction(tid, { bookingId: bookingId.trim() });
      if (!r.ok) {
        setBookingErr(r.error);
        return;
      }
      setBookingJobs(r.jobs);
    } catch (e) {
      setBookingErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBookingBusy(false);
    }
  }, [tid, bookingId]);

  const openPreview = async (jobId: string) => {
    setPreviewBusy(jobId);
    setPreviewErr(null);
    setPreview(null);
    try {
      const r = await previewCalendarBookingReminderJobAction(tid, { jobId });
      if (!r.ok) {
        setPreviewErr(r.error);
        return;
      }
      setPreview(r.preview);
    } catch (e) {
      setPreviewErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewBusy(null);
    }
  };

  const onSendTest = async (jobId: string) => {
    setSendBusy(jobId);
    setSendErr(null);
    setSendMsg(null);
    try {
      const r = await sendTestCalendarBookingReminderEmailAction(tid, { jobId });
      if (!r.ok) {
        setSendErr(r.error);
        return;
      }
      setSendMsg(r.message);
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSendBusy(null);
    }
  };

  const statKeys: ReminderJobStatus[] = ["pending", "processing", "sent", "failed", "cancelled"];

  return (
    <div className="space-y-6">
      <FiCard>
        <div className="flex flex-wrap items-start gap-2 border-b border-slate-200/90 pb-3">
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900">Appointment reminders (UAT)</h2>
            <p className="mt-1 text-sm text-slate-600">
              Inspect templates and jobs, preview merged copy, and optionally send a <strong>test email</strong> to{" "}
              <code className="rounded bg-slate-100 px-1 font-mono text-xs">FI_REMINDER_TEST_EMAIL</code> when{" "}
              <code className="rounded bg-slate-100 px-1 font-mono text-xs">FI_REMINDERS_TEST_SEND=true</code>. Patient
              addresses are never used from this panel.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div
            className={cn(
              "rounded-lg border p-3 text-sm",
              reminders.liveDeliveryEnabled ? "border-amber-200 bg-amber-50/50 text-amber-950" : "border-emerald-200 bg-emerald-50/40 text-emerald-950"
            )}
          >
            <p className="font-semibold">{reminders.liveDeliveryEnabled ? "Live delivery ON" : "Live delivery OFF"}</p>
            <p className="mt-1 leading-relaxed opacity-90">{reminders.liveDeliveryHelp}</p>
          </div>
          <div
            className={cn(
              "rounded-lg border p-3 text-sm",
              reminders.testSendConfigured ? "border-sky-200 bg-sky-50/40 text-sky-950" : "border-slate-200 bg-slate-50/80 text-slate-800"
            )}
          >
            <p className="font-semibold">Test email override</p>
            <p className="mt-1 leading-relaxed opacity-90">{reminders.testSendHelp}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700">
            <Mail className="h-3.5 w-3.5" aria-hidden />
            Email keys {reminders.emailChannelConfigured ? "configured" : "missing"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            SMS keys {reminders.smsChannelConfigured ? "configured" : "missing"}
          </span>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">{reminders.bookingEnqueueSummary}</p>
      </FiCard>

      <FiCard>
        <h3 className="text-sm font-semibold text-slate-900">Template readiness</h3>
        <p className="mt-1 text-xs text-slate-500">Active templates in this tenant vs common UAT scenarios.</p>
        <ul className="mt-3 divide-y divide-slate-100">
          {reminders.templateChecklist.map((row) => (
            <li key={row.id} className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{row.label}</span>
                  <FiStatusBadge tone={row.satisfied ? "success" : "warning"} appearance="pill" density="compact">
                    {row.satisfied ? "Ready" : "Gap"}
                  </FiStatusBadge>
                </div>
                <p className="mt-1 text-sm text-slate-600">{row.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </FiCard>

      <FiCard>
        <h3 className="text-sm font-semibold text-slate-900">Reminder jobs (last 30 days, tenant-wide)</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {statKeys.map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs font-medium text-slate-800"
            >
              <FiStatusBadge tone={jobTone(k)} appearance="pill" density="compact">
                {k}
              </FiStatusBadge>
              <span className="tabular-nums">{reminders.jobStats[k]}</span>
            </span>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Failed (recent)</h4>
            {reminders.recentFailedJobs.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No failed jobs in range.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {reminders.recentFailedJobs.map((j) => (
                  <li key={j.id} className="rounded border border-slate-100 bg-white p-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">{j.template_name}</span>
                      <span className="text-slate-500">{j.scheduled_at}</span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-rose-700">{j.error_log || "—"}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={previewBusy === j.id}
                        onClick={() => void openPreview(j.id)}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {previewBusy === j.id ? "…" : "Preview"}
                      </button>
                      <button
                        type="button"
                        disabled={sendBusy === j.id}
                        onClick={() => void onSendTest(j.id)}
                        className="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-900 hover:bg-sky-100 disabled:opacity-50"
                      >
                        {sendBusy === j.id ? "…" : "Test email"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Upcoming (pending)</h4>
            {reminders.upcomingJobs.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No upcoming pending jobs (or none scheduled ahead).</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {reminders.upcomingJobs.map((j) => (
                  <li key={j.id} className="rounded border border-slate-100 bg-white p-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">{j.template_name}</span>
                      <span className="text-slate-500">{j.scheduled_at}</span>
                    </div>
                    <p className="mt-0.5 text-slate-600">
                      {j.trigger_event}
                      {j.booking_id ? (
                        <>
                          {" "}
                          · booking <code className="font-mono text-[10px]">{j.booking_id.slice(0, 8)}…</code>
                        </>
                      ) : null}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={previewBusy === j.id}
                        onClick={() => void openPreview(j.id)}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {previewBusy === j.id ? "…" : "Preview"}
                      </button>
                      <button
                        type="button"
                        disabled={sendBusy === j.id}
                        onClick={() => void onSendTest(j.id)}
                        className="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-900 hover:bg-sky-100 disabled:opacity-50"
                      >
                        {sendBusy === j.id ? "…" : "Test email"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </FiCard>

      <FiCard>
        <h3 className="text-sm font-semibold text-slate-900">Booking reminder jobs</h3>
        <p className="mt-1 text-sm text-slate-600">Paste a booking UUID to list all reminder jobs anchored to it.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1 text-xs font-medium text-slate-700">
            Booking ID
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 font-mono text-xs"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              spellCheck={false}
            />
          </label>
          <button
            type="button"
            disabled={bookingBusy || !bookingId.trim()}
            onClick={() => void onLoadBookingJobs()}
            className={cn(
              "shrink-0 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2",
              bookingBusy || !bookingId.trim()
                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                : "bg-slate-800 text-white hover:bg-slate-900"
            )}
          >
            {bookingBusy ? "Loading…" : "Load jobs"}
          </button>
        </div>
        {bookingErr ? <p className="mt-2 text-sm text-rose-700">{bookingErr}</p> : null}
        {bookingJobs && bookingJobs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No reminder jobs for this booking id.</p>
        ) : null}
        {bookingJobs && bookingJobs.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100 rounded border border-slate-100">
            {bookingJobs.map((j) => (
              <li key={j.id} className="flex flex-col gap-2 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{j.template_name}</p>
                  <p className="text-slate-600">
                    {j.scheduled_at} · {j.status} · {j.template_type} · {j.template_trigger_event}
                  </p>
                  {j.error_log ? <p className="mt-1 font-mono text-[11px] text-rose-700">{j.error_log}</p> : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={previewBusy === j.id}
                    onClick={() => void openPreview(j.id)}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {previewBusy === j.id ? "…" : "Preview"}
                  </button>
                  <button
                    type="button"
                    disabled={sendBusy === j.id || j.template_type !== "email"}
                    title={j.template_type !== "email" ? "Test send supports email jobs only" : undefined}
                    onClick={() => void onSendTest(j.id)}
                    className="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-900 hover:bg-sky-100 disabled:opacity-50"
                  >
                    {sendBusy === j.id ? "…" : "Test email"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </FiCard>

      {previewErr ? <p className="text-sm text-rose-700">{previewErr}</p> : null}
      {sendErr ? <p className="text-sm text-rose-700">{sendErr}</p> : null}
      {sendMsg ? <p className="text-sm text-emerald-800">{sendMsg}</p> : null}

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog">
          <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Preview · {preview.templateName}</p>
                <p className="text-xs text-slate-500">
                  {preview.triggerEvent} · {preview.channel}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close preview"
                onClick={() => setPreview(null)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto p-4 text-sm">
              {preview.subject ? (
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Subject</p>
                  <p className="mt-1 text-slate-900">{preview.subject}</p>
                </div>
              ) : null}
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Body</p>
                <pre className="mt-1 max-h-[45vh] overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs text-slate-800">
                  {preview.body}
                </pre>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  disabled={Boolean(sendBusy)}
                  onClick={() => void onSendTest(preview.jobId)}
                  className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {sendBusy === preview.jobId ? "Sending…" : "Send test email"}
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
