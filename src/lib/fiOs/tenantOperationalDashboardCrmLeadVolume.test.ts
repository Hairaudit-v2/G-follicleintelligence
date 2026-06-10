import assert from "node:assert/strict";
import { test } from "node:test";

import { calendarDateStringFromInstant } from "@/src/lib/calendar/calendarTimezone";
import { aggregateActiveLeadVolumeByPipelineStage } from "@/src/lib/fiOs/tenantOperationalDashboardCrmLeadVolume";

const STAGE_A = "a0000000-0000-4000-8000-0000000000a1";
const STAGE_B = "b0000000-0000-4000-8000-0000000000b2";
const STAGE_OTHER = "c0000000-0000-4000-8000-0000000000c3";

test("aggregateActiveLeadVolumeByPipelineStage: ignores terminal statuses and buckets unknown stages", () => {
  const pipelineIds = new Set([STAGE_A, STAGE_B]);
  const vol = aggregateActiveLeadVolumeByPipelineStage(
    [
      { current_stage_id: STAGE_A, status: "open" },
      { current_stage_id: STAGE_A, status: "open" },
      { current_stage_id: STAGE_B, status: "in_progress" },
      { current_stage_id: STAGE_OTHER, status: "open" },
      { current_stage_id: null, status: "open" },
      { current_stage_id: STAGE_A, status: "converted" },
      { current_stage_id: STAGE_B, status: "LOST" },
    ],
    pipelineIds
  );

  assert.equal(vol.activeByStageId[STAGE_A], 2);
  assert.equal(vol.activeByStageId[STAGE_B], 1);
  assert.equal(vol.activeOtherPipelineStage, 1);
  assert.equal(vol.activeUnassignedStage, 1);
});

test("aggregateActiveLeadVolumeByPipelineStage: does not read stale lead rows", () => {
  const pipelineIds = new Set([STAGE_A]);
  const vol = aggregateActiveLeadVolumeByPipelineStage([{ current_stage_id: STAGE_A, status: "open" }], pipelineIds);
  assert.equal(vol.activeByStageId[STAGE_A], 1);
});
