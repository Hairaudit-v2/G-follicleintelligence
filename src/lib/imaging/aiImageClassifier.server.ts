import "server-only";

export { classifyFiPatientImageAndPersist } from "@/src/lib/hair-intelligence/imageClassification/adapters/fiOsPatientImageClassification.server";
export { classifyClinicalHairImageFromModelUrl } from "@/src/lib/hair-intelligence/imageClassification/classifyClinicalHairImage.server";
export {
  hairImageClassificationNotConfiguredResult,
  isOpenAiApiKeyConfigured,
} from "@/src/lib/hair-intelligence/imageClassification/classifyClinicalHairImageFallback";
