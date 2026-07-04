/**
 * ImagingOS capture_source normalization — pure helpers shared by review, ingest, and classifier paths.
 */

import { normalizeFiImageCaptureSource } from "@/src/lib/patientImages/fiImageAttributionCore";
import type { FiImageCaptureSource } from "@/src/lib/patientImages/fiImageAttributionTypes";

export type { FiImageCaptureSource };

export { normalizeFiImageCaptureSource };

/** Compare filter vs row capture sources after alias normalization. */
export function captureSourcesMatchForFilter(
  filterRaw: string | null | undefined,
  actualRaw: string | null | undefined
): boolean {
  const filterKey = String(filterRaw ?? "").trim();
  if (!filterKey) return true;
  const actualKey = String(actualRaw ?? "").trim();
  if (!actualKey) return false;
  return normalizeFiImageCaptureSource(filterKey) === normalizeFiImageCaptureSource(actualKey);
}

/** Resolve FI OS classifier capture_source — prefer request metadata, default wizard ingest source. */
export function resolveFiOsClassifierCaptureSource(
  raw: string | null | undefined
): FiImageCaptureSource {
  const trimmed = String(raw ?? "").trim();
  if (trimmed) return normalizeFiImageCaptureSource(trimmed);
  return "imaging_os_wizard";
}