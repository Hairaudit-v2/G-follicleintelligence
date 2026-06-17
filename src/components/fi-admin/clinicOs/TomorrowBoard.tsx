import Link from "next/link";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { FinancialPaymentPathwayBadge } from "@/src/components/fi/financial/FinancialPaymentPathwayBadge";
import { FinancialClearancePanel } from "@/src/components/fi/financial/FinancialClearancePanel";
import { FinancialSurgeryPipelineInline } from "@/src/components/fi/financial/FinancialSurgeryPipelineInline";
import { formatCalendarLongWeekdayDate } from "@/src/lib/calendar/calendarTimezone";
import type { TomorrowBoardPayload } from "@/src/lib/clinicOs/tomorrowBoardLoader.server";
import { FINANCIAL_SURGERY_PIPELINE_UNAVAILABLE_COPY } from "@/src/lib/financialOs/financialSurgeryPipelineStatusCore";
import { SURGERY_READINESS_ISSUE_LABEL } from "@/src/lib/surgery/surgeryReadinessBoardModel";

const CHECKLIST_FLAG_LABEL: Record<string, string> = {
  confirmation_incomplete: "Confirmation incomplete",
  no_patient_lead_anchor: "No patient / lead anchor",
  missing_contact: "Missing phone & email on person",
  manual_payment_pending: "Manual payment record pending",
  consent_pending: "Forms / consent (consultation proxy) pending",
};

function SummaryTile(props: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-white/[0.07] bg-[#0c1426]/70 px-3 py-3 shadow-inner shadow-black/25 backdrop-blur-sm">
      <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{props.label}</p>
      <p className="mt-2 font-mono text-xl font-semibold tabular-nums tracking-tight text-slate-50">{props.value}</p>
      {props.sub ? <p className="mt-1 text-[0.7rem] leading-snug text-slate-500">{props.sub}</p> : null}
    </div>
  );
}

