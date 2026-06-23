"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { ClinicalStaffingStatusBadge } from "@/src/components/fi/workforce/ClinicalStaffingStatusBadge";
import {
  buildClearanceChecklistSummary,
  buildReadinessClearancePriorities,
  buildReadinessSnapshotCards,
  buildUpcomingProcedureReadinessList,
  flattenReadinessCards,
  surgicalAttentionSeverityClass,
  surgeryLinkButtonClass,
} from "@/src/lib/fiAdmin/surgeryPresentation";
import type { SurgeryReadinessBoardPayload } from "@/src/lib/surgery/surgeryReadinessBoardLoader.server";
import {
  cardMatchesManagerFilter,
  type SurgeryReadinessManagerFilter,
} from "@/src/lib/surgery/surgeryReadinessBoardModel";
import { SurgeryReadinessSystemDiagnostics } from "@/src/components/fi-admin/surgery/SurgeryReadinessSystemDiagnostics";

const FILTER_CHIPS: { id: SurgeryReadinessManagerFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "needs_attention", label: "Needs attention" },
  { id: "high_risk", label: "Blocked" },
  { id: "missing_pathology", label: "Pathology" },
  { id: "missing_consent", label: "Consent" },
  { id: "not_linked", label: "Not linked" },
];

function ReadinessPrimaryActions({ base }: { base: string }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <Link href={`${base}/procedure-day`} className={surgeryLinkButtonClass}>
        Open Procedure Day
      </Link>
      <Link href={`${base}/surgery-os`} className={surgeryLinkButtonClass}>
        Open SurgeryOS
      </Link>
      <Link href={`${base}/calendar`} className={surgeryLinkButtonClass}>
        Open Calendar
      </Link>
      <Link href={`${base}/patients`} className={surgeryLinkButtonClass}>
        Open PatientOS
      </Link>
      <Link href={`${base}/doctor`} className={surgeryLinkButtonClass}>
        Open Doctor Workspace
      </Link>
    </div>
  );
}

