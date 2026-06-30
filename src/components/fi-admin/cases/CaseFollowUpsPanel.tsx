import type { CaseImageListItem } from "@/src/lib/cases/caseLoaders";
import type { CaseFollowUpRow } from "@/src/lib/cases/postOpLoaders";
import { FOLLOW_UP_CHECKPOINT_VALUES } from "@/src/lib/cases/postOpLabels";
import type { FollowUpCheckpointValue } from "@/src/lib/cases/postOpTypes";
import { CaseFollowUpRowEditor } from "./CaseFollowUpRowEditor";

export function CaseFollowUpsPanel({
  tenantId,
  caseId,
  followUps,
  imageOptions,
}: {
  tenantId: string;
  caseId: string;
  followUps: CaseFollowUpRow[];
  imageOptions: CaseImageListItem[];
}) {
  const byCheckpoint = new Map<FollowUpCheckpointValue, CaseFollowUpRow>();
  for (const r of followUps) {
    byCheckpoint.set(r.checkpoint, r);
  }

  return (
    <div className="mt-6 border-t border-white/[0.06] pt-4">
      <h3 className="text-xs font-semibold text-slate-100">Follow-up schedule & visits</h3>
      <p className="mt-1 max-w-3xl text-xs text-gray-500">
        Standard checkpoints (day 1 through month 12). Link rows to existing patient images by ID — no automated outcome
        scoring.
      </p>
      <div className="mt-4 space-y-3">
        {FOLLOW_UP_CHECKPOINT_VALUES.map((cp) => (
          <CaseFollowUpRowEditor
            key={cp}
            tenantId={tenantId}
            caseId={caseId}
            checkpoint={cp}
            row={byCheckpoint.get(cp) ?? null}
            imageOptions={imageOptions}
          />
        ))}
      </div>
    </div>
  );
}
