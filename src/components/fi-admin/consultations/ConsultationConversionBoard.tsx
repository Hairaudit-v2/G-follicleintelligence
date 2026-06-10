"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import type { ConsultationConversionBoardCard, ConsultationConversionBoardPayload } from "@/src/lib/consultations/consultationConversionBoardLoader.server";
import type { ConsultationConversionBoardColumnId } from "@/src/lib/consultations/consultationConversionBoardModel";

const COLUMN_META: { id: ConsultationConversionBoardColumnId; title: string; tone: string }[] = [
  { id: "consultation_booked", title: "Consultation booked", tone: "border-sky-500/25 bg-sky-500/[0.06]" },
  { id: "consultation_completed", title: "Consultation completed", tone: "border-indigo-500/25 bg-indigo-500/[0.06]" },
  { id: "quote_drafted", title: "Quote drafted", tone: "border-violet-500/25 bg-violet-500/[0.06]" },
  { id: "quote_sent", title: "Quote sent", tone: "border-amber-500/25 bg-amber-500/[0.06]" },
  { id: "quote_accepted", title: "Quote accepted", tone: "border-emerald-500/25 bg-emerald-500/[0.06]" },
  { id: "surgery_booked", title: "Surgery booked", tone: "border-cyan-500/30 bg-cyan-500/[0.08]" },
  { id: "lost", title: "Lost / not proceeding", tone: "border-slate-600/45 bg-slate-900/45" },
];

function KpiTile(props: { label: string; value: number | string; sub?: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-xl border px-3 py-3 shadow-inner shadow-black/25 backdrop-blur-sm",
        props.highlight
          ? "border-cyan-500/30 bg-cyan-500/[0.08]"
          : "border-white/[0.07] bg-[#0c1426]/70",
      )}
    >
      <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{props.label}</p>
      <p className="mt-2 font-mono text-xl font-semibold tabular-nums tracking-tight text-slate-50">{props.value}</p>
      {props.sub ? <p className="mt-1 text-[0.7rem] leading-snug text-slate-500">{props.sub}</p> : null}
    </div>
  );
}

