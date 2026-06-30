import {
  CASE_DETAIL_SECTION_IDS,
  caseDetailSectionHeadingId,
} from "@/src/lib/cases/caseDetailNavConstants";
import type { CaseProcedureRow } from "@/src/lib/cases/procedureDayLoaders";
import type { CaseSurgeryPlanRow } from "@/src/lib/cases/surgeryPlanningLoaders";
import { surgeryPlanningStatusLabel } from "@/src/lib/cases/surgeryPlanningLabels";
import { CasePostopMedicationPlanButton } from "./CasePostopMedicationPlanButton";
import { CaseSurgeryPlanningForm } from "./CaseSurgeryPlanningForm";

export function CaseSurgeryPlanningCard({
  tenantId,
  caseId,
  plan,
  foundationPatientId,
  procedureDay,
  linkedSurgeryBookingYmd,
}: {
  tenantId: string;
  caseId: string;
  plan: CaseSurgeryPlanRow | null;
  foundationPatientId: string | null;
  procedureDay: CaseProcedureRow | null;
  linkedSurgeryBookingYmd: string | null;
}) {
  const anchorHint = (() => {
    const pd = procedureDay?.procedure_date?.trim();
    if (pd) return `Procedure day (${pd.slice(0, 10)})`;
    if (linkedSurgeryBookingYmd?.trim())
      return `Earliest surgery booking (${linkedSurgeryBookingYmd.trim()})`;
    return null;
  })();
  return (
    <div className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2
            id={caseDetailSectionHeadingId(CASE_DETAIL_SECTION_IDS.surgeryPlanning)}
            className="text-sm font-semibold text-slate-100"
          >
            Surgery planning foundation
          </h2>
          <p className="mt-1 max-w-3xl text-xs text-gray-500">
            Stage 5B readiness only: summary, zones, procedure/session intent, estimated graft
            range, strategy notes, and planning status. No procedure-day workflow, live graft
            tallying, audits, or outcomes.
          </p>
        </div>
        {plan ? (
          <p className="text-xs text-slate-400">
            Status:{" "}
            <span className="font-medium text-slate-100">
              {surgeryPlanningStatusLabel(plan.planning_status)}
            </span>
            <span className="ml-2 text-gray-400">
              · updated {plan.updated_at ? plan.updated_at.slice(0, 10) : "—"}
            </span>
          </p>
        ) : (
          <p className="text-xs text-amber-300">No surgery plan row yet — save to create one.</p>
        )}
      </div>

      <div className="mt-4 border-t border-white/[0.06] pt-4">
        <CaseSurgeryPlanningForm tenantId={tenantId} caseId={caseId} initial={plan} />
        <CasePostopMedicationPlanButton
          tenantId={tenantId}
          caseId={caseId}
          foundationPatientId={foundationPatientId}
          anchorHint={anchorHint}
        />
      </div>
    </div>
  );
}
