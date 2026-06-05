import { CASE_DETAIL_SECTION_IDS, caseDetailSectionHeadingId } from "@/src/lib/cases/caseDetailNavConstants";
import type { CaseImageListItem } from "@/src/lib/cases/caseLoaders";
import type { CaseFollowUpRow, CasePostOpTrackingRow } from "@/src/lib/cases/postOpLoaders";
import { postOpStatusLabel } from "@/src/lib/cases/postOpLabels";
import { CaseFollowUpsPanel } from "./CaseFollowUpsPanel";
import { CasePostOpTrackingForm } from "./CasePostOpTrackingForm";

export function CasePostOpTrackingCard({
  tenantId,
  caseId,
  tracking,
  followUps,
  imageOptions,
}: {
  tenantId: string;
  caseId: string;
  tracking: CasePostOpTrackingRow | null;
  followUps: CaseFollowUpRow[];
  imageOptions: CaseImageListItem[];
}) {
  return (
    <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2
            id={caseDetailSectionHeadingId(CASE_DETAIL_SECTION_IDS.postOp)}
            className="text-sm font-semibold text-gray-900"
          >
            Post-op / outcome tracking
          </h2>
          <p className="mt-1 max-w-3xl text-xs text-gray-500">
            Stage 5D: recovery notes, follow-ups, complications, satisfaction, and qualitative outcomes. This is not
            HairAudit scoring, formal surgical audit grading, automated graft survival, AI outcome scoring, or
            certification scoring.
          </p>
        </div>
        {tracking ? (
          <p className="text-xs text-gray-600">
            Status:{" "}
            <span className="font-medium text-gray-900">{postOpStatusLabel(tracking.post_op_status)}</span>
            <span className="ml-2 text-gray-400">· updated {tracking.updated_at ? tracking.updated_at.slice(0, 10) : "—"}</span>
          </p>
        ) : (
          <p className="text-xs text-amber-800">No post-op tracking row yet — save the form below to create one.</p>
        )}
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <CasePostOpTrackingForm tenantId={tenantId} caseId={caseId} initial={tracking} />
        <CaseFollowUpsPanel tenantId={tenantId} caseId={caseId} followUps={followUps} imageOptions={imageOptions} />
      </div>
    </div>
  );
}
