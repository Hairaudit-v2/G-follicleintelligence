/**
 * Focused ImagingOS entry point — AI analysis kinds and job status vocabulary.
 * Prefer this over the catch-all `@/src/lib/imaging-os` barrel for UI and job enqueue paths.
 */

export {
  IMAGING_AI_ANALYSIS_KINDS,
  isImagingAiAnalysisKind,
  type ImagingAiAnalysisKind,
  type ImagingAiJobStatus,
} from "./imagingAiAnalysisKinds";
