import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { OperationsSystemDiagnostics } from "@/src/components/fi-admin/operations/OperationsSystemDiagnostics";
import {
  attentionSeverityClass,
  buildCoordinationPriorities,
  buildFinancialBlockers,
  buildLiveClinicFlowCards,
  buildMovementBoardItems,
  buildRoomOverview,
  buildStaffCoordinationSummary,
  MOVEMENT_LANES,
  operationsCentreLinkButtonClass,
} from "@/src/lib/fiAdmin/operationsCentrePresentation";
import { formatCalendarLongWeekdayDate } from "@/src/lib/calendar/calendarTimezone";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

function OperationsCentrePrimaryActions({ base }: { base: string }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <Link href={`${base}/calendar`} className={operationsCentreLinkButtonClass}>
        Open Calendar
      </Link>
      <Link href={`${base}/reception`} className={operationsCentreLinkButtonClass}>
        Open Reception Board
      </Link>
      <Link href={`${base}/procedure-day`} className={operationsCentreLinkButtonClass}>
        Open Procedure Day
      </Link>
      <Link href={`${base}/tomorrow`} className={operationsCentreLinkButtonClass}>
        Open Tomorrow Board
      </Link>
      <Link href={`${base}/calendar`} className={operationsCentreLinkButtonClass}>
        Quick Create Booking
      </Link>
    </div>
  );
}

/**
 * ClinicOS Operations Centre — live day-of clinic coordination workspace.
 */
