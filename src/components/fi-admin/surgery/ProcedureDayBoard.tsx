"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { formatCalendarLongWeekdayDate } from "@/src/lib/calendar/calendarTimezone";
import type { ProcedureDayBoardPayload, ProcedureDayScheduleCard } from "@/src/lib/surgery/procedureDayBoardLoader.server";
import { CopyProcedureDayLinkButton } from "@/src/components/fi-admin/cases/CopyProcedureDayLinkButton";
import { FinancialSurgeryPipelineInline } from "@/src/components/fi/financial/FinancialSurgeryPipelineInline";
import { SURGERY_READINESS_ISSUE_LABEL, type SurgeryReadinessIssueSeverity } from "@/src/lib/surgery/surgeryReadinessBoardModel";

function severityChipClass(sev: SurgeryReadinessIssueSeverity): string {
  if (sev === "high_risk") return "border-rose-500/40 bg-rose-500/15 text-rose-100";
  if (sev === "warning") return "border-amber-500/35 bg-amber-500/10 text-amber-100";
  return "border-slate-600/40 bg-slate-800/60 text-slate-400";
}

function SummaryTile(props: { label: string; value: number | string; sub?: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-xl border px-3 py-3 shadow-inner shadow-black/25 backdrop-blur-sm",
        props.highlight ? "border-cyan-500/30 bg-cyan-500/[0.08]" : "border-white/[0.07] bg-[#0c1426]/70",
      )}
    >
      <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{props.label}</p>
      <p className="mt-2 font-mono text-xl font-semibold tabular-nums tracking-tight text-slate-50">{props.value}</p>
      {props.sub ? <p className="mt-1 text-[0.7rem] leading-snug text-slate-500">{props.sub}</p> : null}
    </div>
  );
}

function CheckCell({ ok }: { ok: boolean }) {
  return <span className={ok ? "text-emerald-400" : "text-amber-400"}>{ok ? "Yes" : "No"}</span>;
}

