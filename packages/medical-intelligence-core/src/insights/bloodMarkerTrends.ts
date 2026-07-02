/**
 * Phase I: Longitudinal blood marker trends and comparison.
 * Pure comparison logic; HLI supplies marker rows from persistence.
 */

import { getNormalisedMarkerKey, KEY_MARKERS_FOR_TRENDS } from "../biomarkers/bloodInterpretation";
import { getDisplayLabel } from "../biomarkers/bloodMarkerRegistry";

export type MarkerSnapshot = {
  value: number;
  unit: string | null;
  collected_at: string | null;
  intake_id: string;
  marker_name: string;
};

export type MarkerTrendRow = {
  markerKey: string;
  displayName: string;
  current: MarkerSnapshot;
  previous: MarkerSnapshot | null;
  direction: "up" | "down" | "stable" | null;
};

export type BloodResultMarkerRowInput = {
  marker_name: string;
  value: number;
  unit: string | null;
  collected_at: string | null;
  intake_id: string;
  created_at?: string | null;
};

function toSnapshot(row: BloodResultMarkerRowInput): MarkerSnapshot {
  return {
    value: row.value,
    unit: row.unit,
    collected_at: row.collected_at,
    intake_id: row.intake_id,
    marker_name: row.marker_name,
  };
}

/**
 * Retrieve profile-level marker history grouped by normalised marker name.
 * Each group is sorted by collected_at desc (nulls last).
 */
export function groupProfileMarkerHistory(
  rows: BloodResultMarkerRowInput[]
): Record<string, MarkerSnapshot[]> {
  const grouped: Record<string, MarkerSnapshot[]> = {};
  for (const r of rows) {
    const key = getNormalisedMarkerKey(r.marker_name);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(toSnapshot(r));
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => {
      const aVal = a.collected_at ?? "";
      const bVal = b.collected_at ?? "";
      if (aVal !== bVal) return bVal.localeCompare(aVal);
      return 0;
    });
  }
  return grouped;
}

/**
 * Current vs previous comparison for an intake using supplied marker rows.
 */
export function buildCurrentVsPreviousTrendRows(
  currentRows: BloodResultMarkerRowInput[],
  profileRows: BloodResultMarkerRowInput[],
  intake_id: string
): MarkerTrendRow[] {
  const grouped = groupProfileMarkerHistory(profileRows);

  const currentByKey = new Map<string, MarkerSnapshot>();
  for (const r of currentRows) {
    const key = getNormalisedMarkerKey(r.marker_name);
    if (!currentByKey.has(key)) {
      currentByKey.set(key, toSnapshot(r));
    }
  }

  const result: MarkerTrendRow[] = [];
  for (const [key, current] of currentByKey) {
    const history = grouped[key] ?? [];
    const previousCandidates = history.filter((s) => s.intake_id !== intake_id);
    const previous = previousCandidates.length > 0 ? previousCandidates[0] : null;

    let direction: "up" | "down" | "stable" | null = null;
    if (previous) {
      if (current.value > previous.value) direction = "up";
      else if (current.value < previous.value) direction = "down";
      else direction = "stable";
    }

    result.push({
      markerKey: key,
      displayName: getDisplayLabel(current.marker_name) || current.marker_name,
      current,
      previous,
      direction,
    });
  }

  result.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return result;
}

/**
 * Whether supplied rows have enough data for a meaningful trend view.
 */
export function profileHasTrendDataFromRows(rows: BloodResultMarkerRowInput[]): boolean {
  if (rows.length < 2) return false;
  const intakeIds = new Set(rows.map((r) => r.intake_id));
  const dates = new Set(rows.map((r) => r.collected_at ?? r.created_at).filter(Boolean));
  return intakeIds.size > 1 || dates.size > 1;
}

export { KEY_MARKERS_FOR_TRENDS };
