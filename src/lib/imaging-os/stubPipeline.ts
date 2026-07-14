/**
 * ImagingOS — IM-1 stub pipeline orchestration.
 * Direct import path for consumers migrating off the catch-all barrel.
 */

import type { ClassifyImageCategoryStubInput } from "./classification";
import { classifyImageCategoryStub } from "./classification";
import type { BuildImagingIntakeInput } from "./intake";
import { buildImagingIntakeRecord } from "./intake";
import { evaluateImageProtocolStub } from "./protocol";
import type { ImageQualityStubInput } from "./quality";
import { evaluateImageQualityStub } from "./quality";
import type { ImagingOsAnalysisSnapshot } from "./types";

/** Run the IM-1 stub pipeline: intake validation → quality → protocol → classification. */
export function runImagingOsStubPipeline(
  intakeInput: BuildImagingIntakeInput,
  classifyInput: Omit<ClassifyImageCategoryStubInput, "external_category"> & {
    external_category?: string;
  } = {}
):
  | { ok: true; snapshot: ImagingOsAnalysisSnapshot }
  | { ok: false; error: string; field?: string } {
  const intakeResult = buildImagingIntakeRecord(intakeInput);
  if (!intakeResult.ok) return intakeResult;

  const externalCategory =
    classifyInput.external_category?.trim() ||
    intakeResult.intake.external_category?.trim() ||
    "other";

  const quality = evaluateImageQualityStub({
    content_type: intakeResult.intake.content_type,
    file_size_bytes: intakeResult.intake.file_size_bytes,
  } satisfies ImageQualityStubInput);

  const protocol = evaluateImageProtocolStub();
  const classification = classifyImageCategoryStub({
    external_category: externalCategory,
    legacy_upload_type:
      classifyInput.legacy_upload_type ?? intakeResult.intake.legacy_upload_type ?? null,
    idempotency_key: classifyInput.idempotency_key ?? intakeResult.intake.idempotency_key,
  });

  return {
    ok: true,
    snapshot: {
      intake: intakeResult.intake,
      quality,
      protocol,
      classification,
    },
  };
}
