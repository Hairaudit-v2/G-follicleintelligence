"use client";

import type { CaseSurgeryPlanRow } from "@/src/lib/cases/surgeryPlanningLoaders";
import { appointmentCardClass } from "./appointmentSharedStyles";

export function AppointmentClinicalSection({
  clinicalScalesSummary,
  clinicalLine,
  surgeryPlan,
}: {
  clinicalScalesSummary: string | null;
  clinicalLine: string | null;
  surgeryPlan: CaseSurgeryPlanRow | null;
}) {
  return (
    <section className={appointmentCardClass}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Clinical context
      </h3>
      {clinicalScalesSummary ? (
        <p className="text-sm text-slate-100">{clinicalScalesSummary}</p>
      ) : (
        <p className="text-sm text-slate-400">Link a patient to show Norwood / Ludwig summary.</p>
      )}
      {clinicalLine ? <p className="mt-2 text-xs text-slate-300">{clinicalLine}</p> : null}
      {surgeryPlan ? (
        <div className="mt-3 rounded border border-white/[0.06] bg-white/[0.03] p-2 text-xs text-slate-200">
          <p className="font-medium text-slate-100">Case surgery plan</p>
          {surgeryPlan.planned_procedure_type ? (
            <p className="mt-1">Procedure: {surgeryPlan.planned_procedure_type}</p>
          ) : null}
          {surgeryPlan.estimated_grafts_min != null || surgeryPlan.estimated_grafts_max != null ? (
            <p>
              Grafts (plan):{" "}
              {surgeryPlan.estimated_grafts_min != null && surgeryPlan.estimated_grafts_max != null
                ? `${surgeryPlan.estimated_grafts_min.toLocaleString()}–${surgeryPlan.estimated_grafts_max.toLocaleString()}`
                : (surgeryPlan.estimated_grafts_min?.toLocaleString() ??
                  surgeryPlan.estimated_grafts_max?.toLocaleString())}
            </p>
          ) : null}
          {surgeryPlan.surgical_plan_summary?.trim() ? (
            <p className="mt-1 whitespace-pre-wrap">{surgeryPlan.surgical_plan_summary.trim()}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
