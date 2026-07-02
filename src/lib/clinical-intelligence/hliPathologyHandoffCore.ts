/**
 * Pure HLI pathology handoff payload builder (testable without server deps).
 */

import type { PathologyResultItemRow, PathologyResultRow } from "./pathologyResultTypes";
import type { NormalizedPathologyMarker } from "./pathologyMarkerNormalize";

export type HliPathologyMarkerPayload = {
  testCode: string | null;
  label: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  flag: string;
  confidence: number | null;
  source: "extraction" | "manual" | "result_item";
};

export type HliPathologyClinicalContext = {
  sex: string | null;
  age: number | null;
  diagnosisContext: string | null;
  consultationId: string | null;
  surgeryCaseId: string | null;
  medicationContext: string | null;
};

export type HliPathologyHandoffPayload = {
  tenantId: string;
  patientId: string;
  pathologyResultId: string;
  observedAt: string;
  markers: HliPathologyMarkerPayload[];
  clinicalContext: HliPathologyClinicalContext;
};

function markerFromResultItem(item: PathologyResultItemRow): HliPathologyMarkerPayload {
  const meta = item.metadata ?? {};
  const confidence =
    typeof meta.extraction_confidence === "number" && Number.isFinite(meta.extraction_confidence)
      ? meta.extraction_confidence
      : null;
  const sourceRaw = meta.marker_source;
  const source =
    sourceRaw === "extraction" || sourceRaw === "manual" ? sourceRaw : "result_item";
  return {
    testCode: item.test_code,
    label: item.test_label,
    value: item.result_value,
    unit: item.result_unit,
    referenceRange: item.reference_range,
    flag: item.flag,
    confidence,
    source,
  };
}

function markerFromNormalized(item: NormalizedPathologyMarker): HliPathologyMarkerPayload {
  return {
    testCode: item.test_code,
    label: item.test_label,
    value: item.result_value,
    unit: item.result_unit,
    referenceRange: item.reference_range,
    flag: item.flag,
    confidence: item.confidence,
    source: item.source,
  };
}

export function buildHliPathologyHandoffPayload(input: {
  result: PathologyResultRow;
  items: PathologyResultItemRow[];
  clinicalContext?: Partial<HliPathologyClinicalContext>;
}): HliPathologyHandoffPayload {
  const ctx = input.clinicalContext ?? {};
  return {
    tenantId: input.result.tenant_id,
    patientId: input.result.patient_id,
    pathologyResultId: input.result.id,
    observedAt: input.result.result_date,
    markers: input.items.map(markerFromResultItem),
    clinicalContext: {
      sex: ctx.sex ?? null,
      age: ctx.age ?? null,
      diagnosisContext: ctx.diagnosisContext ?? null,
      consultationId: ctx.consultationId ?? null,
      surgeryCaseId: ctx.surgeryCaseId ?? null,
      medicationContext: ctx.medicationContext ?? null,
    },
  };
}

export function buildHliPathologyHandoffPayloadFromNormalized(input: {
  tenantId: string;
  patientId: string;
  pathologyResultId: string;
  observedAt: string;
  markers: NormalizedPathologyMarker[];
  clinicalContext?: Partial<HliPathologyClinicalContext>;
}): HliPathologyHandoffPayload {
  const ctx = input.clinicalContext ?? {};
  return {
    tenantId: input.tenantId,
    patientId: input.patientId,
    pathologyResultId: input.pathologyResultId,
    observedAt: input.observedAt,
    markers: input.markers.map(markerFromNormalized),
    clinicalContext: {
      sex: ctx.sex ?? null,
      age: ctx.age ?? null,
      diagnosisContext: ctx.diagnosisContext ?? null,
      consultationId: ctx.consultationId ?? null,
      surgeryCaseId: ctx.surgeryCaseId ?? null,
      medicationContext: ctx.medicationContext ?? null,
    },
  };
}
