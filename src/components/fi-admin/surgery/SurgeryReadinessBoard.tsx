"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import type { SurgeryReadinessBoardCard, SurgeryReadinessBoardPayload } from "@/src/lib/surgery/surgeryReadinessBoardLoader.server";
import { CopyProcedureDayLinkButton } from "@/src/components/fi-admin/cases/CopyProcedureDayLinkButton";
import { FinancialPaymentPathwayBadge } from "@/src/components/fi/financial/FinancialPaymentPathwayBadge";
import { FinancialClearancePanel } from "@/src/components/fi/financial/FinancialClearancePanel";
import { FinancialSurgeryPipelineInline } from "@/src/components/fi/financial/FinancialSurgeryPipelineInline";
import {
  SURGERY_READINESS_ISSUE_LABEL,
  cardMatchesManagerFilter,
  type SurgeryReadinessBoardColumnId,
  type SurgeryReadinessIssueSeverity,
  type SurgeryReadinessManagerFilter,
} from "@/src/lib/surgery/surgeryReadinessBoardModel";

const COLUMN_META: { id: SurgeryReadinessBoardColumnId; title: string; tone: string }[] = [
  { id: "ready", title: "Ready", tone: "border-emerald-500/20 bg-emerald-500/[0.06]" },
  { id: "needs_attention", title: "Needs attention", tone: "border-amber-500/25 bg-amber-500/[0.06]" },
  { id: "high_risk", title: "High risk", tone: "border-rose-500/30 bg-rose-500/[0.07]" },
  { id: "missing_pathology", title: "Missing pathology", tone: "border-violet-500/25 bg-violet-500/[0.06]" },
  { id: "missing_consent", title: "Missing consent", tone: "border-sky-500/25 bg-sky-500/[0.06]" },
  { id: "on_hold_not_linked", title: "On hold / not linked", tone: "border-slate-600/40 bg-slate-900/40" },
];

const FILTER_CHIPS: { id: SurgeryReadinessManagerFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "needs_attention", label: "Needs attention" },
  { id: "high_risk", label: "High risk" },
  { id: "missing_pathology", label: "Missing pathology" },
  { id: "missing_consent", label: "Missing consent" },
  { id: "not_linked", label: "Not linked" },
];

function severityChipClass(sev: SurgeryReadinessIssueSeverity): string {
  if (sev === "high_risk") return "border-rose-500/40 bg-rose-500/15 text-rose-100";
  if (sev === "warning") return "border-amber-500/35 bg-amber-500/10 text-amber-100";
  return "border-slate-600/40 bg-slate-800/60 text-slate-400";
}

function severityLabel(sev: SurgeryReadinessIssueSeverity): string {
  if (sev === "high_risk") return "High risk";
  if (sev === "warning") return "Warning";
  return "Info";
}

