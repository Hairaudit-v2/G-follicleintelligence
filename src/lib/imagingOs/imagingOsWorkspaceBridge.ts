/**
 * @deprecated Sole intentional legacy cross-tree bridge for the imagingOs workspace layer.
 * Import from `@/src/lib/imaging-os/workspaceBridge` or focused canonical modules in new code.
 * Future migration should eliminate this file by moving legacy workspace ownership canonical-side.
 */
export {
  buildGuidedVisitType,
  IMAGING_ANNOTATION_SCHEMA_VERSION,
  IMAGING_ANATOMICAL_REGIONS,
  IMAGING_COMPARE_PRESETS,
  IMAGING_LIBRARY_AXES,
  inferCaptureDeviceType,
  mapTemplateSlugToImagingLibraryAxis,
  parseProtocolSlots,
  PROGRESS_META_KEY,
  type ImagingAnatomicalRegion,
  type ImagingLibraryAxis,
  type NormalizedProtocol,
  type ProtocolCatalogSource,
  type ProtocolSlotDef,
} from "@/src/lib/imaging-os/workspaceBridge";