export function ClinicOsOperationsCentre(props: {
  data: TenantOperationalDashboard;
  showCrmNav: boolean;
  showDiagnosticsExpanded?: boolean;
}) {
  const { data, showCrmNav, showDiagnosticsExpanded = false } = props;
  const base = `/fi-admin/${data.tenantId}`;
  const tz = data.operationalDay.calendarTimezone.trim();
  const dateLine = formatCalendarLongWeekdayDate(data.operationalDay.todayYmd, tz);

  const flowCards = buildLiveClinicFlowCards(base, data);
  const coordinationItems = buildCoordinationPriorities(base, data, showCrmNav, 5);
  const movementLanes = buildMovementBoardItems(base, data, 4);
  const roomOverview = buildRoomOverview(data.receptionBoard.cards);
  const visitsToday =
    data.clinicToday.consultations + data.clinicToday.surgeries + data.clinicToday.followUps + data.clinicToday.prp;
  const staffSummary = buildStaffCoordinationSummary(data.quickStats, data.actionCentre, visitsToday);
  const financialBlockers = buildFinancialBlockers(base, data.paymentCommercialKpis, data.actionCentre);
  const movementHasItems = MOVEMENT_LANES.some((lane) => movementLanes[lane.id].length > 0);

  return (
    <div className="mx-auto min-w-0 max-w-[88rem] space-y-8 pb-10 sm:space-y-10 sm:pb-14">
      <DashboardCard elevated className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_260px_at_0%_0%,rgba(34,193,255,0.11),transparent_55%),radial-gradient(420px_200px_at_100%_100%,rgba(124,58,237,0.07),transparent_50%)]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4">
          <div className="border-l-4 border-[#22C1FF]/80 pl-5 sm:pl-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#22C1FF]/95">FI OS</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC] sm:text-4xl">Operations Centre</h1>
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-[#94A3B8]">
              Live clinic coordination across arrivals, consultations, procedures, rooms, payments, and patient movement.
            </p>
            <p className="mt-2 text-sm text-[#64748B]">
              {data.tenantName} · {dateLine}
            </p>
            <OperationsCentrePrimaryActions base={base} />
          </div>
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="ops-live-flow-heading">
        <SectionHeader
          id="ops-live-flow-heading"
          kicker="Today"
          title="Live clinic flow"
          description="Right-now signals for today's clinic day — open linked boards for full detail."
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {flowCards.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className="group flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-4 transition hover:border-[#22C1FF]/25"
            >
              <p className="text-sm font-semibold text-[#F8FAFC]">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-[#F8FAFC]">{card.value}</p>
              <p className="mt-2 text-xs leading-relaxed text-[#64748B]">{card.detail}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#22C1FF]/80 opacity-0 transition group-hover:opacity-100">
                Open <ArrowRight className="h-3 w-3" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="ops-coordination-heading">
        <SectionHeader
          id="ops-coordination-heading"
          kicker="Priorities"
          title="What needs coordination"
          description="Top operational priorities for today — act here first."
          className="mb-4"
        />
        {coordinationItems.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
            <p className="text-sm leading-relaxed text-[#CBD5E1]">
              No urgent coordination issues detected. Clinic flow is currently under control.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {coordinationItems.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-4 transition hover:border-[#22C1FF]/30 ${attentionSeverityClass(item.severity)}`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#F8FAFC]">{item.headline}</p>
                      {item.detail ? <p className="mt-1 text-sm text-[#94A3B8]">{item.detail}</p> : null}
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#22C1FF]/70" aria-hidden />
                  </Link>
                ) : (
                  <div className={`rounded-xl border px-4 py-4 ${attentionSeverityClass(item.severity)}`}>
                    <p className="font-semibold text-[#F8FAFC]">{item.headline}</p>
                    {item.detail ? <p className="mt-1 text-sm text-[#94A3B8]">{item.detail}</p> : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="ops-movement-heading">
        <SectionHeader
          id="ops-movement-heading"
          kicker="Movement"
          title="Today's movement board"
          description="Lightweight patient flow by operational state — open Reception Board for full front-desk control."
          className="mb-4"
        />
        {!movementHasItems ? (
          <p className="text-sm text-[#94A3B8]">
            Today&apos;s visits will appear here as appointments are scheduled. Open the calendar to add bookings.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {MOVEMENT_LANES.map((lane) => {
              const items = movementLanes[lane.id];
              return (
                <div
                  key={lane.id}
                  className="rounded-xl border border-white/[0.08] bg-[#0c1220]/50 p-3 sm:p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748B]">{lane.label}</p>
                  {items.length === 0 ? (
                    <p className="mt-3 text-xs text-[#64748B]">No patients in this state.</p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-lg border border-white/[0.06] bg-[#081020]/60 px-3 py-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-[#F8FAFC]">{item.patientName}</p>
                            <span className="shrink-0 font-mono text-xs tabular-nums text-[#22C1FF]/90">
                              {item.timeLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[#94A3B8]">
                            {item.serviceLabel} · {item.stateLabel}
                          </p>
                          <p className="mt-2 text-xs leading-relaxed text-[#64748B]">{item.nextAction}</p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {item.patientHref ? (
                              <Link href={item.patientHref} className={operationsCentreLinkButtonClass}>
                                Open patient
                              </Link>
                            ) : null}
                            <Link href={item.bookingHref} className={operationsCentreLinkButtonClass}>
                              Open booking
                            </Link>
                            <Link href={item.receptionHref} className={operationsCentreLinkButtonClass}>
                              Reception Board
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DashboardCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="ops-rooms-heading">
          <SectionHeader
            id="ops-rooms-heading"
            kicker="Resources"
            title="Room and resource overview"
            description="Compact view of room usage for today's clinic."
            className="mb-4"
          />
          {roomOverview.hasRoomAssignments ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-white/[0.08] bg-[#0c1220]/60 px-4 py-3">
                <dt className="text-xs text-[#64748B]">Rooms active</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-[#F8FAFC]">{roomOverview.roomsActive}</dd>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#0c1220]/60 px-4 py-3">
                <dt className="text-xs text-[#64748B]">Procedure rooms in use</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-[#F8FAFC]">
                  {roomOverview.procedureRoomsInUse}
                </dd>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#0c1220]/60 px-4 py-3">
                <dt className="text-xs text-[#64748B]">Treatment rooms in use</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-[#F8FAFC]">
                  {roomOverview.treatmentRoomsInUse}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-[#94A3B8]">
              Room usage will become clearer as bookings are assigned to rooms.
            </p>
          )}
        </DashboardCard>

        <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="ops-staff-heading">
          <SectionHeader
            id="ops-staff-heading"
            kicker="Team"
            title="Staff coordination"
            description="Day-of staff readiness — not a full workforce view."
            className="mb-4"
          />
          {staffSummary.hasData ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-white/[0.08] bg-[#0c1220]/60 px-4 py-3">
                <p className="text-xs text-[#64748B]">Staff scheduled today</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-[#F8FAFC]">
                  {staffSummary.staffScheduledToday}
                </p>
              </div>
              {staffSummary.coverageWarning ? (
                <p className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3 text-[#CBD5E1]">
                  {staffSummary.coverageWarning}
                </p>
              ) : null}
              {staffSummary.procedureTeamBlockers > 0 ? (
                <p className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] px-4 py-3 text-[#CBD5E1]">
                  {staffSummary.procedureTeamBlockers} procedure preparation{" "}
                  {staffSummary.procedureTeamBlockers === 1 ? "item needs" : "items need"} attention before surgery day.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[#94A3B8]">
              Staff coordination will appear here as rosters and assignments are connected.
            </p>
          )}
        </DashboardCard>
      </div>

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="ops-financial-heading">
        <SectionHeader
          id="ops-financial-heading"
          kicker="Payments"
          title="Financial blockers"
          description="Focused payment items that may block today's treatment — open FinancialOS for the full view."
          className="mb-4"
        />
        {financialBlockers.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No payment blockers flagged for today&apos;s clinic flow.</p>
        ) : (
          <ul className="space-y-2">
            {financialBlockers.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0c1220]/60 px-4 py-3 transition hover:border-[#22C1FF]/25"
                >
                  <span className="text-sm font-medium text-[#F8FAFC]">{item.label}</span>
                  <span className="rounded-lg bg-white/[0.04] px-2.5 py-1 font-mono text-sm font-semibold tabular-nums text-[#94A3B8]">
                    {item.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4">
          <Link href={`${base}/financial/dashboard`} className="text-sm font-semibold text-[#22C1FF] hover:underline">
            Open FinancialOS →
          </Link>
        </p>
      </DashboardCard>

      <OperationsSystemDiagnostics
        data={data}
        showCrmNav={showCrmNav}
        showDiagnosticsExpanded={showDiagnosticsExpanded}
      />
    </div>
  );
}
