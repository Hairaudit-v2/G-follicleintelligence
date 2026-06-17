/**
 * ImagingOS — HairAudit live AI adapter (Phase IM-12).
 * Executes feature-flag protected AI vision tasks via the IM-12 execution engine.
 */

import type { ImagingOsAiFeatureFlags } from "../liveAi";
import { executeImagingAiVisionTask, type ExecuteImagingAiVisionTaskResult } from "../liveAi";
import type { ImagingOsAiVisionRequestContract } from "../aiVision";

export type RunHairAuditAiTaskInput = {
  request: ImagingOsAiVisionRequestContract;
  flags?: ImagingOsAiFeatureFlags;
};

/** Run a HairAudit AI vision task through the IM-12 live execution engine (pure stub). */
export async function runHairAuditAiTask(
  input: RunHairAuditAiTaskInput
): Promise<ExecuteImagingAiVisionTaskResult> {
  return executeImagingAiVisionTask({
    request: input.request,
    ...(input.flags ? { flags: input.flags } : {}),
  });
}
