"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import {
  createStaffCalendarLinkAction,
  deactivateStaffCalendarLinkAction,
} from "@/src/lib/actions/fi-provider-calendar-links-actions";
import type { StaffCalendarLinkPageModel } from "@/src/lib/googleCalendar/googleCalendarProviderLinksCore";

function formatUpdatedAt(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleString();
}

function statusBadgeClass(status: string): string {
  return status === "active"
    ? "bg-emerald-500/15 text-emerald-300"
    : "bg-slate-500/15 text-slate-400";
}

export function ProviderCalendarLinksCard({
  tenantId,
  pageModel,
}: {
  tenantId: string;
  pageModel: StaffCalendarLinkPageModel;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [staffMemberId, setStaffMemberId] = useState(pageModel.staffOptions[0]?.id ?? "");
  const [calendarId, setCalendarId] = useState("");
  const [calendarLabel, setCalendarLabel] = useState("");
  const [googleAccountEmail, setGoogleAccountEmail] = useState("");
  const [provider, setProvider] = useState<"google" | "timely">("google");
  const [timelyIcsUrl, setTimelyIcsUrl] = useState("");

  const resetForm = useCallback(() => {
    setCalendarId("");
    setCalendarLabel("");
    setGoogleAccountEmail("");
    setProvider("google");
    setTimelyIcsUrl("");
    setError(null);
  }, []);

  const handleCreate = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const result = await createStaffCalendarLinkAction(tenantId, {
        staffMemberId,
        calendarId,
        calendarLabel: calendarLabel.trim() || undefined,
        googleAccountEmail: googleAccountEmail.trim() || undefined,
        provider,
        timelyIcsUrl: timelyIcsUrl.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      resetForm();
      setShowForm(false);
      router.refresh();
    });
  }, [
    calendarId,
    calendarLabel,
    googleAccountEmail,
    provider,
    resetForm,
    router,
    staffMemberId,
    tenantId,
    timelyIcsUrl,
  ]);

  const handleDeactivate = useCallback(
    (linkId: string) => {
      setError(null);
      startTransition(async () => {
        const result = await deactivateStaffCalendarLinkAction(tenantId, { linkId });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.refresh();
      });
    },
    [router, tenantId]
  );

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/80 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#F8FAFC]">Provider calendar links</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#94A3B8]">
            Map external Google or Timely calendar IDs to staff members so CalendarOS events appear
            in the correct provider column instead of Unassigned.
          </p>
        </div>
        {pageModel.canManage ? (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg border border-[#22C1FF]/40 bg-[#22C1FF]/10 px-3 py-1.5 text-sm font-medium text-[#22C1FF] hover:bg-[#22C1FF]/20"
          >
            {showForm ? "Cancel" : "Add link"}
          </button>
        ) : null}
      </div>

      {provider === "timely" || timelyIcsUrl ? (
        <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
          Timely ICS feed URLs are sensitive — treat them like passwords. They are encrypted on the
          server and never shown in full after saving.
        </p>
      ) : null}

      {showForm && pageModel.canManage ? (
        <div className="mt-4 space-y-3 rounded-lg border border-white/[0.06] bg-[#060d18]/60 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[#CBD5E1]">Staff member</span>
              <select
                value={staffMemberId}
                onChange={(e) => setStaffMemberId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0a1424] px-3 py-2 text-[#F8FAFC]"
              >
                {pageModel.staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[#CBD5E1]">Provider</span>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as "google" | "timely")}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0a1424] px-3 py-2 text-[#F8FAFC]"
              >
                <option value="google">Google Calendar</option>
                <option value="timely">Timely (ICS)</option>
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-[#CBD5E1]">Calendar ID</span>
              <input
                type="text"
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                placeholder={
                  provider === "google"
                    ? "primary or calendar@group.calendar.google.com"
                    : "timely-staff-feed-id"
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0a1424] px-3 py-2 text-[#F8FAFC]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[#CBD5E1]">Calendar label (optional)</span>
              <input
                type="text"
                value={calendarLabel}
                onChange={(e) => setCalendarLabel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0a1424] px-3 py-2 text-[#F8FAFC]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[#CBD5E1]">Google account email (optional)</span>
              <input
                type="email"
                value={googleAccountEmail}
                onChange={(e) => setGoogleAccountEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0a1424] px-3 py-2 text-[#F8FAFC]"
              />
            </label>
            {provider === "timely" ? (
              <label className="block text-sm sm:col-span-2">
                <span className="text-[#CBD5E1]">Timely ICS URL (optional)</span>
                <input
                  type="url"
                  value={timelyIcsUrl}
                  onChange={(e) => setTimelyIcsUrl(e.target.value)}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0a1424] px-3 py-2 text-[#F8FAFC]"
                />
              </label>
            ) : null}
          </div>
          <button
            type="button"
            disabled={pending || !staffMemberId || !calendarId.trim()}
            onClick={handleCreate}
            className="rounded-lg bg-[#22C1FF] px-4 py-2 text-sm font-medium text-[#041018] disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save link"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wide text-[#64748B]">
              <th className="px-2 py-2 font-medium">Staff</th>
              <th className="px-2 py-2 font-medium">Calendar ID</th>
              <th className="px-2 py-2 font-medium">Label</th>
              <th className="px-2 py-2 font-medium">Provider</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Updated</th>
              {pageModel.canManage ? <th className="px-2 py-2 font-medium" /> : null}
            </tr>
          </thead>
          <tbody>
            {pageModel.links.length === 0 ? (
              <tr>
                <td
                  colSpan={pageModel.canManage ? 7 : 6}
                  className="px-2 py-6 text-center text-[#64748B]"
                >
                  No provider calendar links yet. Events from synced calendars will stay in
                  Unassigned until linked.
                </td>
              </tr>
            ) : (
              pageModel.links.map((link) => (
                <tr key={link.id} className="border-b border-white/[0.04] text-[#CBD5E1]">
                  <td className="px-2 py-2">{link.staffMemberName}</td>
                  <td className="px-2 py-2 font-mono text-xs">{link.calendarId}</td>
                  <td className="px-2 py-2">{link.calendarLabel ?? "—"}</td>
                  <td className="px-2 py-2 capitalize">{link.provider}</td>
                  <td className="px-2 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(link.status)}`}
                    >
                      {link.status}
                    </span>
                    {link.timelyIcsConfigured ? (
                      <span className="mt-1 block text-xs text-[#64748B]">
                        {link.timelyIcsMasked}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-xs text-[#94A3B8]">
                    {formatUpdatedAt(link.updatedAt)}
                  </td>
                  {pageModel.canManage ? (
                    <td className="px-2 py-2">
                      {link.status === "active" ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleDeactivate(link.id)}
                          className="text-xs text-amber-300 hover:underline disabled:opacity-50"
                        >
                          Deactivate
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
