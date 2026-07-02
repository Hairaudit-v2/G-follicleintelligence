import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import {
  ReceptionPatientFlowBoard,
  type ReceptionMutationMode,
} from "@/src/components/fi-admin/reception/ReceptionPatientFlowBoard";
import { ReceptionSystemDiagnostics } from "@/src/components/fi-admin/reception/ReceptionSystemDiagnostics";
import { formatCalendarLongWeekdayDate } from "@/src/lib/calendar/calendarTimezone";
import {
  buildReceptionAppointmentList,
  buildReceptionFlowBoardItems,
  buildReceptionHandoffSummary,
  buildReceptionPriorities,
  buildReceptionReadinessBlockers,
  buildReceptionSnapshotCards,
  receptionAttentionSeverityClass,
  receptionBoardLinkButtonClass,
  receptionFlowBoardHasPatients,
} from "@/src/lib/fiAdmin/receptionBoardPresentation";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

function ReceptionBoardPrimaryActions({ base }: { base: string }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <Link href={`${base}/calendar`} className={receptionBoardLinkButtonClass}>
        Open Calendar
      </Link>
      <Link href={`${base}/operations`} className={receptionBoardLinkButtonClass}>
        Open clinic flow
      </Link>
      <Link href={`${base}/procedure-day`} className={receptionBoardLinkButtonClass}>
        Open Procedure Day
      </Link>
      <Link href={`${base}/financial/dashboard`} className={receptionBoardLinkButtonClass}>
        Open FinancialOS
      </Link>
      <Link href={`${base}/calendar`} className={receptionBoardLinkButtonClass}>
        Quick Create Booking
      </Link>
    </div>
  );
}

/**
 * Reception Board — front-desk patient flow workspace.
 */
