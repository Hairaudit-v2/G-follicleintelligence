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

export function CasesWorklistTable({
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
    <div className="hidden overflow-x-auto rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-lg shadow-black/40 md:block">
      <table className="min-w-full text-sm" aria-labelledby="cases-worklist-table-heading">
        <caption id="cases-worklist-table-heading" className="px-3 py-2 text-left text-sm font-semibold text-slate-100">
          Surgery case worklist
        </caption>
        <thead className="bg-white/[0.03] text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-3 py-2">Patient / person</th>
            <th className="px-3 py-2">Readiness</th>
            <th className="px-3 py-2">Planning</th>
            <th className="px-3 py-2">Procedure</th>
            <th className="px-3 py-2">Post-op</th>
            <th className="px-3 py-2">Media</th>
            <th className="px-3 py-2">Bookings</th>
            <th className="px-3 py-2">Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-white/[0.06] hover:bg-white/[0.03]">
              <td className="px-3 py-2">
                <Link href={caseDetailPageHref(tenantId, r.id, worklistQueryString)} className="font-medium text-blue-700 hover:underline">
                  {r.external_id?.trim() ? r.external_id : `${r.id.slice(0, 8)}…`}
                </Link>
                <div className="text-xs text-slate-300">{r.person_label}</div>
                {r.lead ? (
                  <div className="mt-0.5 text-[11px] text-gray-500">
                    Lead:{" "}
                    <Link href={`/fi-admin/${tenantId}/crm/leads/${r.lead.id}`} className="text-blue-600 hover:underline">
                      {r.lead.title}
                    </Link>
                  </div>
                ) : null}
                <div className="mt-0.5 text-[11px] text-gray-500">
                  {r.treatment_type ?? "—"} · {fiCaseStatusLabel(r.status)}
                </div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="flex flex-col items-start gap-1">
                  <CaseSectionHealthBadge health={readinessToBadgeHealth(r.readinessBucket)} compact />
                  <span className="text-[11px] text-slate-400">{r.readinessPercent}%</span>
                </div>
              </td>
              <td className="px-3 py-2 text-xs text-slate-300">
                {r.surgeryPlan ? (
                  <>
                    <div>{surgeryPlanningStatusLabel(r.surgeryPlan.planning_status)}</div>
                    <div className="text-[11px] text-gray-500">{r.surgeryPlan.planned_procedure_type ?? "—"}</div>
                  </>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-slate-300">
                {r.procedureDay ? (
                  <>
                    <div>{procedureStatusLabel(r.procedureDay.procedure_status)}</div>
                    <div className="text-[11px] text-gray-500">{r.procedureDate ?? "—"}</div>
                  </>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-slate-300">
                {r.postOpTracking ? postOpStatusLabel(r.postOpTracking.post_op_status) : <span className="text-gray-400">—</span>}
              </td>
              <td className="px-3 py-2 text-xs tabular-nums text-slate-300">{r.imageCount}</td>
              <td className="px-3 py-2 text-xs tabular-nums text-slate-300">{r.bookingCount}</td>
              <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-400">{r.updated_at ? r.updated_at.slice(0, 10) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
