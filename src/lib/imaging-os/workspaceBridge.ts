/**
 * Canonical legacy-workspace bridge — aggregated exports for the imagingOs workspace layer.
 * Prefer focused modules (`protocolSlotVocabulary`, `imagingLibraryVocabulary`, etc.) in new code.
 */

export {
  buildGuidedVisitType,
  IMAGING_ANNOTATION_SCHEMA_VERSION,
  IMAGING_ANATOMICAL_REGIONS,
  IMAGING_COMPARE_PRESETS,
  IMAGING_LIBRARY_AXES,
  inferCaptureDeviceType,
  mapTemplateSlugToImagingLibraryAxis,
  type ImagingAnatomicalRegion,
  type ImagingLibraryAxis,
} from "./imagingLibraryVocabulary";

export type { ProtocolSlotDef } from "./protocolSlotVocabulary";
export { parseProtocolSlots, PROGRESS_META_KEY } from "./protocolSlotVocabulary";

export { loadResolvedProtocol, loadResolvedProtocolSlots } from "./protocolCatalogResolver.server";
export type {
  NormalizedProtocol,
  ProtocolCatalogSource,
} from "./protocolCatalogResolverCore";