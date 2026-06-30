"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  cancelReminderJobAction,
  markReminderJobSentAction,
  rescheduleReminderJobAction,
} from "@/lib/actions/fi-reminder-job-actions";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type { DashboardReminderItem } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

type FilterMode = "all" | "mine";

const inputClass =
  "w-full max-w-[14rem] rounded-lg border border-white/[0.1] bg-[#081020]/85 px-2 py-1.5 text-xs text-[#F8FAFC] shadow-inner outline-none transition placeholder:text-[#475569] focus:border-[#22C1FF]/45 focus:ring-2 focus:ring-[#22C1FF]/20";

function formatScheduled(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function formatBookingSlot(iso: string | null, tz: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz?.trim() || undefined,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

function statusBadgeClass(status: string): string {
  if (status === "processing") return "border-sky-500/25 bg-sky-500/15 text-sky-100";
  if (status === "pending") return "border-amber-500/25 bg-amber-500/12 text-amber-100";
  return "border-white/[0.1] bg-white/[0.06] text-[#94A3B8]";
}

function toLocalDatetimeInputValue(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isMineRow(row: DashboardReminderItem, viewerFiUserId: string | null): boolean {
  if (!viewerFiUserId) return false;
  if (row.bookingAssigneeFiUserId === viewerFiUserId) return true;
  if (row.leadPrimaryOwnerFiUserId === viewerFiUserId) return true;
  return false;
}

export function DashboardUpcomingRemindersClient(props: {
  tenantId: string;
  items: DashboardReminderItem[];
  viewerFiUserId: string | null;
}) {
  const { tenantId, items, viewerFiUserId } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adminKey, setAdminKey] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [overrides, setOverrides] = useState<
    Partial<Record<string, Partial<DashboardReminderItem>>>
  >({});
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [rescheduleLocal, setRescheduleLocal] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const merged = useMemo(() => {
    return items
      .filter((i) => !dismissed.has(i.jobId))
      .map((i) => ({ ...i, ...overrides[i.jobId] }));
  }, [items, dismissed, overrides]);

  const visible = useMemo(() => {
    if (filter === "all") return merged;
    return merged.filter((r) => isMineRow(r, viewerFiUserId));
  }, [merged, filter, viewerFiUserId]);

  function runMutation(
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
    opts: {
      optimisticDismissJobId?: string;
      onSuccess?: () => void;
      rollbackOverrideJobId?: string;
    }
  ) {
    setActionError(null);
    if (opts.optimisticDismissJobId) {
      setDismissed((s) => new Set(s).add(opts.optimisticDismissJobId!));
    }
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setActionError(res.error);
        if (opts.optimisticDismissJobId) {
          setDismissed((s) => {
            const n = new Set(s);
            n.delete(opts.optimisticDismissJobId!);
            return n;
          });
        }
        if (opts.rollbackOverrideJobId) {
          setOverrides((o) => {
            const n = { ...o };
            delete n[opts.rollbackOverrideJobId!];
            return n;
          });
        }
        return;
      }
      opts.onSuccess?.();
      router.refresh();
    });
  }

  return (
    <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="dash-reminders-heading">
      <SectionHeader
        id="dash-reminders-heading"
        kicker="Engagement"
        title="Upcoming reminders"
        description="Queued SMS/email jobs that are pending or processing, scheduled within the next 7 days (UTC). Booking-linked rows show the visit anchor when available."
        className="mb-4"
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Reminder scope">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              filter === "all"
                ? "border-[#22C1FF]/45 bg-[#22C1FF]/10 text-[#22C1FF]"
                : "border-white/[0.08] bg-[#081020]/50 text-[#94A3B8] hover:border-white/[0.14]"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("mine")}
            disabled={!viewerFiUserId}
            title={
              !viewerFiUserId ? "Sign in as a tenant member to filter by ownership." : undefined
            }
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              filter === "mine"
                ? "border-[#22C1FF]/45 bg-[#22C1FF]/10 text-[#22C1FF]"
                : "border-white/[0.08] bg-[#081020]/50 text-[#94A3B8] hover:border-white/[0.14]"
            }`}
          >
            My reminders
          </button>
        </div>
        <label className="block max-w-xs text-[11px] text-[#64748B]">
          FI Admin key (optional — for staff without CRM write role)
          <input
            type="password"
            autoComplete="off"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
      </div>

      {actionError ? (
        <p className="mb-3 text-sm text-rose-300/95" role="alert">
          {actionError}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm leading-relaxed text-[#94A3B8]">
          No reminder jobs in the next week. Configure{" "}
          <Link
            href={`/fi-admin/${tenantId}/settings/reminders`}
            className="font-medium text-[#22C1FF] underline-offset-2 hover:underline"
          >
            templates
          </Link>{" "}
          and confirm patient consent on the patient profile.
        </p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-[#94A3B8]">
          {filter === "mine"
            ? "No reminders in your ownership queue for this window. Try All, or assign yourself on the booking or lead."
            : "No rows to display."}
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#081020]/40">
          {visible.map((row) => {
            const bookingLine =
              row.bookingId && row.bookingStartAt
                ? formatBookingSlot(row.bookingStartAt, row.bookingTimezone)
                : null;
            return (
              <li key={row.jobId} className="flex flex-col gap-2 px-3 py-3 sm:gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-[#F8FAFC]">
                        {row.recipientLabel}
                      </p>
                      <span
                        className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#94A3B8]">
                      <span className="font-medium text-[#CBD5E1]">{row.templateName}</span>{" "}
                      <span className="text-[#64748B]">({row.templateType})</span>
                      {" · "}
                      Send {formatScheduled(row.scheduled_at)}
                    </p>
                    {row.clinicalSummaryLine ? (
                      <p className="mt-1 text-xs leading-snug text-[#64748B]">
                        {row.clinicalSummaryLine}
                      </p>
                    ) : null}
                    {bookingLine ? (
                      <p className="mt-1 text-xs text-[#64748B]">
                        Linked booking: {bookingLine}
                        {row.bookingTitle ? ` — ${row.bookingTitle}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                    <Link
                      href={row.detailHref}
                      className="text-center text-xs font-semibold text-[#22C1FF] underline-offset-2 hover:underline sm:text-right"
                    >
                      Open record
                    </Link>
                  </div>
                </div>

                {rescheduleFor === row.jobId ? (
                  <div className="flex flex-col gap-2 rounded-lg border border-white/[0.08] bg-[#050a14]/50 p-3 sm:flex-row sm:items-end">
                    <label className="block flex-1 text-[11px] text-[#64748B]">
                      New send time (local)
                      <input
                        type="datetime-local"
                        className={`${inputClass} mt-1 max-w-none`}
                        value={rescheduleLocal}
                        onChange={(e) => setRescheduleLocal(e.target.value)}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isPending}
                        className="rounded-lg border border-white/[0.1] bg-[#141C33]/80 px-3 py-1.5 text-xs font-semibold text-[#E2E8F0] hover:border-[#22C1FF]/35 disabled:opacity-50"
                        onClick={() => {
                          setRescheduleFor(null);
                          setRescheduleLocal("");
                        }}
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        disabled={isPending || !rescheduleLocal.trim()}
                        className="rounded-lg border border-[#22C1FF]/35 bg-[#22C1FF]/10 px-3 py-1.5 text-xs font-semibold text-[#22C1FF] hover:bg-[#22C1FF]/15 disabled:opacity-50"
                        onClick={() => {
                          const iso = new Date(rescheduleLocal).toISOString();
                          if (!Number.isFinite(Date.parse(iso))) {
                            setActionError("Invalid date/time.");
                            return;
                          }
                          setOverrides((o) => ({ ...o, [row.jobId]: { scheduled_at: iso } }));
                          runMutation(
                            () =>
                              rescheduleReminderJobAction(tenantId, row.jobId, {
                                tenantId,
                                jobId: row.jobId,
                                scheduledAtIso: iso,
                                adminKey: adminKey.trim() || undefined,
                              }),
                            {
                              rollbackOverrideJobId: row.jobId,
                              onSuccess: () => {
                                setRescheduleFor(null);
                                setRescheduleLocal("");
                                setOverrides((o) => {
                                  const n = { ...o };
                                  delete n[row.jobId];
                                  return n;
                                });
                              },
                            }
                          );
                        }}
                      >
                        Save time
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/15 disabled:opacity-50"
                    onClick={() => {
                      if (!window.confirm("Mark this reminder as sent? It will leave the queue."))
                        return;
                      runMutation(
                        () =>
                          markReminderJobSentAction(tenantId, row.jobId, {
                            adminKey: adminKey.trim() || undefined,
                          }),
                        { optimisticDismissJobId: row.jobId }
                      );
                    }}
                  >
                    Mark sent
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    className="rounded-lg border border-white/[0.1] bg-[#141C33]/60 px-2.5 py-1 text-[11px] font-semibold text-[#E2E8F0] hover:border-rose-500/30 hover:text-rose-100 disabled:opacity-50"
                    onClick={() => {
                      if (!window.confirm("Cancel this reminder job?")) return;
                      runMutation(
                        () =>
                          cancelReminderJobAction(tenantId, row.jobId, {
                            adminKey: adminKey.trim() || undefined,
                            reason: "cancelled_from_dashboard",
                          }),
                        { optimisticDismissJobId: row.jobId }
                      );
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isPending || row.status !== "pending"}
                    title={
                      row.status !== "pending"
                        ? "Only pending jobs can be rescheduled here."
                        : undefined
                    }
                    className="rounded-lg border border-[#22C1FF]/25 bg-[#22C1FF]/5 px-2.5 py-1 text-[11px] font-semibold text-[#22C1FF] hover:bg-[#22C1FF]/10 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => {
                      setRescheduleFor(row.jobId);
                      setRescheduleLocal(toLocalDatetimeInputValue(row.scheduled_at));
                    }}
                  >
                    Reschedule
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-[#64748B]">
        Manage templates and cadence in{" "}
        <Link
          href={`/fi-admin/${tenantId}/settings/reminders`}
          className="font-medium text-[#22C1FF] underline-offset-2 hover:underline"
        >
          Settings → Reminders
        </Link>
        . Automated delivery still uses the cron processor when wired.
      </p>
    </DashboardCard>
  );
}
