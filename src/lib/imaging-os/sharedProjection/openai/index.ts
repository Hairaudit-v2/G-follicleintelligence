/**
 * Public barrel for shared OpenAI projection adapter (ImagingOS).
 * Single OpenAI implementation for illustrative_projected_outcome.
 */

export {
  OPENAI_GPT_IMAGE_MODEL_DEFAULT,
  OPENAI_GPT_IMAGE_PROVIDER_ID,
  buildOpenAiProjectedOutcomeStoragePath,
  createOpenAiGptImageSharedProvider,
} from "./openaiGptImageProvider";
export {
  OPENAI_EDIT_PROMPT_VERSION_V3,
  buildOpenAiProjectedOutcomeEditPrompt,
} from "./openaiEditPrompt";
export { buildRecipientEditMask } from "./treatmentMask";
export { validateProjectedOutcomeAsset, evaluateSeamFlags } from "./outcomeValidation";
export {
  createBoundSharedOpenAiProvider,
  createSharedProjectionStorageDeps,
  SHARED_PROJECTION_STORAGE_BUCKET,
} from "./openaiGptImageStorage.server";
export {
  compositeOutcomeWithinMask,
  normalizeProjectionRaster,
} from "./maskContainmentComposite";
export {
  computeAspectFitLayout,
  padImageToCanvas,
  pickOpenAiEditSize,
  unpadCanvasToSource,
} from "./openaiEditGeometry";
