import "server-only";

import { buildFiPathologyMedicalIntelligenceDisplay } from "@/src/lib/clinical-intelligence/fiPathologyMedicalIntelligence.server";
import type { FiMedicalIntelligenceDisplay } from "@/src/lib/clinical-intelligence/fiPathologyMedicalIntelligenceTypes";
import type { PathologyResultItemRow } from "@/src/lib/pathology/pathologyResultTypes";
import {
  normalizedMarkersToResultItemInputs,
  type NormalizedPathologyMarker,
} from "@/src/lib/pathology/pathologyMarkerNormalize";

function syntheticPreviewItems(markers: NormalizedPathologyMarker[]): PathologyResultItemRow[] {
  const inputs = normalizedMarkersToResultItemInputs(markers);
  return inputs.map((item, idx) => ({
    id: `preview-${idx + 1}`,
    tenant_id: "preview",
    result_id: "preview",
    test_code: item.test_code,
    test_label: item.test_label,
    result_value: item.result_value,
    result_unit: item.result_unit,
    reference_range: item.reference_range,
    flag: item.flag,
    sort_order: idx,
    metadata: {},
    created_at: new Date().toISOString(),
  }));
}

/** Build live medical intelligence preview from extracted (not yet reviewed) markers. */
export function buildPathologyMedicalIntelligencePreview(
  markers: NormalizedPathologyMarker[]
): FiMedicalIntelligenceDisplay | null {
  const items = syntheticPreviewItems(markers);
  if (items.length === 0) return null;

  return buildFiPathologyMedicalIntelligenceDisplay({
    result: {
      id: "preview",
      result_date: new Date().toISOString().slice(0, 10),
      status: "draft",
      metadata: {},
    },
    items,
    computedAt: new Date().toISOString(),
  });
}
