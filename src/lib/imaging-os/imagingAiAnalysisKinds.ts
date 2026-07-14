/**
 * Canonical ImagingOS AI analysis kinds — single source of truth for UI and jobs.
 */

export const IMAGING_AI_ANALYSIS_KINDS = [
  "density_estimate",
  "norwood_grade",
  "donor_assessment",
  "recipient_assessment",
  "clinical_image_analysis",
  "outcome_score",
  "graft_tray_count_estimate",
] as const;

export type ImagingAiAnalysisKind = (typeof IMAGING_AI_ANALYSIS_KINDS)[number];

export type ImagingAiJobStatus = "queued" | "running" | "completed" | "failed" | "superseded";

export function isImagingAiAnalysisKind(raw: unknown): raw is ImagingAiAnalysisKind {
  const value = String(raw ?? "").trim();
  return (IMAGING_AI_ANALYSIS_KINDS as readonly string[]).includes(value);
}
