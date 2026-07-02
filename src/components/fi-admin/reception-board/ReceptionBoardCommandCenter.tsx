"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CreditCard,
  RefreshCw,
  Search,
  Stethoscope,
  Users,
} from "lucide-react";

import { useCalendarToast } from "@/components/calendar/CalendarToast";
import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { receptionBoardFlowActionLabel } from "@/src/lib/fiOs/receptionBoardFlowPolicy";
import {
  deriveReceptionAppointmentNextAction,
  deriveReceptionAppointmentPriority,
  humanizeReceptionActionAlert,
  STAFF_UX_PRIORITY_STYLES,
} from "@/src/lib/fiOs/staffUxPresentation";
import { FiOsEmptyState } from "@/src/components/fi-admin/shared/FiOsEmptyState";
import { StaffUatClarityFeedback } from "@/src/components/fi-admin/staff-uat/StaffUatClarityFeedback";
import { StaffUatScreenGuide } from "@/src/components/fi-admin/staff-uat/StaffUatScreenGuide";
import { useStaffUat } from "@/src/components/fi-admin/staff-uat/StaffUatContext";
import { ClinicOsGlobalSearch } from "@/src/components/fi-admin/search/ClinicOsGlobalSearch";
import {
  ReceptionPatientFlowBoard,
  type ReceptionMutationMode,
} from "@/src/components/fi-admin/reception/ReceptionPatientFlowBoard";
import { receptionBoardTransitionPatient } from "@/src/lib/receptionBoard/receptionBoardActions";
import {
  RECEPTION_BOARD_QUEUE_COLUMN_LABELS,
  readinessToneClass,
} from "@/src/lib/receptionBoard/receptionBoardCore";
import type {
  ReceptionBoardActionAlert,
  ReceptionBoardAppointmentCard,
  ReceptionBoardCommandCenterPayload,
  ReceptionBoardQueueColumnId,
} from "@/src/lib/receptionBoard/receptionBoardTypes";
import { formatCalendarLongWeekdayDate } from "@/src/lib/calendar/calendarTimezone";
import { useReceptionBoardRefresh } from "./useReceptionBoardRefresh";

