"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { formatCalendarLongWeekdayDate } from "@/src/lib/calendar/calendarTimezone";
import type {
  ProcedureDayBoardPayload,
  ProcedureDayScheduleCard,
} from "@/src/lib/surgery/procedureDayBoardLoader.server";
import {
  buildPostOpDischargeReadiness,
  buildProcedureDayFlowBoardItems,
  buildProcedureDayPriorities,
  buildProcedureDaySnapshotCards,
  buildRoomTeamCoordination,
  PROCEDURE_DAY_FLOW_LANES,
  surgicalAttentionSeverityClass,
  surgeryLinkButtonClass,
  type ProcedureDayFlowBoardItem,
} from "@/src/lib/fiAdmin/surgeryPresentation";
import { ProcedureDaySystemDiagnostics } from "@/src/components/fi-admin/surgery/ProcedureDaySystemDiagnostics";

function ProcedureDayPrimaryActions({ base, todayYmd }: { base: string; todayYmd: string }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <Link href={`${base}/surgery-os`} className={surgeryLinkButtonClass}>
        Open SurgeryOS
      </Link>
      <Link href={`${base}/reception`} className={surgeryLinkButtonClass}>
        Open Reception Board
      </Link>
      <Link
        href={`${base}/calendar?date=${encodeURIComponent(todayYmd)}`}
        className={surgeryLinkButtonClass}
      >
        Open Calendar
      </Link>
      <Link href={`${base}/surgery-readiness`} className={surgeryLinkButtonClass}>
        Open Readiness Board
      </Link>
      <Link href={`${base}/calendar`} className={surgeryLinkButtonClass}>
        Quick Create Booking
      </Link>
    </div>
  );
}