function UpcomingProcedureCard({ tenantId, item }: { tenantId: string; item: ReturnType<typeof buildUpcomingProcedureReadinessList>[number] }) {
  const { card } = item;
  const base = `/fi-admin/${tenantId}`;
  return (
    <article className="rounded-xl border border-white/[0.08] bg-[#0c1220]/75 p-4 text-sm text-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[#F8FAFC]">{card.patientLabel}</p>
          <p className="mt-1 text-xs text-[#64748B]">
            {card.surgeryLocalYmd} · {card.bookingTimeLabel} · {card.bookingTypeLabel}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-md border px-2 py-0.5 text-[0.65rem] font-semibold",
              card.primaryColumn === "ready"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : card.primaryColumn === "high_risk"
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
                  : "border-amber-500/25 bg-amber-500/10 text-amber-100",
            )}
          >
            {item.readinessLabel}
          </span>
          {card.clinicalStaffing ? (
            <ClinicalStaffingStatusBadge status={card.clinicalStaffing.displayStatus} compact />
          ) : null}
        </div>
      </div>

      {item.blockers.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {item.blockers.map((b) => (
            <li
              key={b}
              className="rounded border border-white/[0.08] bg-black/20 px-2 py-0.5 text-[0.68rem] text-[#94A3B8]"
            >
              {b}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 text-xs leading-relaxed text-[#94A3B8]">
        <span className="font-semibold text-[#CBD5E1]">Next: </span>
        {item.nextAction}
      </p>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] font-semibold">
        {card.hrefs.case ? (
          <Link href={card.hrefs.case} className="text-[#22C1FF]/90 hover:text-[#22C1FF]">
            Open case
          </Link>
        ) : null}
        {card.hrefs.patient ? (
          <Link href={card.hrefs.patient} className="text-[#22C1FF]/90 hover:text-[#22C1FF]">
            PatientOS
          </Link>
        ) : null}
        <Link href={`${base}/doctor`} className="text-[#22C1FF]/90 hover:text-[#22C1FF]">
          Doctor review
        </Link>
        <Link href={card.hrefs.calendar} className="text-[#22C1FF]/90 hover:text-[#22C1FF]">
          Calendar
        </Link>
      </div>
    </article>
  );
}

export function SurgeryReadinessBoard({ tenantId, data }: { tenantId: string; data: SurgeryReadinessBoardPayload }) {
  const base = `/fi-admin/${tenantId}`;
  const { window } = data;
  const [filter, setFilter] = useState<SurgeryReadinessManagerFilter>("all");

  const snapshotCards = buildReadinessSnapshotCards(base, data);
  const priorityItems = buildReadinessClearancePriorities(base, data, 5);
  const allCards = flattenReadinessCards(data);
  const checklistGroups = buildClearanceChecklistSummary(allCards);

  const upcomingList = useMemo(() => {
    const list = buildUpcomingProcedureReadinessList(data);
    if (filter === "all") return list;
    return list.filter((item) =>
      cardMatchesManagerFilter(item.card.issues, item.card.primaryColumn, filter),
    );
  }, [data, filter]);

  return (
    <div className="mx-auto min-w-0 max-w-[88rem] space-y-8 pb-10 sm:space-y-10 sm:pb-14">
      <DashboardCard elevated className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_260px_at_0%_0%,rgba(34,193,255,0.11),transparent_55%),radial-gradient(420px_200px_at_100%_100%,rgba(124,58,237,0.07),transparent_50%)]"
          aria-hidden
        />
        <div className="relative border-l-4 border-[#22C1FF]/80 pl-5 sm:pl-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#22C1FF]/95">FI OS · Surgery</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC] sm:text-4xl">Surgery Readiness</h1>
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-[#94A3B8]">
            Upcoming procedure preparation, blockers, clearance, and patient readiness before surgery day.
          </p>
          <p className="mt-2 text-sm text-[#64748B]">
            Next 14 days · {window.todayYmd} → {window.windowEndYmd}
          </p>
          <ReadinessPrimaryActions base={base} />
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="readiness-snapshot-heading">
        <SectionHeader
          id="readiness-snapshot-heading"
          kicker="Upcoming"
          title="Readiness snapshot"
          description="Clearance signals across the next 14 days of surgical procedures."
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {snapshotCards.map((card) => {
            const inner = (
              <>
                <p className="text-sm font-semibold text-[#F8FAFC]">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-[#F8FAFC]">{card.value}</p>
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
              <div key={card.id} className="flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-4">
                {inner}
              </div>
            );
          })}
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="readiness-priorities-heading">
        <SectionHeader
          id="readiness-priorities-heading"
          kicker="Clearance"
          title="What needs clearance"
          description="Top preparation priorities before surgery day."
          className="mb-4"
        />
        {priorityItems.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
            <p className="text-sm leading-relaxed text-[#CBD5E1]">All upcoming procedures are cleared for preparation.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {priorityItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href ?? `${base}/surgery-readiness`}
                  className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-4 transition hover:border-[#22C1FF]/30 ${surgicalAttentionSeverityClass(item.severity)}`}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#F8FAFC]">{item.headline}</p>
                    {item.detail ? <p className="mt-1 text-sm text-[#94A3B8]">{item.detail}</p> : null}
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#22C1FF]/70" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="readiness-upcoming-heading">
        <SectionHeader
          id="readiness-upcoming-heading"
          kicker="Board"
          title="Upcoming procedure readiness"
          description="Each procedure with clearance status, blockers, and next action."
          className="mb-4"
        />
        <div className="mb-4 flex flex-wrap gap-2">
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
        {upcomingList.length === 0 ? (
          <p className="text-sm text-[#64748B]">No procedures match this filter in the upcoming window.</p>
        ) : (
          <ul className="space-y-3">
            {upcomingList.map((item) => (
              <li key={item.card.bookingId}>
                <UpcomingProcedureCard tenantId={tenantId} item={item} />
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="readiness-checklist-heading">
        <SectionHeader
          id="readiness-checklist-heading"
          kicker="Summary"
          title="Clearance checklist summary"
          description="Grouped clearance categories across upcoming procedures."
          className="mb-4"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {checklistGroups.map((g) => (
            <div
              key={g.id}
              className={cn(
                "rounded-xl border px-3 py-3",
                g.blockedCount > 0
                  ? "border-amber-500/25 bg-amber-500/[0.06]"
                  : "border-white/[0.08] bg-[#0c1220]/75",
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{g.label}</p>
              <p className="mt-2 text-lg font-semibold tabular-nums text-[#F8FAFC]">
                {g.blockedCount > 0 ? `${g.blockedCount} blocked` : "Clear"}
              </p>
              <p className="mt-1 text-[0.65rem] text-[#64748B]">{g.clearedCount} cleared</p>
            </div>
          ))}
        </div>
      </DashboardCard>

      <SurgeryReadinessSystemDiagnostics tenantId={tenantId} payload={data} />
    </div>
  );
}
