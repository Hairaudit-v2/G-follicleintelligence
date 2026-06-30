import "server-only";

import type {
  FiAiImageClassificationResult,
  HliClinicalUseContext,
  HliSourceSystem,
} from "../types";
import { classifyClinicalHairImageFromModelUrl } from "../classifyClinicalHairImage.server";
import {
  classificationResultToHliInsert,
  insertHliImageClassificationRow,
} from "../persistHliClassification.server";

export type HairAuditImageClassificationInput = {
  tenantId: string | null;
  patientId: string | null;
  caseId: string | null;
  auditImageRecordId: string;
  /** Time-limited URL for the vision model — never log or return to clients. */
  imageUrlForModel: string;
  /** Storage reference to persist (e.g. `bucket:path` or opaque audit storage key). */
  storageRefForLedger: string;
  clinicalUseContext: HliClinicalUseContext;
};

/**
 * HairAudit adapter: runs the shared classifier and appends an `hli_image_classifications` row.
 * Wire to HairAudit image tables when those land in this repo.
 */
export async function classifyHairAuditImageAndPersist(
  input: HairAuditImageClassificationInput
): Promise<{
  result: FiAiImageClassificationResult;
  classifierVersion: string;
  usedOpenAi: boolean;
}> {
  const { result, classifierVersion, usedOpenAi } = await classifyClinicalHairImageFromModelUrl({
    imageUrlForModel: input.imageUrlForModel,
  });
  await insertHliImageClassificationRow(
    classificationResultToHliInsert({
      sourceSystem: "hairaudit" satisfies HliSourceSystem,
      sourceRecordId: input.auditImageRecordId.trim(),
      tenantId: input.tenantId,
      patientId: input.patientId,
      caseId: input.caseId,
      storageRef: input.storageRefForLedger.trim(),
      clinicalUseContext: input.clinicalUseContext,
      result,
      classifierVersion,
    })
  );
  return { result, classifierVersion, usedOpenAi };
}
