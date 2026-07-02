import { getDefaultUnit, getDisplayLabel, getMarkerDefinition, resolveMarkerKey } from "../biomarkers/bloodMarkerRegistry";
import type {
  CreateBloodMarkerExtractionDraftPayload,
  ExistingBloodResultMarker,
  ExtractedBloodMarkerWithSource,
  SourceDocumentMeta,
} from "./extractionContracts";

function parseDocumentIdFromSourceFile(sourceFile?: string): string | null {
  if (!sourceFile) return null;
  const separatorIndex = sourceFile.indexOf("__");
  if (separatorIndex <= 0) return null;
  return sourceFile.slice(0, separatorIndex);
}

function getOriginalFilename(sourceFile?: string): string | null {
  if (!sourceFile) return null;
  const separatorIndex = sourceFile.indexOf("__");
  if (separatorIndex <= 0) return sourceFile;
  return sourceFile.slice(separatorIndex + 2);
}

function parseReferenceRange(input?: string): { low: number | null; high: number | null } {
  if (!input) return { low: null, high: null };
  const rangeMatch = input.match(/(\d+\.?\d*)\s*[-–to]+\s*(\d+\.?\d*)/i);
  if (rangeMatch) {
    return {
      low: Number(rangeMatch[1]),
      high: Number(rangeMatch[2]),
    };
  }
  const inequalityMatch = input.match(/([<>])\s*(\d+\.?\d*)/);
  if (inequalityMatch) {
    return inequalityMatch[1] === "<"
      ? { low: null, high: Number(inequalityMatch[2]) }
      : { low: Number(inequalityMatch[2]), high: null };
  }
  return { low: null, high: null };
}

function buildMarkerFingerprint(input: {
  marker_name: string;
  value: number;
  unit: string | null;
  reference_low: number | null;
  reference_high: number | null;
}): string {
  return [
    resolveMarkerKey(input.marker_name),
    input.value,
    input.unit?.trim().toLowerCase() ?? "",
    input.reference_low ?? "",
    input.reference_high ?? "",
  ].join("|");
}

export function buildDraftsFromExtractedMarkers(params: {
  profile_id: string;
  intake_id: string;
  markers: ExtractedBloodMarkerWithSource[];
  sourceDocuments: SourceDocumentMeta[];
  existingMarkers?: ExistingBloodResultMarker[];
}): CreateBloodMarkerExtractionDraftPayload[] {
  const documentById = new Map<string, SourceDocumentMeta>(
    params.sourceDocuments.map((doc) => [doc.id, doc])
  );
  const existingFingerprints = new Set(
    (params.existingMarkers ?? []).map((row) =>
      buildMarkerFingerprint({
        marker_name: row.marker_name,
        value: row.value,
        unit: row.unit,
        reference_low: row.reference_low,
        reference_high: row.reference_high,
      })
    )
  );
  const seenDrafts = new Set<string>();
  const drafts: CreateBloodMarkerExtractionDraftPayload[] = [];

  for (const marker of params.markers) {
    if (typeof marker.value !== "number" || !Number.isFinite(marker.value)) continue;
    const trimmedName = marker.name?.trim();
    if (!trimmedName) continue;

    const normalizedName = resolveMarkerKey(trimmedName);
    const definition = getMarkerDefinition(normalizedName);
    const displayName = definition ? getDisplayLabel(normalizedName) : trimmedName;
    const documentId = parseDocumentIdFromSourceFile(marker.sourceFile);
    const sourceDocument = documentId ? documentById.get(documentId) ?? null : null;
    const sourceFilename = sourceDocument?.filename ?? getOriginalFilename(marker.sourceFile);
    const unit = marker.unit?.trim() || (definition ? getDefaultUnit(normalizedName) : null) || null;
    const { low, high } = parseReferenceRange(marker.referenceRange);
    const fingerprint = buildMarkerFingerprint({
      marker_name: normalizedName,
      value: marker.value,
      unit,
      reference_low: low,
      reference_high: high,
    });

    if (existingFingerprints.has(fingerprint) || seenDrafts.has(fingerprint)) {
      continue;
    }
    seenDrafts.add(fingerprint);

    drafts.push({
      profile_id: params.profile_id,
      intake_id: params.intake_id,
      document_id: sourceDocument?.id ?? null,
      blood_request_id: sourceDocument?.blood_request_id ?? null,
      marker_name: normalizedName,
      display_name: displayName,
      raw_marker_name: trimmedName === normalizedName ? null : trimmedName,
      value: marker.value,
      unit,
      reference_low: low,
      reference_high: high,
      raw_reference_range: marker.referenceRange?.trim() || null,
      confidence: marker.confidence,
      source_filename: sourceFilename,
    });
  }

  return drafts;
}

export type {
  CreateBloodMarkerExtractionDraftPayload,
  ExistingBloodResultMarker,
  ExtractedBloodMarker,
  ExtractedBloodMarkerWithSource,
  SourceDocumentMeta,
} from "./extractionContracts";