function FlowProcedureCard({ base, item }: { base: string; item: ProcedureDayFlowBoardItem }) {
  const { card } = item;
  const teamLabel =
    [card.procedureSurgeonLabel, card.calendarAssigneeLabel].filter(Boolean).join(" · ") || "—";
  return (
    <article className="rounded-lg border border-white/[0.08] bg-[#0c1220]/80 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[#F8FAFC]">{card.patientLabel}</p>
          <p className="mt-0.5 text-xs text-[#64748B]">
            {card.timeLabel} · {card.procedureType ?? card.bookingTypeLabel}
          </p>
        </div>
        <span className="shrink-0 rounded border border-white/[0.08] bg-black/30 px-2 py-0.5 text-[0.65rem] text-[#94A3B8]">
          {item.liveStatusLabel}
        </span>
      </div>
      <p className="mt-2 text-xs text-[#64748B]">
        <span className="text-[#475569]">Team: </span>
        {teamLabel}
      </p>
      {item.blockers.length ? (
        <ul className="mt-2 flex flex-wrap gap-1">
          {item.blockers.map((b) => (
            <li
              key={b}
              className="rounded border border-amber-500/20 bg-amber-500/[0.06] px-1.5 py-0.5 text-[0.65rem] text-amber-100/90"
            >
              {b}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-[0.68rem] leading-relaxed text-[#94A3B8]">{item.nextAction}</p>
      <div className="mt-2 flex flex-wrap gap-x-3 text-[0.68rem] font-semibold">
        <Link href={`${base}/surgery-os`} className="text-[#22C1FF]/90 hover:text-[#22C1FF]">
          SurgeryOS
        </Link>
        <Link href={`${base}/reception`} className="text-[#22C1FF]/90 hover:text-[#22C1FF]">
          Reception
        </Link>
        {card.hrefs.patient ? (
          <Link href={card.hrefs.patient} className="text-[#22C1FF]/90 hover:text-[#22C1FF]">
            PatientOS
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function groupByLane(cards: ProcedureDayScheduleCard[]) {
  const items = buildProcedureDayFlowBoardItems(cards);
  const lanes = new Map<string, ProcedureDayFlowBoardItem[]>();
  for (const lane of PROCEDURE_DAY_FLOW_LANES) {
    lanes.set(lane.id, []);
  }
  for (const item of items) {
    lanes.get(item.laneId)?.push(item);
  }
  return lanes;
}

export function ProcedureDayBoard({ data }: { data: ProcedureDayBoardPayload }) {
  const base = `/fi-admin/${data.tenantId}`;
  const tz = data.window.calendarTimezone.trim();
  const dateLine = formatCalendarLongWeekdayDate(data.window.todayYmd, tz);
  const flatCards = data.scheduleGroups.flatMap((g) => g.cards);

  const snapshotCards = buildProcedureDaySnapshotCards(base, data);
  const priorityItems = buildProcedureDayPriorities(base, data, 5);
  const laneGroups = groupByLane(flatCards);
  const roomTeamRows = buildRoomTeamCoordination(flatCards);
  const postOpRows = buildPostOpDischargeReadiness(flatCards);

  return (
    <div className="mx-auto min-w-0 max-w-[88rem] space-y-8 pb-10 sm:space-y-10 sm:pb-14">
      <DashboardCard elevated className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_260px_at_0%_0%,rgba(34,193,255,0.11),transparent_55%),radial-gradient(420px_200px_at_100%_100%,rgba(124,58,237,0.07),transparent_50%)]"
          aria-hidden
        />
        <div className="relative border-l-4 border-[#22C1FF]/80 pl-5 sm:pl-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#22C1FF]/95">
            FI OS · Surgery
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC] sm:text-4xl">
            Procedure Day
          </h1>
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-[#94A3B8]">
            Live surgical day coordination across arrivals, preparation, procedure progress, rooms,
            team, and recovery.
          </p>
          <p className="mt-2 text-sm text-[#64748B]">{dateLine}</p>
          <ProcedureDayPrimaryActions base={base} todayYmd={data.window.todayYmd} />
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="pd-snapshot-heading">
        <SectionHeader
          id="pd-snapshot-heading"
          kicker="Live"
          title="Live procedure snapshot"
          description="Today's surgical theatre signals at a glance."
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

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="pd-priorities-heading">
        <SectionHeader
          id="pd-priorities-heading"
          kicker="Now"
          title="What needs action now"
          description="Immediate surgical day priorities."
          className="mb-4"
        />
        {priorityItems.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
            <p className="text-sm leading-relaxed text-[#CBD5E1]">
              Today&apos;s surgical flow is under control.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {priorityItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href ?? `${base}/procedure-day`}
                  className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-4 transition hover:border-[#22C1FF]/30 ${surgicalAttentionSeverityClass(item.severity)}`}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#F8FAFC]">{item.headline}</p>
                    {item.detail ? (
                      <p className="mt-1 text-sm text-[#94A3B8]">{item.detail}</p>
                    ) : null}
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#22C1FF]/70" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="pd-flow-heading">
        <SectionHeader
          id="pd-flow-heading"
          kicker="Flow"
          title="Today's surgical flow"
          description="Move patients through scheduled, preparation, procedure, recovery, and completion."
          className="mb-4"
        />
        {flatCards.length === 0 ? (
          <p className="text-sm text-[#64748B]">No active surgery bookings for today.</p>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-[960px] gap-3 xl:min-w-0 xl:grid xl:grid-cols-5 xl:gap-3">
              {PROCEDURE_DAY_FLOW_LANES.map((lane) => {
                const laneItems = laneGroups.get(lane.id) ?? [];
                return (
                  <section
                    key={lane.id}
                    aria-label={lane.label}
                    className="flex min-h-[180px] w-[min(100%,14rem)] shrink-0 flex-col rounded-xl border border-white/[0.08] bg-[#0a101f]/60 p-3 xl:w-auto"
                  >
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      {lane.label}
                      <span className="ml-1 tabular-nums text-[#475569]">({laneItems.length})</span>
                    </h3>
                    <div className="mt-3 flex flex-1 flex-col gap-2">
                      {laneItems.length === 0 ? (
                        <p className="py-4 text-center text-xs text-[#475569]">—</p>
                      ) : (
                        laneItems.map((item) => (
                          <FlowProcedureCard key={item.card.bookingId} base={base} item={item} />
                        ))
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </DashboardCard>

      {roomTeamRows.length > 0 ? (
        <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="pd-room-team-heading">
          <SectionHeader
            id="pd-room-team-heading"
            kicker="Theatre"
            title="Room / team coordination"
            description="Theatre status, surgical team readiness, and handoff progress."
            className="mb-4"
          />
          <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#0c1220]/75">
            {roomTeamRows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <Link href={row.href} className="font-medium text-[#F8FAFC] hover:text-[#22C1FF]">
                    {row.patientLabel}
                  </Link>
                  <p className="mt-1 text-xs text-[#64748B]">
                    {row.roomLabel} · {row.teamLabel}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className="text-[#94A3B8]">{row.handoffLabel}</p>
                  <p
                    className={cn(
                      "mt-0.5",
                      row.readinessLabel.includes("gap") ? "text-amber-300" : "text-[#64748B]"
                    )}
                  >
                    {row.readinessLabel}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </DashboardCard>
      ) : null}

      {postOpRows.length > 0 ? (
        <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="pd-postop-heading">
          <SectionHeader
            id="pd-postop-heading"
            kicker="Discharge"
            title="Post-op and discharge readiness"
            description="Post-op instructions, medication handoff, payment, and audit reminders."
            className="mb-4"
          />
          <ul className="space-y-2">
            {postOpRows.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-3 text-sm transition hover:border-[#22C1FF]/25"
                >
                  <span className="font-medium text-[#F8FAFC]">{row.patientLabel}</span>
                  <div className="flex flex-wrap gap-2 text-[0.65rem]">
                    <span className={row.postOpReady ? "text-emerald-400" : "text-amber-400"}>
                      Post-op {row.postOpReady ? "ready" : "pending"}
                    </span>
                    <span className={row.medicationHandoff ? "text-emerald-400" : "text-amber-400"}>
                      Meds {row.medicationHandoff ? "ready" : "pending"}
                    </span>
                    <span className={row.paymentCleared ? "text-emerald-400" : "text-amber-400"}>
                      Payment {row.paymentCleared ? "clear" : "review"}
                    </span>
                    {row.auditReminder ? (
                      <span className="text-violet-300">Audit photo reminder</span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
      ) : null}

      <ProcedureDaySystemDiagnostics payload={data} />
    </div>
  );
}
