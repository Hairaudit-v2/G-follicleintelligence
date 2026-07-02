/**
 * Pure builder for FI pathology medical intelligence display payloads.
 * Delegates interpretation to medicalIntelligenceCore (shared HLI package).
 */

import type { PathologyResultItemRow, PathologyResultRow } from "@/src/lib/pathology/pathologyResultTypes";
import {
  buildFiClinicalInsights,
  interpretFiPathologyMarkers,
} from "@/src/lib/clinical-intelligence/medicalIntelligenceCore";
import {
  FI_MEDICAL_INTELLIGENCE_SOURCE,
  type FiMedicalIntelligenceClinicalFlag,
  type FiMedicalIntelligenceDisplay,
  type FiMedicalIntelligenceInterpretedMarkerDisplay,
  type FiMedicalIntelligenceTwinSummary,
} from "@/src/lib/clinical-intelligence/fiPathologyMedicalIntelligenceTypes";

export type BuildFiPathologyMedicalIntelligenceInput = {
  result: Pick<PathologyResultRow, "id" | "result_date" | "status" | "metadata">;
  items: PathologyResultItemRow[];
  /** ISO timestamp for display; defaults to now when omitted. */
  computedAt?: string;
};

function uniqueClinicalFlags(
  markers: FiMedicalIntelligenceInterpretedMarkerDisplay[]
): Array<Exclude<FiMedicalIntelligenceClinicalFlag, null>> {
  const flags = new Set<Exclude<FiMedicalIntelligenceClinicalFlag, null>>();
  for (const m of markers) {
    if (m.clinical_flag) flags.add(m.clinical_flag);
  }
  return Array.from(flags);
}

function mapInterpretedMarker(
  marker: ReturnType<typeof interpretFiPathologyMarkers>["interpreted"][number]
): FiMedicalIntelligenceInterpretedMarkerDisplay {
  return {
    marker: marker.marker,
    value: marker.value,
    unit: marker.unit,
    status: marker.status,
    clinical_flag: marker.clinical_flag,
    explanation: marker.explanation,
  };
}

function isValidSnapshot(value: unknown): value is FiMedicalIntelligenceDisplay {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    v.source === FI_MEDICAL_INTELLIGENCE_SOURCE &&
    v.clinicianReviewRequired === true &&
    Array.isArray(v.interpretedMarkers)
  );
}

export function readFiMedicalIntelligenceSnapshot(
  metadata: Record<string, unknown> | null | undefined
): FiMedicalIntelligenceDisplay | null {
  const raw = metadata?.medical_intelligence_snapshot;
  if (!isValidSnapshot(raw)) return null;
  return raw;
}

/** Build read-only medical intelligence display from FI pathology result items. */
export function buildFiPathologyMedicalIntelligenceDisplay(
  input: BuildFiPathologyMedicalIntelligenceInput
): FiMedicalIntelligenceDisplay | null {
  const status = input.result.status;
  if (status !== "draft" && status !== "reviewed") return null;

  const snapshot = readFiMedicalIntelligenceSnapshot(input.result.metadata);
  if (snapshot) {
    return { ...snapshot, fromSnapshot: true };
  }

  const { interpreted, mapping } = interpretFiPathologyMarkers(input.items);
  const insights = buildFiClinicalInsights({ pathologyItems: input.items });
  const interpretedMarkers = interpreted.map(mapInterpretedMarker);

  return {
    source: FI_MEDICAL_INTELLIGENCE_SOURCE,
    clinicianReviewRequired: true,
    computedAt: input.computedAt ?? new Date().toISOString(),
    fromSnapshot: false,
    interpretedMarkers,
    skippedMarkerCount: mapping.skipped.length,
    clinicalFlags: uniqueClinicalFlags(interpretedMarkers),
    activeDrivers: insights.activeDrivers,
    clinicianInsights: insights.clinicianInsights,
    patientSafeInsights: insights.patientSafeInsights,
    followUpConsiderations: insights.followUpConsiderations,
  };
}

export function buildFiMedicalIntelligenceTwinSummary(
  input: BuildFiPathologyMedicalIntelligenceInput
): FiMedicalIntelligenceTwinSummary | null {
  const display = buildFiPathologyMedicalIntelligenceDisplay(input);
  if (!display) return null;
  const insightPreview =
    display.clinicianInsights[0]?.trim() ||
    display.activeDrivers[0]?.trim() ||
    null;
  return {
    pathology_result_id: input.result.id,
    result_date: input.result.result_date,
    status: input.result.status,
    interpreted_marker_count: display.interpretedMarkers.length,
    clinical_flags: display.clinicalFlags,
    active_drivers: display.activeDrivers.slice(0, 4),
    insight_preview: insightPreview,
  };
}
