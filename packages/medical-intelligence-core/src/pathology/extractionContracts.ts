/** Contracts for blood marker extraction draft workflow. */

export type ExtractedBloodMarker = {
  name: string;
  value: string | number | null;
  unit?: string;
  referenceRange?: string;
  flag?: "low" | "normal" | "high" | "critical";
  confidence: number;
};

export type ExtractedBloodMarkerWithSource = ExtractedBloodMarker & {
  sourceFile?: string;
};

export type SourceDocumentMeta = {
  id: string;
  filename: string | null;
  blood_request_id: string | null;
};

export type ExistingBloodResultMarker = {
  marker_name: string;
  value: number;
  unit: string | null;
  reference_low: number | null;
  reference_high: number | null;
};

export type CreateBloodMarkerExtractionDraftPayload = {
  profile_id: string;
  intake_id: string;
  document_id?: string | null;
  blood_request_id?: string | null;
  marker_name: string;
  display_name: string;
  raw_marker_name?: string | null;
  value: number;
  unit?: string | null;
  reference_low?: number | null;
  reference_high?: number | null;
  raw_reference_range?: string | null;
  confidence?: number | null;
  source_filename?: string | null;
  extraction_version?: string;
};
