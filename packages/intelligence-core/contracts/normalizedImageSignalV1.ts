import type { ImageClassificationResultV1 } from "./imageClassificationResultV1";

export const NORMALIZED_IMAGE_SIGNAL_V1_VERSION = 1 as const;

export const IMAGE_SIGNAL_SOURCE_SYSTEMS_V1 = [
  "fi_os",
  "hairaudit",
  "hli",
  "iiohr",
  "surgery_os",
] as const;

export type ImageSignalSourceSystemV1 =
  (typeof IMAGE_SIGNAL_SOURCE_SYSTEMS_V1)[number];

/**
 * Normalized imaging intelligence envelope for cross-system events and
 * analytics. Images remain in local storage; this carries derived signals only.
 */
export interface NormalizedImageSignalV1 {
  schemaVersion: typeof NORMALIZED_IMAGE_SIGNAL_V1_VERSION;
  source_system: ImageSignalSourceSystemV1;
  /** Patient or case subject id in the source system's namespace (opaque string). */
  subject_id: string;
  classification_results: ImageClassificationResultV1[];
  image_metadata: {
    content_type?: string;
    size_bytes?: number;
    /** Storage pointer in source system — opaque; never a public URL. */
    storage_ref?: string;
    captured_at?: string;
  };
  /** Classifier / pipeline version string (e.g. hli-image-classifier@1.0.0). */
  processing_version: string;
}
