import Link from "next/link";

import type {
  OverviewProcedureSection,
  OverviewSurgicalPlanSection,
} from "@/src/lib/patientTwin/patientTwinOverviewTypes";
import {
  formatGraftCount,
  OVERVIEW_SECTION_HEADINGS,
} from "@/src/lib/patientTwin/patientTwinOverviewCopy";
import { OVERVIEW_SECTION_IDS } from "@/src/lib/patientTwin/patientTwinOverviewTypes";
import { OverviewAvailabilityBadge } from "./OverviewAvailabilityBadge";

export function PatientTwinSurgicalStoryStrips({
  surgicalPlan,
  procedure,
}: {
  surgicalPlan: OverviewSurgicalPlanSection;
  procedure: OverviewProcedureSection;
}) {
  return (
    <div className="space-y-4">
      <section
        id={OVERVIEW_SECTION_IDS.surgicalPlan}
        className="scroll-mt-4 rounded-xl border border-white/[0.08] bg-[#0b1220]/90 p-4"
        aria-labelledby="overview-surgical-plan-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="overview-surgical-plan-heading"
            className="text-sm font-semibold tracking-tight text-slate-100"
          >
            {OVERVIEW_SECTION_HEADINGS.surgicalPlan}
          </h2>
          <OverviewAvailabilityBadge availability={surgicalPlan.availability} />
        </div>

        {surgicalPlan.availability === "not_recorded" ? (
          <p className="mt-3 text-sm text-slate-400">
            Surgical recommendation and allocation are not recorded.
          </p>
        ) : (
          <div className="mt-3 space-y-3 text-sm text-slate-200">
            {surgicalPlan.recommendationSummary ? (
              <p>{surgicalPlan.recommendationSummary}</p>
            ) : null}
            {surgicalPlan.treatmentContext ? (
              <p className="text-slate-400">{surgicalPlan.treatmentContext}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {surgicalPlan.hairlineLabel ? (
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100">
                  {surgicalPlan.hairlineLabel}
                </span>
              ) : (
                <span className="text-xs text-slate-500">Approved hairline not recorded</span>
              )}
              {surgicalPlan.plannedGrafts != null ? (
                <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100">
                  Planned {formatGraftCount(surgicalPlan.plannedGrafts)} grafts
                </span>
              ) : null}
            </div>
            {surgicalPlan.plannedZones.length > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-3">
                {surgicalPlan.plannedZones.map((z) => (
                  <li
                    key={z.key}
                    className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2"
                  >
                    <p className="font-medium text-slate-100">{z.label}</p>
                    <p className="text-xs text-slate-400">
                      {z.grafts != null ? `${formatGraftCount(z.grafts)} grafts` : "Grafts not recorded"}
                      {z.targetDensityPerCm2 != null
                        ? ` · ${z.targetDensityPerCm2}/cm²`
                        : null}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">Planned zones not recorded</p>
            )}
          </div>
        )}

        {surgicalPlan.surgeryPlanningHref ? (
          <Link
            href={surgicalPlan.surgeryPlanningHref}
            className="mt-3 inline-block text-sm font-medium text-cyan-300 hover:underline"
          >
            Open surgery planning
          </Link>
        ) : null}
      </section>

      <section
        id={OVERVIEW_SECTION_IDS.procedure}
        className="scroll-mt-4 rounded-xl border border-white/[0.08] bg-[#0b1220]/90 p-4"
        aria-labelledby="overview-procedure-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="overview-procedure-heading"
            className="text-sm font-semibold tracking-tight text-slate-100"
          >
            {OVERVIEW_SECTION_HEADINGS.procedure}
          </h2>
          <OverviewAvailabilityBadge availability={procedure.availability} />
        </div>

        {procedure.availability === "not_recorded" ? (
          <p className="mt-3 text-sm text-slate-400">Procedure details are not recorded.</p>
        ) : (
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div>
              <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                Surgery date
              </dt>
              <dd className="mt-1 text-slate-100">
                {procedure.surgeryDate ?? "Not recorded"}
                {procedure.surgeryStatus ? (
                  <span className="text-slate-400"> · {procedure.surgeryStatus}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                Technique
              </dt>
              <dd className="mt-1 text-slate-100">{procedure.technique ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                Implanted grafts
              </dt>
              <dd className="mt-1 text-slate-100">
                {procedure.actualImplantedGrafts != null
                  ? formatGraftCount(procedure.actualImplantedGrafts)
                  : "Not recorded"}
              </dd>
            </div>
            <div>
              <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                Extracted grafts
              </dt>
              <dd className="mt-1 text-slate-100">
                {procedure.actualExtractedGrafts != null
                  ? formatGraftCount(procedure.actualExtractedGrafts)
                  : "Not recorded"}
              </dd>
            </div>
            <div>
              <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                Graft reconciliation
              </dt>
              <dd className="mt-1 text-slate-100">
                {procedure.graftReconciliationLabel ?? "Not recorded"}
              </dd>
            </div>
            <div>
              <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                Transection
              </dt>
              <dd className="mt-1 text-slate-100">
                {procedure.transectionRatePercent != null
                  ? `${procedure.transectionRatePercent}%`
                  : "Not recorded"}
              </dd>
            </div>
          </dl>
        )}

        {procedure.surgeryDayHref ? (
          <Link
            href={procedure.surgeryDayHref}
            className="mt-3 inline-block text-sm font-medium text-cyan-300 hover:underline"
          >
            Open surgery day
          </Link>
        ) : null}
      </section>
    </div>
  );
}