function ConversionCard({ card }: { card: ConsultationConversionBoardCard }) {
  return (
    <article className="rounded-lg border border-white/[0.06] bg-[#0a101f]/90 p-3 text-sm text-slate-200 shadow-sm shadow-black/30">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-50">{card.patientOrLeadLabel}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Consult {card.consultationDateLabel}
            {card.daysSinceConsultation != null ? (
              <>
                <span className="text-slate-600"> · </span>
                {card.daysSinceConsultation === 0
                  ? "Today"
                  : card.daysSinceConsultation === 1
                    ? "1 day since"
                    : `${card.daysSinceConsultation} days since`}
              </>
            ) : null}
          </p>
        </div>
      </div>
      <dl className="mt-2 space-y-1 text-xs text-slate-500">
        {card.consultantLabel ? (
          <div className="flex gap-1">
            <dt className="shrink-0 text-slate-600">Staff</dt>
            <dd className="min-w-0 truncate text-slate-400">{card.consultantLabel}</dd>
          </div>
        ) : null}
        {card.leadStageLabel ? (
          <div className="flex gap-1">
            <dt className="shrink-0 text-slate-600">CRM stage</dt>
            <dd className="min-w-0 truncate text-slate-400">{card.leadStageLabel}</dd>
          </div>
        ) : null}
        {card.quoteStatusDisplay ? (
          <div className="flex gap-1">
            <dt className="shrink-0 text-slate-600">Quote</dt>
            <dd className="min-w-0 truncate text-slate-400">{card.quoteStatusDisplay}</dd>
          </div>
        ) : null}
        {card.graftOrTreatmentLine ? (
          <div className="flex gap-1">
            <dt className="shrink-0 text-slate-600">Plan</dt>
            <dd className="min-w-0 truncate text-slate-400">{card.graftOrTreatmentLine}</dd>
          </div>
        ) : null}
        {card.caseLabel ? (
          <div className="flex gap-1">
            <dt className="shrink-0 text-slate-600">Case</dt>
            <dd className="min-w-0 truncate text-slate-400">{card.caseLabel}</dd>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[0.68rem] text-slate-400">
          <span className="shrink-0 font-semibold uppercase tracking-wide text-slate-500">Deposit</span>
          <span className="text-slate-300">{card.depositBoardLine}</span>
        </div>
      </dl>
      <p className="mt-2 rounded border border-white/[0.06] bg-black/25 px-2 py-1.5 text-[0.68rem] leading-snug text-slate-400">
        <span className="font-semibold text-slate-500">Next: </span>
        {card.nextAction}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] font-semibold">
        {card.hrefs.consultation ? (
          <Link className="text-cyan-400/95 hover:text-cyan-300" href={card.hrefs.consultation}>
            Consultation
          </Link>
        ) : null}
        {card.hrefs.lead ? (
          <Link className="text-cyan-400/95 hover:text-cyan-300" href={card.hrefs.lead}>
            Lead
          </Link>
        ) : null}
        {card.hrefs.patient ? (
          <Link className="text-cyan-400/95 hover:text-cyan-300" href={card.hrefs.patient}>
            Patient
          </Link>
        ) : null}
        {card.hrefs.case ? (
          <Link className="text-cyan-400/95 hover:text-cyan-300" href={card.hrefs.case}>
            Case
          </Link>
        ) : null}
        {card.hrefs.appointment ? (
          <Link className="text-cyan-400/95 hover:text-cyan-300" href={card.hrefs.appointment}>
            Appointment
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function ConsultationConversionBoard({ tenantId, data }: { tenantId: string; data: ConsultationConversionBoardPayload }) {
  const base = `/fi-admin/${tenantId}`;
  const { kpis, window, columns } = data;

  const ratePct =
    kpis.conversionRateQuoteToSurgery != null ? `${Math.round(kpis.conversionRateQuoteToSurgery * 1000) / 10}%` : "—";

  return (
    <div className="mx-auto max-w-[1920px] space-y-6 pb-10">
      <header className="flex flex-col gap-3 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/85">ConsultationOS · Conversion</p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">Consultation conversion board</h1>
          <p className="mt-1 text-sm text-slate-500">
            Window {window.ymdPast90} → {window.ymdFuture30} ({window.calendarTimezone}) · live LeadFlow, bookings, cases, and
            ConsultationOS
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${base}/operations`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex px-3 py-2 text-sm font-semibold text-slate-200")}
          >
            Operations centre
          </Link>
          <Link
            href={`${base}/reception`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex px-3 py-2 text-sm font-semibold text-slate-200")}
          >
            Reception board
          </Link>
          <Link
            href={`${base}/surgery-readiness`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex px-3 py-2 text-sm font-semibold text-slate-200")}
          >
            Surgery readiness
          </Link>
          <Link
            href={`${base}/consultations`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex px-3 py-2 text-sm font-semibold text-slate-200")}
          >
            Consultations
          </Link>
          <Link
            href={`${base}/crm`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex px-3 py-2 text-sm font-semibold text-slate-200")}
          >
            LeadFlow
          </Link>
          <Link
            href={`${base}/calendar`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex px-3 py-2 text-sm font-semibold text-cyan-100/95")}
          >
            Calendar
          </Link>
        </div>
      </header>

      <DashboardCard className="p-4 sm:p-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">KPIs</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiTile label="Consults booked (next 30d)" value={kpis.consultationsBookedNext30Days} highlight />
          <KpiTile label="Consults completed (last 30d)" value={kpis.consultationsCompletedLast30Days} />
          <KpiTile label="Quotes sent (on board)" value={kpis.quotesSent} />
          <KpiTile label="Quotes accepted (on board)" value={kpis.quotesAccepted} />
          <KpiTile label="Surgery booked (on board)" value={kpis.surgeryBookedFromConsults} />
          <KpiTile label="Conversion rate" value={ratePct} sub={kpis.conversionRateLabel} />
        </div>
        <p className="mt-3 text-[0.65rem] text-slate-500">
          Deposit labels reflect manual payment tracking rows only — no row means &quot;No manual deposit record yet.&quot;, not unpaid.
        </p>
      </DashboardCard>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[1200px] gap-3 lg:min-w-0 lg:grid lg:grid-cols-7 lg:gap-3">
          {COLUMN_META.map((col) => (
            <section
              key={col.id}
              aria-labelledby={`ccb-${col.id}`}
              className={cn("flex w-[280px] shrink-0 flex-col rounded-xl border p-3 lg:w-auto lg:min-w-0", col.tone)}
            >
              <h2 id={`ccb-${col.id}`} className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {col.title}
                <span className="ml-1 font-mono text-slate-500">({columns[col.id].length})</span>
              </h2>
              <div className="mt-3 flex max-h-[70vh] min-h-[120px] flex-col gap-2 overflow-y-auto pr-0.5">
                {columns[col.id].length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs leading-relaxed text-slate-600">
                    No consultations in this stage for the current window. Adjust CRM stages, bookings, or filters elsewhere
                    if this looks wrong.
                  </p>
                ) : (
                  columns[col.id].map((c) => <ConversionCard key={c.id} card={c} />)
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