export function ReceptionBoardDashboard(props: {
  data: TenantOperationalDashboard;
  mutationMode: ReceptionMutationMode;
  showDiagnosticsExpanded?: boolean;
}) {
  const { data, mutationMode, showDiagnosticsExpanded = false } = props;
  const base = `/fi-admin/${data.tenantId}`;
  const tz = data.operationalDay.calendarTimezone.trim();
  const dateLine = formatCalendarLongWeekdayDate(data.operationalDay.todayYmd, tz);
  const cards = data.receptionBoard.cards;

  const snapshotCards = buildReceptionSnapshotCards(base, cards, data.paymentCommercialKpis);
  const priorityItems = buildReceptionPriorities(
    base,
    cards,
    data.paymentCommercialKpis,
    data.actionCentre,
    5
  );
  const flowHasPatients = receptionFlowBoardHasPatients(buildReceptionFlowBoardItems(cards));
  const readinessBlockers = buildReceptionReadinessBlockers(
    base,
    cards,
    data.paymentCommercialKpis
  );
  const handoffSummary = buildReceptionHandoffSummary(cards);
  const appointmentList = buildReceptionAppointmentList(base, cards, tz);
  const collapseAppointmentList = flowHasPatients && cards.length <= 12;

  return (
    <div className="mx-auto min-w-0 max-w-[88rem] space-y-8 pb-10 sm:space-y-10 sm:pb-14">
      <DashboardCard elevated className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_260px_at_0%_0%,rgba(34,193,255,0.11),transparent_55%),radial-gradient(420px_200px_at_100%_100%,rgba(124,58,237,0.07),transparent_50%)]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4">
          <div className="border-l-4 border-[#22C1FF]/80 pl-5 sm:pl-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#22C1FF]/95">
              FI OS
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC] sm:text-4xl">
              Reception Board
            </h1>
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-[#94A3B8]">
              Front-desk patient flow across arrivals, waiting status, forms, payments, rooms, and
              handoff.
            </p>
            <p className="mt-2 text-sm text-[#64748B]">
              {data.tenantName} · {dateLine}
            </p>
            <ReceptionBoardPrimaryActions base={base} />
          </div>
        </div>
      </DashboardCard>

      {mutationMode === "pin_reception" ? (
        <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-100/95">
          PIN session: you can run today&apos;s reception flow (check in, consult/treatment phase,
          complete, no-show). <span className="font-medium text-emerald-50">Cancel</span> needs a
          full team login.
        </p>
      ) : null}
      {mutationMode === "none" ? (
        <p className="rounded-xl border border-white/[0.08] bg-[#0c1220]/60 px-4 py-3 text-sm text-[#94A3B8]">
          Sign in with clinic access to update booking statuses from this board.
        </p>
      ) : null}

      <DashboardCard
        className="p-5 sm:p-6"
        role="region"
        aria-labelledby="reception-snapshot-heading"
      >
        <SectionHeader
          id="reception-snapshot-heading"
          kicker="Today"
          title="Reception snapshot"
          description="Front-desk signals for arrivals, waiting, clinical flow, and readiness."
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {snapshotCards.map((card) => {
            const inner = (
              <>
                <p className="text-sm font-semibold text-[#F8FAFC]">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-[#F8FAFC]">
                  {card.value}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[#64748B]">{card.detail}</p>
              </>
            );
            if (card.href) {
              return (
                <Link
                  key={card.id}
                  href={card.href}
                  className="group flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-4 transition hover:border-[#22C1FF]/25"
                >
                  {inner}
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#22C1FF]/80 opacity-0 transition group-hover:opacity-100">
                    Open <ArrowRight className="h-3 w-3" aria-hidden />
                  </span>
                </Link>
              );
            }
            return (
              <div
                key={card.id}
                className="flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-4"
              >
                {inner}
              </div>
            );
          })}
        </div>
      </DashboardCard>

      <DashboardCard
        className="p-5 sm:p-6"
        role="region"
        aria-labelledby="reception-priorities-heading"
      >
        <SectionHeader
          id="reception-priorities-heading"
          kicker="Priorities"
          title="What reception needs to do"
          description="Top front-desk actions — act here first."
          className="mb-4"
        />
        {priorityItems.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
            <p className="text-sm leading-relaxed text-[#CBD5E1]">
              Reception flow is currently under control.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {priorityItems.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-4 transition hover:border-[#22C1FF]/30 ${receptionAttentionSeverityClass(item.severity)}`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#F8FAFC]">{item.headline}</p>
                      {item.detail ? (
                        <p className="mt-1 text-sm text-[#94A3B8]">{item.detail}</p>
                      ) : null}
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#22C1FF]/70" aria-hidden />
                  </Link>
                ) : (
                  <div
                    className={`rounded-xl border px-4 py-4 ${receptionAttentionSeverityClass(item.severity)}`}
                  >
                    <p className="font-semibold text-[#F8FAFC]">{item.headline}</p>
                    {item.detail ? (
                      <p className="mt-1 text-sm text-[#94A3B8]">{item.detail}</p>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="reception-flow-heading">
        <SectionHeader
          id="reception-flow-heading"
          kicker="Flow"
          title="Patient flow board"
          description="Move patients through arrivals, waiting, clinical care, handoff, and completion."
          className="mb-4"
        />
        <ReceptionPatientFlowBoard
          tenantId={data.tenantId}
          base={base}
          calendarTimezone={tz}
          cards={cards}
          mutationMode={mutationMode}
        />
      </DashboardCard>

      {readinessBlockers.length > 0 ? (
        <DashboardCard
          className="p-5 sm:p-6"
          role="region"
          aria-labelledby="reception-readiness-heading"
        >
          <SectionHeader
            id="reception-readiness-heading"
            kicker="Readiness"
            title="Forms, consent, and payment readiness"
            description="Blockers reception can clear before clinical handoff."
            className="mb-4"
          />
          <ul className="space-y-2">
            {readinessBlockers.map((blocker) => (
              <li key={blocker.id}>
                <Link
                  href={blocker.href}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-[#0c1220]/60 px-4 py-3 transition hover:border-[#22C1FF]/30"
                >
                  <span className="text-sm font-medium text-[#F8FAFC]">{blocker.label}</span>
                  <span className="shrink-0 rounded-lg bg-white/[0.04] px-3 py-1 text-sm font-semibold tabular-nums text-[#94A3B8]">
                    {blocker.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={`${base}/financial/dashboard`}
            className={`mt-4 inline-flex ${receptionBoardLinkButtonClass}`}
          >
            Open FinancialOS
          </Link>
        </DashboardCard>
      ) : null}

      <DashboardCard
        className="p-5 sm:p-6"
        role="region"
        aria-labelledby="reception-handoff-heading"
      >
        <SectionHeader
          id="reception-handoff-heading"
          kicker="Handoff"
          title="Room and handoff status"
          description="Compact view of room assignment and clinical handoff — not a full operations board."
          className="mb-4"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Room assigned", value: handoffSummary.roomAssigned },
            { label: "Room missing", value: handoffSummary.roomMissing },
            { label: "Ready for clinical team", value: handoffSummary.readyForClinical },
            { label: "Waiting for handoff", value: handoffSummary.waitingForHandoff },
            { label: "Completed · ready to leave", value: handoffSummary.completedReadyToLeave },
          ].map((row) => (
            <div
              key={row.label}
              className="rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-3"
            >
              <p className="text-xs font-medium text-[#64748B]">{row.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-[#F8FAFC]">{row.value}</p>
            </div>
          ))}
        </div>
      </DashboardCard>

      {appointmentList.length > 0 ? (
        <details className="group" open={!collapseAppointmentList}>
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <DashboardCard className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <SectionHeader
                  kicker="Schedule"
                  title="Today's appointment list"
                  description="Quick chronological scan — open Calendar for full scheduling."
                />
                <span className="shrink-0 text-xs font-medium text-[#22C1FF]/80">
                  {collapseAppointmentList ? "Expand" : "Collapse"}
                </span>
              </div>
            </DashboardCard>
          </summary>
          <DashboardCard className="-mt-6 border-t-0 rounded-t-none p-5 sm:p-6">
            <ul className="divide-y divide-white/[0.06]">
              {appointmentList.map((appt) => (
                <li
                  key={appt.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#F8FAFC]">
                      {appt.patientName}
                    </p>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      {appt.timeLabel} · {appt.serviceLabel} · {appt.statusLabel}
                    </p>
                  </div>
                  <Link
                    href={appt.appointmentHref}
                    className="shrink-0 text-xs font-semibold text-[#22C1FF]/80 hover:text-[#22C1FF]"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          </DashboardCard>
        </details>
      ) : null}

      <ReceptionSystemDiagnostics data={data} showDiagnosticsExpanded={showDiagnosticsExpanded} />
    </div>
  );
}

export type { ReceptionMutationMode };
