/**
 * ImagingOS — image quality evaluation contract (Phase IM-1).
 * Stub evaluator only; no pixel analysis.
 */

export type ImageQualityStatus = "pass" | "warn" | "fail" | "not_evaluated";

export type ImageQualityScores = {
  blur_score: number | null;
  lighting_score: number | null;
  angle_score: number | null;
  resolution_score: number | null;
  occlusion_score: number | null;
};

export type ImageQualityResult = ImageQualityScores & {
  quality_status: ImageQualityStatus;
  notes: string;
};

export type ImageQualityStubInput = {
  content_type?: string | null;
  file_size_bytes?: number | null;
};

/**
 * Deterministic stub — returns not_evaluated until IM-2+ pixel/heuristic pipeline exists.
 */
export function evaluateImageQualityStub(_input: ImageQualityStubInput = {}): ImageQualityResult {
  return {
    quality_status: "not_evaluated",
    blur_score: null,
    lighting_score: null,
    angle_score: null,
    resolution_score: null,
    occlusion_score: null,
    notes: "Quality evaluation not run (ImagingOS IM-1 stub)",
  };
}
