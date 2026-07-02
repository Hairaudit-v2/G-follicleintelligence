/**
 * Pure builder for FI pathology medical intelligence display payloads.
 * Delegates interpretation to medicalIntelligenceCore (shared HLI package).
 */

import { createRequire } from "node:module";

import type { PathologyResultItemRow, PathologyResultRow } from "@/src/lib/pathology/pathologyResultTypes";
import {
  buildFiClinicalInsights,
  interpretFiPathologyMarkers,
} from "@/src/lib/clinical-intelligence/medicalIntelligenceCore";
import {
  FI_MEDICAL_INTELLIGENCE_SNAPSHOT_SOURCE,
  FI_MEDICAL_INTELLIGENCE_SOURCE,
  type FiMedicalIntelligenceClinicalFlag,
  type FiMedicalIntelligenceDisplay,
  type FiMedicalIntelligenceInterpretedMarkerDisplay,
  type FiMedicalIntelligenceSnapshotMetadata,
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

let cachedPackageVersion: string | null | undefined;

/** Resolve @hairlongevity/medical-intelligence-core version when installed (audit metadata). */
export function resolveMedicalIntelligencePackageVersion(): string | null {
  if (cachedPackageVersion !== undefined) return cachedPackageVersion;
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("@hairlongevity/medical-intelligence-core/package.json") as {
      version?: string;
    };
    cachedPackageVersion = pkg.version?.trim() || null;
  } catch {
    cachedPackageVersion = null;
  }
  return cachedPackageVersion;
}

function isLegacyDisplaySnapshot(value: unknown): value is FiMedicalIntelligenceDisplay {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    v.source === FI_MEDICAL_INTELLIGENCE_SOURCE &&
    v.clinicianReviewRequired === true &&
    Array.isArray(v.interpretedMarkers)
  );
}

function isPersistedMetadataSnapshot(value: unknown): value is FiMedicalIntelligenceSnapshotMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    v.source === FI_MEDICAL_INTELLIGENCE_SNAPSHOT_SOURCE &&
    typeof v.generated_at === "string" &&
    Array.isArray(v.interpreted_markers)
  );
}

function persistedSnapshotToDisplay(
  raw: FiMedicalIntelligenceSnapshotMetadata
): FiMedicalIntelligenceDisplay {
  return {
    source: FI_MEDICAL_INTELLIGENCE_SOURCE,
    clinicianReviewRequired: true,
    computedAt: raw.generated_at,
    fromSnapshot: true,
    interpretedMarkers: raw.interpreted_markers,
    skippedMarkerCount: raw.skipped_marker_count,
    clinicalFlags: raw.active_flags,
    activeDrivers: raw.active_drivers,
    clinicianInsights: raw.clinician_insights,
    patientSafeInsights: [],
    followUpConsiderations: [],
  };
}

export function readFiMedicalIntelligenceSnapshot(
  metadata: Record<string, unknown> | null | undefined
): FiMedicalIntelligenceDisplay | null {
  const raw = metadata?.medical_intelligence_snapshot;
  if (isLegacyDisplaySnapshot(raw)) return { ...raw, fromSnapshot: true };
  if (isPersistedMetadataSnapshot(raw)) return persistedSnapshotToDisplay(raw);
  return null;
}

/** Build audit snapshot for fi_pathology_results.metadata on clinician review. */
export function buildFiMedicalIntelligenceSnapshot(
  input: BuildFiPathologyMedicalIntelligenceInput
): FiMedicalIntelligenceSnapshotMetadata {
  const generatedAt = input.computedAt ?? new Date().toISOString();
  const { interpreted, mapping } = interpretFiPathologyMarkers(input.items);
  const insights = buildFiClinicalInsights({ pathologyItems: input.items });
  const interpretedMarkers = interpreted.map(mapInterpretedMarker);

  return {
    source: FI_MEDICAL_INTELLIGENCE_SNAPSHOT_SOURCE,
    generated_at: generatedAt,
    package_version: resolveMedicalIntelligencePackageVersion(),
    interpreted_markers: interpretedMarkers,
    active_flags: uniqueClinicalFlags(interpretedMarkers),
    active_drivers: insights.activeDrivers,
    clinician_insights: insights.clinicianInsights,
    skipped_marker_count: mapping.skipped.length,
  };
}

export function mergeMedicalIntelligenceSnapshotIntoMetadata(
  metadata: Record<string, unknown>,
  snapshot: FiMedicalIntelligenceSnapshotMetadata
): Record<string, unknown> {
  return {
    ...metadata,
    medical_intelligence_snapshot: snapshot,
  };
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