function KpiTile(props: {
  label: string;
  value: number | string;
  sub?: string;
  highlight?: boolean;
}) {
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

function SurgeryCard({ tenantId, card }: { tenantId: string; card: SurgeryReadinessBoardCard }) {
  const displayIssues = card.issues.filter((i) => i.kind !== "no_payment_tracking").slice(0, 8);
  return (
    <article className="rounded-lg border border-white/[0.06] bg-[#0a101f]/90 p-3 text-sm text-slate-200 shadow-sm shadow-black/30">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-50">{card.patientLabel}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {card.surgeryLocalYmd}
            <span className="text-slate-600"> · </span>
            {card.bookingTimeLabel}
            <span className="text-slate-600"> · </span>
            {card.daysUntil === 0 ? "Today" : card.daysUntil === 1 ? "1 day" : `${card.daysUntil} days`}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-white/[0.08] bg-black/30 px-2 py-0.5 text-[0.65rem] font-medium text-slate-400">
          {card.bookingStatusLabel}
        </span>
      </div>
      <dl className="mt-2 space-y-1 text-xs text-slate-500">
        {card.assigneeLabel ? (
          <div className="flex gap-1">
            <dt className="shrink-0 text-slate-600">Staff</dt>
            <dd className="min-w-0 truncate text-slate-400">{card.assigneeLabel}</dd>
          </div>
        ) : null}
        {card.caseStatusLabel ? (
          <div className="flex gap-1">
            <dt className="shrink-0 text-slate-600">Case</dt>
            <dd className="min-w-0 truncate text-slate-400">{card.caseStatusLabel}</dd>
          </div>
        ) : null}
        {card.readinessPercent != null ? (
          <div className="flex gap-1">
            <dt className="shrink-0 text-slate-600">Readiness</dt>
            <dd className="font-mono text-slate-300">{card.readinessPercent}%</dd>
          </div>
        ) : null}
        <div className="flex gap-1">
          <dt className="shrink-0 text-slate-600">Deposit</dt>
          <dd className="min-w-0 text-slate-300">{card.surgeryDepositLabel}</dd>
        </div>
      </dl>
      <FinancialSurgeryPipelineInline tenantId={tenantId} caseId={card.caseId} status={card.financialPipeline} variant="dark" />
      <FinancialClearancePanel
        tenantId={tenantId}
        clearance={card.financialClearance}
        currency={card.financialPipeline.currency}
        variant="dark"
        compact
      />
      <div className="mt-1.5">
        <FinancialPaymentPathwayBadge summary={card.financialPipeline.paymentPathway} variant="dark" />
      </div>
      {displayIssues.length ? (
        <ul className="mt-2 space-y-1">
          {displayIssues.map((it) => (
            <li
              key={it.kind}
              className={cn("flex flex-wrap items-center gap-1.5 rounded border px-2 py-1 text-[0.68rem]", severityChipClass(it.severity))}
            >
              <span className="font-medium uppercase tracking-wide text-[0.55rem] opacity-80">{severityLabel(it.severity)}</span>
              <span>{SURGERY_READINESS_ISSUE_LABEL[it.kind]}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.7rem] font-semibold">
        {card.hrefs.case ? (
          <>
            <Link className="text-cyan-400/95 hover:text-cyan-300" href={card.hrefs.case}>
              Case
            </Link>
            <CopyProcedureDayLinkButton relativeHref={card.hrefs.case} />
          </>
        ) : null}
        {card.hrefs.patient ? (
          <Link className="text-cyan-400/95 hover:text-cyan-300" href={card.hrefs.patient}>
            Patient
          </Link>
        ) : null}
        <Link className="text-cyan-400/95 hover:text-cyan-300" href={card.hrefs.calendar}>
          Calendar
        </Link>
        <Link className="text-cyan-400/95 hover:text-cyan-300" href={card.hrefs.appointments}>
          Appointment
        </Link>
        <Link className="text-cyan-400/95 hover:text-cyan-300" href={card.hrefs.operationsCentre}>
          Operations
        </Link>
      </div>
    </article>
  );
}

export function SurgeryReadinessBoard({ tenantId, data }: { tenantId: string; data: SurgeryReadinessBoardPayload }) {
  const base = `/fi-admin/${tenantId}`;
  const { kpis, window, columns } = data;
  const [filter, setFilter] = useState<SurgeryReadinessManagerFilter>("all");

  const filteredColumns = useMemo(() => {
    const out = {} as Record<SurgeryReadinessBoardColumnId, SurgeryReadinessBoardCard[]>;
    for (const col of COLUMN_META) {
      const list = columns[col.id];
      out[col.id] =
        filter === "all" ? list : list.filter((card) => cardMatchesManagerFilter(card.issues, card.primaryColumn, filter));
    }
    return out;
  }, [columns, filter]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-10">
      <header className="flex flex-col gap-3 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/85">SurgeryOS · Readiness board</p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">Surgery readiness</h1>
          <p className="mt-1 text-sm text-slate-500">
            Next 14 days ({window.todayYmd} → {window.windowEndYmd}) · {window.calendarTimezone}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${base}/tomorrow`}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex px-3 py-2 text-sm font-semibold text-cyan-100/95",
            )}
          >
            Tomorrow board
          </Link>
          <Link
            href={`${base}/procedure-day`}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex px-3 py-2 text-sm font-semibold text-slate-200",
            )}
          >
            Procedure day
          </Link>
          <Link
            href={`${base}/cases`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex px-3 py-2 text-sm font-semibold text-slate-200")}
          >
            SurgeryOS cases
          </Link>
          <Link
            href={`${base}/calendar`}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex px-3 py-2 text-sm font-semibold text-cyan-100/95",
            )}
          >
            Calendar
          </Link>
          <Link
            href={`${base}/reception`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex px-3 py-2 text-sm font-semibold text-slate-200")}
          >
            Reception board
          </Link>
          <Link
            href={`${base}/consultation-conversion`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex px-3 py-2 text-sm font-semibold text-slate-200")}
          >
            Conversion board
          </Link>
          <Link
            href={`${base}/operations`}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex px-3 py-2 text-sm font-semibold text-slate-200")}
          >
            Operations centre
          </Link>
        </div>
      </header>

      <DashboardCard className="p-4 sm:p-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Manager filters</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {FILTER_CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                filter === c.id
                  ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
                  : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:border-white/15 hover:text-slate-200",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard className="p-4 sm:p-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">KPIs</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <KpiTile label="Upcoming (14d)" value={kpis.upcomingNext14Days} highlight />
          <KpiTile label="Ready" value={kpis.ready} />
          <KpiTile label="Needs attention" value={kpis.needsAttention} />
          <KpiTile label="High risk" value={kpis.highRisk} />
          <KpiTile label="Missing pathology" value={kpis.missingPathology} />
          <KpiTile label="Missing consent" value={kpis.missingConsent} />
          <KpiTile
            label="Deposit tracking"
            value={`${kpis.surgeryDepositsPending} pending`}
            sub={`${kpis.surgeryPaymentRecordsTracked} surgery rows tracked on this board (manual payment tracking).`}
          />
        </div>
      </DashboardCard>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[900px] gap-3 xl:min-w-0 xl:grid xl:grid-cols-6 xl:gap-3">
        {COLUMN_META.map((col) => (
          <section
            key={col.id}
            aria-labelledby={`srcol-${col.id}`}
            className={cn(
              "flex min-h-[220px] w-[min(100%,16rem)] shrink-0 flex-col rounded-xl border p-3 xl:w-auto xl:min-w-0",
              col.tone,
            )}
          >
            <h2 id={`srcol-${col.id}`} className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {col.title}
              <span className="ml-1 font-mono text-slate-500">({filteredColumns[col.id].length})</span>
            </h2>
            <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {filteredColumns[col.id].length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-600">Nothing in this column (try another filter).</p>
              ) : (
                filteredColumns[col.id].map((c) => <SurgeryCard key={c.bookingId} tenantId={tenantId} card={c} />)
              )}
            </div>
          </section>
        ))}
        </div>
      </div>
    </div>
  );
}
