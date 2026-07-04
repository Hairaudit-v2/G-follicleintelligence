/**
 * FI-IMAGING-WORKSPACE-BRIDGE-CONTRACT-1 — locked export surface for the legacy workspace bridge.
 * Update intentionally when guided-capture workspace/load/mutation consumers need new symbols.
 */

export const WORKSPACE_BRIDGE_VALUE_EXPORTS = [
  "buildGuidedVisitType",
  "IMAGING_ANNOTATION_SCHEMA_VERSION",
  "IMAGING_ANATOMICAL_REGIONS",
  "IMAGING_COMPARE_PRESETS",
  "IMAGING_LIBRARY_AXES",
  "inferCaptureDeviceType",
  "mapTemplateSlugToImagingLibraryAxis",
  "parseProtocolSlots",
  "PROGRESS_META_KEY",
] as const;

export const WORKSPACE_BRIDGE_TYPE_EXPORTS = [
  "ImagingAnatomicalRegion",
  "ImagingLibraryAxis",
  "NormalizedProtocol",
  "ProtocolCatalogSource",
  "ProtocolSlotDef",
] as const;

export const WORKSPACE_BRIDGE_ALLOWED_EXPORTS = [
  ...WORKSPACE_BRIDGE_VALUE_EXPORTS,
  ...WORKSPACE_BRIDGE_TYPE_EXPORTS,
] as const;

/** Sole legacy file permitted to import from canonical `imaging-os/*`. */
export const LEGACY_WORKSPACE_BRIDGE_FILE = "src/lib/imagingOs/imagingOsWorkspaceBridge.ts" as const;

/** Canonical module targeted by the sole legacy cross-tree bridge. */
export const CANONICAL_WORKSPACE_BRIDGE_SPECIFIER =
  "@/src/lib/imaging-os/workspaceBridge" as const;