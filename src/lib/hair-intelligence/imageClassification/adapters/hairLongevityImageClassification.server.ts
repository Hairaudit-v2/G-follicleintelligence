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

export type HairLongevityImageClassificationInput = {
  tenantId: string | null;
  patientId: string | null;
  hliImageRecordId: string;
  imageUrlForModel: string;
  storageRefForLedger: string;
  clinicalUseContext: HliClinicalUseContext;
};

/**
 * Hair Longevity adapter: shared classifier + HLI ledger row for intake/progress photography.
 */
export async function classifyHairLongevityImageAndPersist(
  input: HairLongevityImageClassificationInput
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
      sourceSystem: "hair_longevity" satisfies HliSourceSystem,
      sourceRecordId: input.hliImageRecordId.trim(),
      tenantId: input.tenantId,
      patientId: input.patientId,
      caseId: null,
      storageRef: input.storageRefForLedger.trim(),
      clinicalUseContext: input.clinicalUseContext,
      result,
      classifierVersion,
    })
  );
  return { result, classifierVersion, usedOpenAi };
}