function formatRefreshTime(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function statusBadgeClass(status: ReceptionBoardAppointmentCard["status"]): string {
  switch (status) {
    case "waiting":
    case "in_procedure":
      return "bg-amber-500/20 text-amber-200 border-amber-500/30";
    case "in_consultation":
    case "checked_in":
    case "arrived":
      return "bg-cyan-500/20 text-cyan-200 border-cyan-500/30";
    case "completed":
      return "bg-emerald-500/20 text-emerald-200 border-emerald-500/30";
    case "cancelled":
      return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    default:
      return "bg-violet-500/15 text-violet-200 border-violet-500/25";
  }
}

function alertRowClass(severity: ReceptionBoardActionAlert["severity"]): string {
  switch (severity) {
    case "blocked":
    case "critical":
      return "border-rose-500/35 bg-rose-500/10";
    case "warning":
      return "border-amber-500/30 bg-amber-500/8";
    default:
      return "border-white/[0.08] bg-white/[0.03]";
  }
}

function paymentBadgeClass(status: ReceptionBoardAppointmentCard["paymentStatus"]): string {
  switch (status) {
    case "overdue":
      return "text-rose-300";
    case "due":
      return "text-amber-300";
    case "paid":
      return "text-emerald-300";
    default:
      return "text-slate-500";
  }
}

function MetricTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0f1729]/80 px-4 py-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-50">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function ReceptionBoardCommandCenter(props: {
  initialData: ReceptionBoardCommandCenterPayload;
  mutationMode: ReceptionMutationMode;
  showCrmNav?: boolean;
  showBookingsBoard?: boolean;
}) {
  const { mutationMode, showCrmNav = true, showBookingsBoard = true } = props;
  const router = useRouter();
  const toast = useCalendarToast();
  const [searchOpen, setSearchOpen] = useState(false);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);

  const { logFriction } = useStaffUat();
  const { data, lastRefreshedAt, isRefreshing, refreshError, refresh } = useReceptionBoardRefresh({
    tenantId: props.initialData.tenantId,
    initialData: props.initialData,
  });

  const base = `/fi-admin/${data.tenantId}`;
  const tz = data.operationalDay.calendarTimezone;
  const dateLine = formatCalendarLongWeekdayDate(data.operationalDay.todayYmd, tz);
  const canMutate = mutationMode === "full" || mutationMode === "pin_reception";

  const queueColumns = useMemo(
    () =>
      (Object.keys(RECEPTION_BOARD_QUEUE_COLUMN_LABELS) as ReceptionBoardQueueColumnId[]).filter(
        (id) => data.queue[id]?.length > 0
      ),
    [data.queue]
  );

  async function advancePatient(
    bookingId: string,
    action: NonNullable<(typeof data.queue.scheduled)[0]["nextFlowAction"]>
  ) {
    if (!canMutate) return;
    setBusyBookingId(bookingId);
    try {
      const result = await receptionBoardTransitionPatient(data.tenantId, bookingId, { action });
      if (!result.ok) {
        toast.error(result.error ?? "Could not update patient status.");
        return;
      }
      toast.success(`${receptionBoardFlowActionLabel(action)} — saved`);
      router.refresh();
      void refresh();
    } finally {
      setBusyBookingId(null);
    }
  }

  return (
    <div
      className={cn(
        "mx-auto min-w-0 max-w-[100rem] space-y-8 pb-14 transition-opacity",
        isRefreshing && "opacity-90"
      )}
    >
      <StaffUatScreenGuide screenKey="reception_board" />

      <header className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b1220] p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(640px_300px_at_0%_0%,rgba(34,193,255,0.14),transparent_55%),radial-gradient(480px_240px_at_100%_100%,rgba(124,58,237,0.1),transparent_50%)]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/90">
              FI OS · Reception Board
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
              Clinic operations cockpit
            </h1>
            <p className="mt-2 max-w-2xl text-base text-slate-400">
              {data.tenantName} · {dateLine} — run the entire clinic day from one screen.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-[#141c33]/70 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-cyan-500/35 hover:text-cyan-300"
            >
              <Search className="h-4 w-4" aria-hidden />
              Search patients
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-[#141c33]/70 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-cyan-500/35 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} aria-hidden />
              {isRefreshing ? "Refreshing…" : `Live · ${formatRefreshTime(lastRefreshedAt)}`}
            </button>
          </div>
        </div>
        {refreshError ? (
          <p className="relative mt-3 text-sm text-rose-300">{refreshError}</p>
        ) : null}
      </header>

      {/* Section 6 — Intelligence (above fold) */}
      <section aria-label="Clinic intelligence">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricTile label="Consultations today" value={data.intelligence.todayConsultations} />
          <MetricTile label="Surgeries today" value={data.intelligence.todaySurgeries} />
          <MetricTile
            label="Outstanding payments"
            value={data.intelligence.outstandingPayments}
            sub="Deposits & balances"
          />
          <MetricTile
            label="Doctor utilization"
            value={
              data.intelligence.doctorUtilizationPercent != null
                ? `${data.intelligence.doctorUtilizationPercent}%`
                : "—"
            }
          />
          <MetricTile
            label="Follow-ups flagged"
            value={data.intelligence.upcomingFollowUps}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          {/* Section 1 — Today's schedule */}
          <DashboardCard elevated className="overflow-hidden p-0">
            <div className="border-b border-white/[0.06] px-5 py-4 sm:px-6">
              <SectionHeader
                title="Today's clinic operations"
                description="Unified schedule — consultations, surgeries, PRP, follow-ups, and procedures"
              />
            </div>
            <div className="max-h-[28rem] overflow-y-auto px-3 py-3 sm:px-4">
              {data.appointments.length === 0 ? (
                <FiOsEmptyState
                  title="No appointments scheduled today"
                  description="Open the calendar to plan the day, or find a patient to book their next visit."
                  action={{ label: "Open calendar", href: `${base}/calendar` }}
                  secondaryAction={{ label: "Find or add patient", href: `${base}/patients` }}
                  icon={<Calendar className="h-10 w-10 opacity-40" aria-hidden />}
                />
              ) : (
                <ul className="space-y-2">
                  {data.appointments.map((appt) => (
                    <li key={appt.id}>
                      <AppointmentHeroCard appt={appt} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DashboardCard>

          {/* Section 2 — Arrival queue */}
          <DashboardCard elevated className="overflow-hidden p-0" id="queue">
            <div className="border-b border-white/[0.06] px-5 py-4 sm:px-6">
              <SectionHeader
                title="Live patient arrival queue"
                description="Move patients through clinic states — one click advances workflow"
              />
            </div>
            <div className="overflow-x-auto px-3 py-4 sm:px-4">
              {queueColumns.length === 0 ? (
                <ReceptionPatientFlowBoard
                  tenantId={data.tenantId}
                  base={base}
                  calendarTimezone={tz}
                  cards={data.receptionCards}
                  mutationMode={mutationMode}
                />
              ) : (
                <div className="flex min-w-max gap-3 pb-2">
                  {queueColumns.map((colId) => (
                    <section
                      key={colId}
                      className="flex w-[min(100%,18rem)] shrink-0 flex-col rounded-xl border border-white/[0.07] bg-[#0c1426]/80"
                    >
                      <header className="border-b border-white/[0.06] px-3 py-3">
                        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                          {RECEPTION_BOARD_QUEUE_COLUMN_LABELS[colId]}
                        </h3>
                        <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-50">
                          {data.queue[colId].length}
                        </p>
                      </header>
                      <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto p-2">
                        {data.queue[colId].map((item) => (
                          <li key={item.bookingId}>
                            <article className="rounded-lg border border-cyan-500/15 bg-[#141c33]/90 px-3 py-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-50">{item.patientName}</p>
                                <span className="text-xs tabular-nums text-slate-500">
                                  {item.appointmentTime}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                {item.appointmentType} · {item.clinician}
                              </p>
                              {item.room ? (
                                <p className="mt-1 text-xs text-slate-500">Room {item.room}</p>
                              ) : null}
                              {item.nextFlowAction && canMutate ? (
                                <button
                                  type="button"
                                  disabled={busyBookingId === item.bookingId}
                                  onClick={() => void advancePatient(item.bookingId, item.nextFlowAction!)}
                                  className="mt-2 w-full rounded-lg bg-cyan-500/20 px-2 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/30 disabled:opacity-40"
                                >
                                  {receptionBoardFlowActionLabel(item.nextFlowAction!)}
                                </button>
                              ) : null}
                              <div className="mt-2 flex gap-2 text-[0.65rem] font-semibold">
                                {item.hrefs.patient ? (
                                  <Link href={item.hrefs.patient} className="text-cyan-400/90 hover:underline">
                                    Patient
                                  </Link>
                                ) : null}
                                <Link href={item.hrefs.appointment} className="text-cyan-400/90 hover:underline">
                                  Booking
                                </Link>
                              </div>
                            </article>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </DashboardCard>

          {/* Section 5 — Tomorrow surgery prep */}
          <DashboardCard elevated className="overflow-hidden p-0">
            <div className="border-b border-white/[0.06] px-5 py-4 sm:px-6">
              <SectionHeader
                title="Tomorrow surgery preparation"
                description="SurgeryOS readiness — deposits, consent, clearance, and pre-op checklist"
              />
            </div>
            <div className="space-y-3 px-4 py-4 sm:px-5">
              {data.tomorrowSurgeries.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No surgeries scheduled for tomorrow.</p>
              ) : (
                data.tomorrowSurgeries.map((s) => (
                  <article
                    key={s.bookingId}
                    className="rounded-xl border border-white/[0.08] bg-[#0f1729]/70 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        {s.hrefs.patient ? (
                          <Link href={s.hrefs.patient} className="text-lg font-semibold text-slate-50 hover:underline">
                            {s.patientLabel}
                          </Link>
                        ) : (
                          <p className="text-lg font-semibold text-slate-50">{s.patientLabel}</p>
                        )}
                        <p className="mt-1 text-sm text-slate-500">
                          {s.procedureType} · {s.surgeryTime} · {s.surgeon ?? "Surgeon TBC"}
                        </p>
                      </div>
                      <p className={cn("text-2xl font-bold tabular-nums", readinessToneClass(s.readinessTone))}>
                        {s.readinessPercent}%
                      </p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          s.readinessTone === "green" && "bg-emerald-500",
                          s.readinessTone === "yellow" && "bg-amber-500",
                          s.readinessTone === "red" && "bg-rose-500"
                        )}
                        style={{ width: `${Math.min(100, s.readinessPercent)}%` }}
                      />
                    </div>
                    {s.missingItems.length > 0 ? (
                      <ul className="mt-3 space-y-1">
                        <li className="text-xs font-semibold uppercase tracking-wide text-rose-300/90">Missing</li>
                        {s.missingItems.map((m) => (
                          <li key={m} className="text-sm text-rose-200/80">
                            · {m}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-emerald-300/90">Ready for tomorrow</p>
                    )}
                  </article>
                ))
              )}
            </div>
          </DashboardCard>
        </div>

        <div className="space-y-6 xl:col-span-4">
          {/* Section 4 — Quick actions */}
          <DashboardCard className="p-4 sm:p-5">
            <SectionHeader title="Quick action center" description="One click — no nested menus" />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {data.quickActions.map((action) => (
                <Link
                  key={action.id}
                  href={action.href}
                  title={action.description}
                  className="flex min-h-[3.25rem] items-center justify-center rounded-xl border border-white/[0.1] bg-[#141c33]/60 px-3 py-3 text-center text-sm font-semibold text-slate-100 transition hover:border-cyan-500/35 hover:bg-cyan-500/10 hover:text-cyan-200"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </DashboardCard>

          {/* Section 3 — Action alerts */}
          <DashboardCard className="flex max-h-[32rem] flex-col overflow-hidden p-0">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <SectionHeader
                title="Action alerts"
                description="Operational blockers — sorted by severity"
              />
            </div>
            <ul className="flex-1 space-y-2 overflow-y-auto p-3">
              {data.actionAlerts.length === 0 ? (
                <li className="py-6 text-center">
                  <p className="text-sm font-medium text-emerald-300/90">All clear for today</p>
                  <p className="mt-1 text-xs text-slate-500">No operational blockers need attention.</p>
                </li>
              ) : (
                data.actionAlerts.map((alert) => {
                  const human = humanizeReceptionActionAlert(alert);
                  const alertHref = alert.href ?? `${base}/calendar`;
                  return (
                    <li key={alert.id}>
                      <Link
                        href={alertHref}
                        onClick={() =>
                          logFriction(
                            "alert_opened_unresolved",
                            human.title,
                            { alertId: alert.id, kind: alert.kind },
                            "reception_board"
                          )
                        }
                        className={cn(
                          "flex gap-3 rounded-xl border px-4 py-4 transition hover:border-cyan-500/30",
                          alertRowClass(alert.severity)
                        )}
                      >
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
                        <div className="min-w-0">
                          <p className="text-base font-semibold leading-snug text-slate-50">{human.title}</p>
                          <p className="mt-1 text-sm text-slate-400">{human.detail}</p>
                          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-cyan-400/90">
                            {human.resolveLabel}
                          </p>
                        </div>
                        <ArrowRight className="ml-auto h-5 w-5 shrink-0 text-slate-500" aria-hidden />
                      </Link>
                    </li>
                  );
                })
              )}
            </ul>
          </DashboardCard>

          {/* Section 8 — Live notifications */}
          <DashboardCard className="flex max-h-[24rem] flex-col overflow-hidden p-0">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <SectionHeader title="Live activity" description="Newest first" />
            </div>
            <ul className="flex-1 space-y-1 overflow-y-auto p-3">
              {data.liveEvents.length === 0 ? (
                <li className="py-6 text-center text-sm text-slate-500">No recent activity.</li>
              ) : (
                data.liveEvents.map((ev) => (
                  <li key={ev.id}>
                    {ev.href ? (
                      <Link
                        href={ev.href}
                        className="block rounded-lg px-2 py-2 transition hover:bg-white/[0.04]"
                      >
                        <p className="text-sm font-medium text-slate-200">{ev.title}</p>
                        {ev.detail ? <p className="text-xs text-slate-500">{ev.detail}</p> : null}
                      </Link>
                    ) : (
                      <div className="rounded-lg px-2 py-2">
                        <p className="text-sm font-medium text-slate-200">{ev.title}</p>
                        {ev.detail ? <p className="text-xs text-slate-500">{ev.detail}</p> : null}
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          </DashboardCard>
        </div>
      </div>

      <StaffUatClarityFeedback screenKey="reception_board" />

      <ClinicOsGlobalSearch
        tenantId={data.tenantId}
        base={base}
        showCrmNav={showCrmNav}
        showBookingsBoard={showBookingsBoard}
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />
    </div>
  );
}

function AppointmentHeroCard({ appt }: { appt: ReceptionBoardAppointmentCard }) {
  const priority = deriveReceptionAppointmentPriority(appt);
  const priorityStyle = STAFF_UX_PRIORITY_STYLES[priority];
  const nextAction = deriveReceptionAppointmentNextAction(appt);

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-l-4 bg-[#0f1729]/85 px-5 py-5 sm:flex-row sm:items-center sm:justify-between",
        priorityStyle.border
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide",
              priorityStyle.badge
            )}
          >
            {priorityStyle.label}
          </span>
          <span className="text-xl font-bold tabular-nums text-cyan-300">{appt.appointmentTime}</span>
          {appt.durationMinutes ? (
            <span className="text-xs text-slate-500">{appt.durationMinutes} min</span>
          ) : null}
          <span
            className={cn(
              "rounded-md border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
              statusBadgeClass(appt.status)
            )}
          >
            {appt.statusLabel}
          </span>
        </div>
        <p className="mt-2 text-lg font-semibold text-slate-50">{appt.patientName}</p>
        <p className="mt-0.5 text-sm text-slate-400">
          {appt.appointmentType} · <Users className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          {appt.clinician}
          {appt.room ? (
            <>
              {" "}
              · Room {appt.room}
            </>
          ) : null}
        </p>
        <p className={cn("mt-1 text-xs font-medium", paymentBadgeClass(appt.paymentStatus))}>
          <CreditCard className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          {appt.paymentStatusLabel}
          <span className="mx-2 text-slate-600">·</span>
          {appt.confirmationStatus === "confirmed" ? "Confirmed" : "Unconfirmed"}
        </p>
        {appt.journeyStateLabel ? (
          <p className="mt-1 text-xs font-semibold text-violet-300/90">
            Journey: {appt.journeyStateLabel}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
        {nextAction ? (
          <Link
            href={nextAction.href}
            className={cn(
              "inline-flex min-w-[10rem] items-center justify-center gap-1 rounded-xl px-4 py-3 text-sm font-semibold transition",
              nextAction.variant === "primary"
                ? "border border-cyan-500/40 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30"
                : "border border-white/[0.12] bg-white/[0.04] text-slate-200 hover:border-cyan-500/30"
            )}
          >
            {nextAction.label}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {appt.hrefs.patient ? (
            <Link
              href={appt.hrefs.patient}
              className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-500/30"
            >
              <Stethoscope className="h-3.5 w-3.5" aria-hidden />
              Patient
            </Link>
          ) : null}
          <Link
            href={appt.hrefs.calendar}
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-500/30"
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            Calendar
          </Link>
        </div>
      </div>
    </article>
  );
}