export function TomorrowBoard({ data }: { data: TomorrowBoardPayload }) {
  const base = `/fi-admin/${data.tenantId}`;
  const tz = data.window.calendarTimezone.trim();
  const dateLine = formatCalendarLongWeekdayDate(data.window.tomorrowYmd, tz);

  return (
    <div className="space-y-6 pb-8 sm:space-y-7">
      <header className="flex flex-col gap-3 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/85">ClinicOS · Tomorrow board</p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">Tomorrow readiness</h1>
          <p className="mt-1 text-sm text-slate-500">{dateLine}</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Operational tomorrow <span className="font-mono text-slate-400">{data.window.tomorrowYmd}</span>
            <span className="text-slate-600"> · </span>
            <span className="font-mono text-slate-400">{tz}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Link
            href={`${base}/calendar?date=${encodeURIComponent(data.window.tomorrowYmd)}`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-cyan-100/95")}
          >
            Open calendar
          </Link>
          <Link
            href={`${base}/operations`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-200")}
          >
            Operations centre
          </Link>
          <Link
            href={`${base}/surgery-readiness`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-200")}
          >
            Surgery readiness
          </Link>
          <Link
            href={`${base}/procedure-day`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-200")}
          >
            Procedure day
          </Link>
        </div>
      </header>

      <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="tomorrow-summary-heading">
        <SectionHeader id="tomorrow-summary-heading" title="Tomorrow summary" description="Counts for tenant-local tomorrow (active agenda statuses)." />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile label="Consultations" value={data.summary.consultations} />
          <SummaryTile label="Surgeries" value={data.summary.surgeries} />
          <SummaryTile label="PRP / treatments" value={data.summary.prpTreatments} />
          <SummaryTile label="Follow-ups" value={data.summary.followUps} />
          <SummaryTile label="Other" value={data.summary.other} />
          <SummaryTile label="Total patients (distinct)" value={data.summary.totalPatients} />
          <SummaryTile
            label="High-risk surgery items"
            value={data.summary.highRiskSurgeryItems}
            sub="Pathology, timing, or deposit escalation."
          />
          <SummaryTile
            label="Surgery payments due"
            value={data.summary.paymentsDueSurgery}
            sub="Manual `fi_payment_records` only when present."
          />
        </div>
      </DashboardCard>

      <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="tomorrow-schedule-heading">
        <SectionHeader id="tomorrow-schedule-heading" title="Tomorrow schedule" description="Grouped by local start time." />
        {data.scheduleGroups.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No active bookings for tomorrow in this window.</p>
        ) : (
          <div className="mt-4 space-y-6">
            {data.scheduleGroups.map((g) => (
              <section key={g.sortKey} aria-label={`Appointments at ${g.timeLabel}`}>
                <h3 className="text-sm font-semibold text-cyan-200/90">{g.timeLabel}</h3>
                <ul className="mt-2 divide-y divide-white/[0.06] rounded-lg border border-white/[0.06] bg-[#0a101f]/80">
                  {g.rows.map((r) => (
                    <li key={r.bookingId} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <Link href={r.href} className="font-medium text-slate-100 hover:text-cyan-200">
                              {r.patientLabel}
                            </Link>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {r.bookingTypeLabel}
                              {r.providerLabel ? (
                                <>
                                  <span className="text-slate-600"> · </span>
                                  {r.providerLabel}
                                </>
                              ) : null}
                              {r.roomLabel ? (
                                <>
                                  <span className="text-slate-600"> · </span>
                                  {r.roomLabel}
                                </>
                              ) : null}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md border border-white/[0.08] bg-black/30 px-2 py-0.5 text-[0.65rem] text-slate-400">
                              {r.statusLabel}
                            </span>
                            {r.paymentBadge ? (
                              <span
                                className={cn(
                                  "rounded-md border px-2 py-0.5 text-[0.65rem]",
                                  r.paymentBadge === "Payment due"
                                    ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
                                    : "border-slate-600/40 bg-slate-800/60 text-slate-300",
                                )}
                              >
                                {r.paymentBadge}
                              </span>
                            ) : null}
                            {r.reminderAttention ? (
                              <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[0.65rem] text-violet-100">
                                Reminder queue
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {r.financialPipeline ? (
                          <>
                            <FinancialSurgeryPipelineInline
                              tenantId={data.tenantId}
                              caseId={r.caseId}
                              status={r.financialPipeline}
                              variant="dark"
                            />
                            {r.financialClearance ? (
                              <FinancialClearancePanel
                                tenantId={data.tenantId}
                                clearance={r.financialClearance}
                                currency={r.financialPipeline.currency}
                                variant="dark"
                                compact
                              />
                            ) : null}
                            <div className="mt-1.5">
                              <FinancialPaymentPathwayBadge summary={r.financialPipeline.paymentPathway} variant="dark" />
                            </div>
                          </>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </DashboardCard>

      <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="tomorrow-surgery-heading">
        <SectionHeader
          id="tomorrow-surgery-heading"
          title="Surgery readiness (tomorrow)"
          description="Same signals as the Surgery Readiness board, scoped to tomorrow’s surgery bookings."
        />
        {data.surgeryReadiness.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No surgery bookings tomorrow.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.surgeryReadiness.map((row) => (
              <li key={row.bookingId} className="rounded-lg border border-white/[0.06] bg-[#0a101f]/90 p-3 text-sm text-slate-200">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-50">{row.patientLabel}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {row.surgeryLocalYmd}
                      <span className="text-slate-600"> · </span>
                      {row.bookingTimeKey
                        ? new Intl.DateTimeFormat("en-GB", {
                            timeZone: data.window.calendarTimezone,
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          }).format(new Date(row.bookingTimeKey))
                        : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md border border-white/[0.08] bg-black/30 px-2 py-0.5 text-[0.65rem] text-slate-400">
                    {row.bookingStatus}
                  </span>
                </div>
                <div
                  className={cn(
                    "mt-2",
                    row.financialPipeline?.payment_attention_required &&
                      "rounded-md border border-rose-500/40 bg-rose-500/[0.12] py-2 pl-3 pr-2 shadow-[inset_3px_0_0_0_rgba(251,113,133,0.85)]",
                  )}
                  role={row.financialPipeline?.payment_attention_required ? "status" : undefined}
                  aria-label={
                    row.financialPipeline?.payment_attention_required ? "Financial pipeline requires attention" : undefined
                  }
                >
                  {row.financialPipeline ? (
                    <div className={row.financialPipeline.payment_attention_required ? "[&>div]:mt-0" : undefined}>
                      <FinancialSurgeryPipelineInline
                        tenantId={data.tenantId}
                        caseId={row.caseId}
                        status={row.financialPipeline}
                        variant="dark"
                        compact
                      />
                      {row.financialClearance ? (
                        <FinancialClearancePanel
                          tenantId={data.tenantId}
                          clearance={row.financialClearance}
                          currency={row.financialPipeline.currency}
                          variant="dark"
                          compact
                        />
                      ) : null}
                      <div className="mt-1.5">
                        <FinancialPaymentPathwayBadge summary={row.financialPipeline.paymentPathway} variant="dark" />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[0.65rem] leading-snug text-slate-500">{FINANCIAL_SURGERY_PIPELINE_UNAVAILABLE_COPY}</p>
                  )}
                </div>
                <ul className="mt-2 space-y-1">
                  {row.issues
                    .filter((i) => i.kind !== "no_payment_tracking")
                    .map((it) => (
                      <li
                        key={it.kind}
                        className={cn(
                          "rounded border px-2 py-1 text-[0.68rem]",
                          it.severity === "high_risk"
                            ? "border-rose-500/40 bg-rose-500/15 text-rose-100"
                            : it.severity === "warning"
                              ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
                              : "border-slate-600/40 bg-slate-800/60 text-slate-400"
                        )}
                      >
                        {SURGERY_READINESS_ISSUE_LABEL[it.kind]}
                      </li>
                    ))}
                </ul>
                <div className="mt-2">
                  <Link href={`${base}/appointments/${encodeURIComponent(row.bookingId)}`} className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">
                    Open appointment
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="tomorrow-checklist-heading">
          <SectionHeader
            id="tomorrow-checklist-heading"
            title="Front-desk preparation"
            description="Confirmations, anchors, contact, manual payments, consent proxy."
          />
          {data.checklist.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No checklist flags for tomorrow’s rows.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.checklist.map((c) => (
                <li key={c.bookingId} className="rounded-lg border border-white/[0.06] bg-[#0a101f]/90 p-3 text-sm">
                  <Link href={`${base}/appointments/${encodeURIComponent(c.bookingId)}`} className="font-medium text-slate-100 hover:text-cyan-200">
                    {c.patientLabel}
                  </Link>
                  <ul className="mt-2 list-inside list-disc text-xs text-amber-100/90">
                    {c.flags.map((f) => (
                      <li key={f}>{CHECKLIST_FLAG_LABEL[f] ?? f}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="tomorrow-staff-heading">
          <SectionHeader id="tomorrow-staff-heading" title="Staff & room preparation" description="Assignments and room gaps for tomorrow." />
          <dl className="mt-4 space-y-2 text-sm text-slate-300">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Assigned bookings</dt>
              <dd className="font-mono">{data.staffPrep.assignedBookings}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Unassigned bookings</dt>
              <dd className="font-mono text-amber-200">{data.staffPrep.unassignedBookings}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Room required but missing</dt>
              <dd className="font-mono text-amber-200">{data.staffPrep.roomMissingBookings}</dd>
            </div>
          </dl>
          {data.staffPrep.assigneeCounts.length ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">By assignee</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-400">
                {data.staffPrep.assigneeCounts.map((a) => (
                  <li key={a.label} className="flex justify-between gap-2">
                    <span className="truncate">{a.label}</span>
                    <span className="font-mono text-slate-300">{a.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DashboardCard>
      </div>

      <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="tomorrow-actions-heading">
        <SectionHeader
          id="tomorrow-actions-heading"
          title="End-of-day action list"
          description="Prioritised from tomorrow’s bookings and surgery readiness."
        />
        {data.actions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No blocking actions detected.</p>
        ) : (
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-200">
            {data.actions.map((a) => (
              <li key={`${a.kind}-${a.bookingId}`}>
                <span className="text-slate-300">{a.label}</span>
                <span className="text-slate-600"> — </span>
                <span className="text-slate-400">{a.patientLabel}</span>
                {" · "}
                <Link href={`${base}/appointments/${encodeURIComponent(a.bookingId)}`} className="text-cyan-300 hover:text-cyan-200">
                  Open
                </Link>
              </li>
            ))}
          </ol>
        )}
      </DashboardCard>
    </div>
  );
}
