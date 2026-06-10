import {
  CASE_DETAIL_SECTION_IDS,
  caseDetailSectionHeadingId,
  caseProcedureDayDetailHref,
} from "@/src/lib/cases/caseDetailNavConstants";
import { CopyProcedureDayLinkButton } from "@/src/components/fi-admin/cases/CopyProcedureDayLinkButton";
import type { CaseProcedureRow } from "@/src/lib/cases/procedureDayLoaders";
import { buildProcedureDayMismatchWarnings } from "@/src/lib/cases/procedureDayMismatchModel";
import type { ProcedureTeamPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import { procedureStatusLabel } from "@/src/lib/cases/procedureDayLabels";
import { CaseProcedureDayForm } from "./CaseProcedureDayForm";

export function CaseProcedureDayCard({
  tenantId,
  caseId,
  procedure,
  teamUserOptions,
  linkedSurgeryBookingYmd,
}: {
  tenantId: string;
  caseId: string;
  procedure: CaseProcedureRow | null;
  teamUserOptions: ProcedureTeamPickerOption[];
  /** Earliest linked surgery booking calendar day (tenant TZ), for alignment warnings. */
  linkedSurgeryBookingYmd: string | null;
}) {
  const mismatch = buildProcedureDayMismatchWarnings({
    procedureDateYmd: procedure?.procedure_date ?? null,
    linkedSurgeryBookingYmd,
  });
  return (
    <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2
            id={caseDetailSectionHeadingId(CASE_DETAIL_SECTION_IDS.procedureDay)}
            className="text-sm font-semibold text-gray-900"
          >
            Procedure day workflow
          </h2>
          <p className="mt-1 max-w-3xl text-xs text-gray-500">
            Stage 5C: structured procedure-day record (timing, team, technique, counts, notes). This is not HairAudit
            scoring or formal surgical audit grading — post-op and qualitative outcomes live in Stage 5D below.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          <CopyProcedureDayLinkButton
            variant="light"
            relativeHref={caseProcedureDayDetailHref(tenantId, caseId)}
          />
          {procedure ? (
            <p className="text-xs text-gray-600">
              Status:{" "}
              <span className="font-medium text-gray-900">{procedureStatusLabel(procedure.procedure_status)}</span>
              <span className="ml-2 text-gray-400">· updated {procedure.updated_at ? procedure.updated_at.slice(0, 10) : "—"}</span>
            </p>
          ) : (
            <p className="text-xs text-amber-800">No procedure-day row yet — save to create one.</p>
          )}
        </div>
      </div>

      {mismatch.length ? (
        <ul className="mt-3 space-y-1 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          {mismatch.map((w, i) => (
            <li key={i}>{w.message}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 border-t border-gray-100 pt-4">
        <CaseProcedureDayForm tenantId={tenantId} caseId={caseId} initial={procedure} teamUserOptions={teamUserOptions} />
      </div>
    </div>
  );
}
