/**
 * Focused ImagingOS entry point — capture_source normalization and FI attribution types.
 */

export {
  captureSourcesMatchForFilter,
  normalizeFiImageCaptureSource,
  resolveFiOsClassifierCaptureSource,
  type FiImageCaptureSource,
} from "./imagingCaptureSourceCore";

export {
  FI_IMAGE_CAPTURE_SOURCES,
  FI_IMAGE_CAPTURE_TYPES,
} from "@/src/lib/patientImages/fiImageAttributionTypes";
