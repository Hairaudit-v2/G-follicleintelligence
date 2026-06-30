import Link from "next/link";
import type { CaseWorklistRow, CasesWorklistReadinessBucket } from "@/src/lib/cases/casesIndexTypes";
import { caseDetailPageHref } from "@/src/lib/cases/caseDetailFromCasesParam";
import { fiCaseStatusLabel } from "@/src/lib/cases/caseLabels";
import { postOpStatusLabel } from "@/src/lib/cases/postOpLabels";
import { procedureStatusLabel } from "@/src/lib/cases/procedureDayLabels";
import { surgeryPlanningStatusLabel } from "@/src/lib/cases/surgeryPlanningLabels";
import type { CaseReadinessHealth } from "@/src/lib/cases/caseReadinessTypes";
import { CaseSectionHealthBadge } from "./CaseSectionHealthBadge";

function readinessToBadgeHealth(bucket: CasesWorklistReadinessBucket): CaseReadinessHealth {
  if (bucket === "ready") return "complete";
  return bucket;
}

export function CasesWorklistMobileCards({
  tenantId,
  rows,
  worklistQueryString,
}: {
  tenantId: string;
  rows: CaseWorklistRow[];
  worklistQueryString?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-3 md:hidden">
      {rows.map((r) => (
        <Link
          key={r.id}
          href={caseDetailPageHref(tenantId, r.id, worklistQueryString)}
          className="block rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-3 shadow-lg shadow-black/40 hover:border-slate-700"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-blue-300">{r.external_id?.trim() ? r.external_id : `${r.id.slice(0, 8)}…`}</p>
              <p className="text-xs text-slate-200">{r.person_label}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <CaseSectionHealthBadge health={readinessToBadgeHealth(r.readinessBucket)} compact />
              <span className="text-[11px] text-slate-400">{r.readinessPercent}%</span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            {fiCaseStatusLabel(r.status)}
            {r.treatment_type ? ` · ${r.treatment_type}` : ""}
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-300">
            <dt className="text-gray-500">Planning</dt>
            <dd>{r.surgeryPlan ? surgeryPlanningStatusLabel(r.surgeryPlan.planning_status) : "—"}</dd>
            <dt className="text-gray-500">Procedure</dt>
            <dd>
              {r.procedureDay ? `${procedureStatusLabel(r.procedureDay.procedure_status)} (${r.procedureDate ?? "—"})` : "—"}
            </dd>
            <dt className="text-gray-500">Post-op</dt>
            <dd>{r.postOpTracking ? postOpStatusLabel(r.postOpTracking.post_op_status) : "—"}</dd>
            <dt className="text-gray-500">Images / bookings</dt>
            <dd>
              {r.imageCount} / {r.bookingCount}
            </dd>
          </dl>
        </Link>
      ))}
    </div>
  );
}
