const TERMINAL_LEAD_STATUSES = new Set(["archived", "lost", "converted"]);
/** Keep aligned with `terminalLeadStatuses` in `tenantOperationalDashboardLoader.server.ts`. */

export type CrmPipelineLeadVolume = {
  /** Active (non-terminal status) leads per `current_stage_id` for stages in the default pipeline. */
  activeByStageId: Record<string, number>;
  activeUnassignedStage: number;
  /** Active leads whose `current_stage_id` is not in the provided pipeline stage id set. */
  activeOtherPipelineStage: number;
};

/**
 * Groups active `fi_crm_leads` rows by `current_stage_id` for pipeline snapshot volume.
 * Does not use stale-lead lists — pass raw lead rows from a single tenant query.
 */
export function aggregateActiveLeadVolumeByPipelineStage(
  rows: readonly { current_stage_id: string | null; status: string | null }[],
  pipelineStageIds: ReadonlySet<string>
): CrmPipelineLeadVolume {
  const activeByStageId: Record<string, number> = {};
  pipelineStageIds.forEach((sid) => {
    activeByStageId[sid] = 0;
  });
  let activeUnassignedStage = 0;
  let activeOtherPipelineStage = 0;

  for (const row of rows) {
    const st = String(row.status ?? "").trim().toLowerCase();
    if (TERMINAL_LEAD_STATUSES.has(st)) continue;
    const sid = row.current_stage_id?.trim();
    if (!sid) {
      activeUnassignedStage += 1;
      continue;
    }
    if (pipelineStageIds.has(sid)) {
      activeByStageId[sid] = (activeByStageId[sid] ?? 0) + 1;
    } else {
      activeOtherPipelineStage += 1;
    }
  }

  return { activeByStageId, activeUnassignedStage, activeOtherPipelineStage };
}