function ScheduleCard({ c, tenantId }: { c: ProcedureDayScheduleCard; tenantId: string }) {
  const displayIssues = c.issues.filter((i) => i.kind !== "no_payment_tracking").slice(0, 6);
  return (
    <article className="rounded-lg border border-white/[0.06] bg-[#0a101f]/90 p-3 text-sm text-slate-200 shadow-sm shadow-black/30">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={c.hrefs.appointment} className="truncate font-semibold text-slate-50 hover:text-cyan-200">
            {c.patientLabel}
          </Link>
          <p className="mt-0.5 text-xs text-slate-500">
            {c.caseId ? (
              <Link href={c.hrefs.case!} className="text-cyan-200/90 hover:underline">
                Case
              </Link>
            ) : (
              <span className="text-amber-200/90">No linked case</span>
            )}
            {c.caseLabel ? <span className="text-slate-600"> · </span> : null}
            {c.caseLabel ? <span className="text-slate-400">{c.caseLabel}</span> : null}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-white/[0.08] bg-black/30 px-2 py-0.5 text-[0.65rem] font-medium text-slate-400">
          {c.bookingStatusLabel}
        </span>
      </div>
      <dl className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
        <div className="flex gap-1 sm:col-span-2">
          <dt className="shrink-0 text-slate-600">Procedure</dt>
          <dd className="min-w-0 text-slate-300">{c.procedureType ?? "—"}</dd>
        </div>
        {c.graftTargetLabel ? (
          <div className="flex gap-1 sm:col-span-2">
            <dt className="shrink-0 text-slate-600">Graft target</dt>
            <dd className="font-mono text-slate-300">{c.graftTargetLabel}</dd>
          </div>
        ) : null}
        <div className="flex gap-1">
          <dt className="shrink-0 text-slate-600">Surgeon</dt>
          <dd className="min-w-0 truncate text-slate-300">{c.procedureSurgeonLabel ?? "—"}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="shrink-0 text-slate-600">Nurse</dt>
          <dd className="min-w-0 truncate text-slate-300">{c.procedureNurseLabel ?? "—"}</dd>
        </div>
        <div className="flex gap-1 sm:col-span-2">
          <dt className="shrink-0 text-slate-600">Technicians</dt>
          <dd className="min-w-0 text-slate-300">{c.procedureTechnicianLabels.length ? c.procedureTechnicianLabels.join(", ") : "—"}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="shrink-0 text-slate-600">Calendar team</dt>
          <dd className="min-w-0 truncate text-slate-300">{c.calendarAssigneeLabel ?? "—"}</dd>
        </div>
        <div className="flex gap-1 sm:col-span-2">
          <dt className="shrink-0 text-slate-600">Room</dt>
          <dd className="min-w-0 text-slate-300">
            {c.roomLabel ?? "—"}
            {c.procedureRoomText ? <span className="text-slate-600"> · Proc. notes: {c.procedureRoomText}</span> : null}
          </dd>
        </div>
        {c.teamMemberLabels.length ? (
          <div className="flex gap-1 sm:col-span-2">
            <dt className="shrink-0 text-slate-600">Additional team</dt>
            <dd className="min-w-0 text-slate-300">{c.teamMemberLabels.join(", ")}</dd>
          </div>
        ) : null}
        <div className="flex gap-1">
          <dt className="shrink-0 text-slate-600">Readiness</dt>
          <dd className="text-slate-300">
            {c.readinessPercent != null ? <span className="font-mono">{c.readinessPercent}%</span> : null}
            {c.readinessPercent != null && c.readinessBucketLabel ? <span className="text-slate-600"> · </span> : null}
            {c.readinessBucketLabel ?? "—"}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="shrink-0 text-slate-600">Deposit</dt>
          <dd className="text-slate-300">{c.surgeryDepositBadge ?? "No manual record"}</dd>
        </div>
      </dl>
      <FinancialSurgeryPipelineInline tenantId={tenantId} caseId={c.caseId} status={c.financialPipeline} variant="dark" />
      {displayIssues.length ? (
        <ul className="mt-2 space-y-1">
          {displayIssues.map((it) => (
            <li
              key={it.kind}
              className={cn("flex flex-wrap items-center gap-1.5 rounded border px-2 py-1 text-[0.68rem]", severityChipClass(it.severity))}
            >
              <span className="font-medium">{SURGERY_READINESS_ISSUE_LABEL[it.kind]}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.65rem] text-slate-600">
        <Link href={c.hrefs.calendar} className="text-cyan-200/80 hover:underline">
          Calendar
        </Link>
        {c.hrefs.patient ? (
          <>
            <span className="text-slate-700">·</span>
            <Link href={c.hrefs.patient} className="text-cyan-200/80 hover:underline">
              Patient
            </Link>
          </>
        ) : null}
        {c.hrefs.case ? (
          <>
            <span className="text-slate-700">·</span>
            <CopyProcedureDayLinkButton relativeHref={c.hrefs.case} />
          </>
        ) : null}
      </p>
    </article>
  );
}

export function ProcedureDayBoard({ data }: { data: ProcedureDayBoardPayload }) {
  const base = `/fi-admin/${data.tenantId}`;
  const tz = data.window.calendarTimezone.trim();
  const dateLine = formatCalendarLongWeekdayDate(data.window.todayYmd, tz);
  const flatCards = data.scheduleGroups.flatMap((g) => g.cards);
  const pc = data.procedureProgressCounts;

  return (
    <div className="space-y-6 pb-8 sm:space-y-7">
      <header className="flex flex-col gap-3 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/85">SurgeryOS · Procedure day</p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">Procedure day board</h1>
          <p className="mt-1 text-sm text-slate-500">{dateLine}</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Tenant-local today <span className="font-mono text-slate-400">{data.window.todayYmd}</span>
            <span className="text-slate-600"> · </span>
            <span className="font-mono text-slate-400">{tz}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Link
            href={`${base}/calendar?date=${encodeURIComponent(data.window.todayYmd)}`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-cyan-100/95")}
          >
            Open calendar
          </Link>
          <Link
            href={`${base}/surgery-readiness`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-200")}
          >
            Surgery readiness
          </Link>
          <Link
            href={`${base}/operations`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-200")}
          >
            Operations centre
          </Link>
        </div>
      </header>

      <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="pd-summary-heading">
        <SectionHeader
          id="pd-summary-heading"
          title="Surgery day summary"
          description="Active surgery bookings starting today in the tenant operational calendar."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile label="Surgeries today" value={data.summary.surgeriesToday} highlight />
          <SummaryTile label="Ready (worklist)" value={data.summary.ready} sub="Not started; readiness bucket ready." />
          <SummaryTile label="In progress" value={data.summary.inProgress} sub="Arrived booking or active procedure status." />
          <SummaryTile label="Completed" value={data.summary.completed} sub="Booking or procedure marked complete." />
          <SummaryTile
            label="High-risk readiness"
            value={data.summary.highRiskReadinessIssues}
            sub="Escalated readiness issues on today’s row set."
          />
          <SummaryTile label="Unassigned surgeon / team" value={data.summary.unassignedSurgeonOrTeam} />
          <SummaryTile label="Missing room" value={data.summary.missingRoom} sub="Only when room_required on the booking." />
        </div>
      </DashboardCard>

      <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="pd-schedule-heading">
        <SectionHeader id="pd-schedule-heading" title="Surgery schedule" description="Grouped by local booking start time." />
        {data.scheduleGroups.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No active surgery bookings for today in this window.</p>
        ) : (
          <div className="mt-4 space-y-6">
            {data.scheduleGroups.map((g) => (
              <section key={g.sortKey} aria-label={`Surgeries at ${g.timeLabel}`}>
                <h3 className="text-sm font-semibold text-cyan-200/90">{g.timeLabel}</h3>
                <ul className="mt-2 space-y-3">
                  {g.cards.map((c) => (
                    <li key={c.bookingId}>
                      <ScheduleCard c={c} tenantId={data.tenantId} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </DashboardCard>

      <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="pd-proc-heading">
        <SectionHeader
          id="pd-proc-heading"
          title="Procedure progress"
          description="From fi_case_procedures when present for linked cases."
        />
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <SummaryTile label="Scheduled" value={pc.scheduled} />
          <SummaryTile label="In progress" value={pc.inProgress} />
          <SummaryTile label="Completed" value={pc.completed} />
          <SummaryTile label="Cancelled / aborted" value={pc.cancelled} />
        </div>
        {flatCards.some((c) => c.procedureProgress.rowExists) ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-white/[0.06]">
            <table className="min-w-full text-left text-xs text-slate-300">
              <thead className="border-b border-white/[0.06] bg-black/30 text-[0.62rem] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">Finish</th>
                  <th className="px-3 py-2">Extraction / implantation</th>
                </tr>
              </thead>
              <tbody>
                {flatCards
                  .filter((c) => c.procedureProgress.rowExists)
                  .map((c) => (
                    <tr key={c.bookingId} className="border-b border-white/[0.04]">
                      <td className="px-3 py-2">
                        <Link href={c.hrefs.case ?? c.hrefs.appointment} className="font-medium text-cyan-100/90 hover:underline">
                          {c.patientLabel}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{c.procedureProgress.statusLabel ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-[0.7rem]">{c.procedureProgress.startTime ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-[0.7rem]">{c.procedureProgress.finishTime ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-400">{c.procedureProgress.extractionImplantSummary ?? "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No procedure day rows yet for today’s linked cases.</p>
        )}
      </DashboardCard>

      <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="pd-preop-heading">
        <SectionHeader id="pd-preop-heading" title="Pre-op checklist" description="Derived signals only — no new tables." />
        {flatCards.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nothing scheduled.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-white/[0.06]">
            <table className="min-w-full text-left text-xs text-slate-300">
              <thead className="border-b border-white/[0.06] bg-black/30 text-[0.62rem] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Case</th>
                  <th className="px-3 py-2">Consent</th>
                  <th className="px-3 py-2">Pathology</th>
                  <th className="px-3 py-2">Deposit</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Surgeon</th>
                  <th className="px-3 py-2">Room</th>
                </tr>
              </thead>
              <tbody>
                {flatCards.map((c) => (
                  <tr key={c.bookingId} className="border-b border-white/[0.04]">
                    <td className="px-3 py-2">
                      <Link href={c.hrefs.appointment} className="font-medium text-cyan-100/90 hover:underline">
                        {c.patientLabel}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <CheckCell ok={c.preOp.caseLinked} />
                    </td>
                    <td className="px-3 py-2">
                      <CheckCell ok={c.preOp.consentProxy} />
                    </td>
                    <td className="px-3 py-2">
                      <CheckCell ok={c.preOp.pathologyReviewed} />
                    </td>
                    <td className="px-3 py-2">
                      <CheckCell ok={c.preOp.depositOkOrUntracked} />
                    </td>
                    <td className="px-3 py-2">
                      <CheckCell ok={c.preOp.procedurePlanComplete} />
                    </td>
                    <td className="px-3 py-2">
                      <CheckCell ok={c.preOp.surgeonAssigned} />
                    </td>
                    <td className="px-3 py-2">
                      <CheckCell ok={c.preOp.roomOk} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>

      <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="pd-team-heading">
        <SectionHeader
          id="pd-team-heading"
          title="Team assignment"
          description="Calendar uses fi_staff / fi_users; procedure day uses fi_users on fi_case_procedures (surgeon, nurse, technicians, and optional legacy team list)."
        />
        {flatCards.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nothing scheduled.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/[0.06] rounded-lg border border-white/[0.06] bg-[#0a101f]/80">
            {flatCards.map((c) => {
              const warn = !c.calendarAssigneeLabel && !c.procedureSurgeonLabel;
              return (
                <li key={c.bookingId} className="px-3 py-3 text-sm text-slate-300">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={c.hrefs.appointment} className="font-medium text-slate-100 hover:text-cyan-200">
                      {c.patientLabel}
                    </Link>
                    {warn ? (
                      <span className="rounded border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[0.65rem] text-amber-100">
                        Unassigned surgeon / team
                      </span>
                    ) : null}
                  </div>
                  <dl className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-600">Surgeon (procedure record)</dt>
                      <dd className="text-slate-300">{c.procedureSurgeonLabel ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-600">Nurse</dt>
                      <dd className="text-slate-500">Not stored in fi_case_procedures V1</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-slate-600">Technicians / assistants (procedure team user ids)</dt>
                      <dd className="text-slate-300">{c.teamMemberLabels.length ? c.teamMemberLabels.join(", ") : "—"}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-slate-600">Calendar assignee</dt>
                      <dd className="text-slate-300">{c.calendarAssigneeLabel ?? "—"}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="pd-actions-heading">
        <SectionHeader id="pd-actions-heading" title="Action list" description="Operational follow-ups for today’s list." />
        {data.actions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No automated actions — nice work.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.actions.map((a, idx) => (
              <li key={`${a.bookingId}-${a.kind}-${idx}`}>
                <Link href={a.href} className="flex flex-col rounded-lg border border-white/[0.06] bg-[#0a101f]/80 px-3 py-2 text-sm hover:border-cyan-500/25">
                  <span className="font-medium text-slate-100">{a.label}</span>
                  <span className="text-xs text-slate-500">{a.patientLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>
    </div>
  );
}
