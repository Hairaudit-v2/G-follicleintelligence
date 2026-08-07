/**
 * Graft Allocation Map model + SVG render helpers (artifact_type = graft_allocation_map).
 * Never labels output as projected outcome.
 */

import {
  allocationMapWarnings,
  totalGraftsFromZones,
  type PlannedZoneRow,
} from "@/src/lib/cases/surgeryPlanningTypes";
import {
  assertAllocationMapLabelSafe,
  labelForArtifactType,
} from "@follicle/projection-core";

export type AllocationMapViewModel = {
  artifactType: "graft_allocation_map";
  patientSafeLabel: string;
  planId: string | null;
  planVersionLabel: string;
  planningStatus: string | null;
  zones: PlannedZoneRow[];
  totalGrafts: number;
  estimatedGraftsMin: number | null;
  estimatedGraftsMax: number | null;
  deferredZones: string[];
  unassessedZones: string[];
  warnings: string[];
  sourceImageRef: string | null;
  boundToPlan: boolean;
};

export function buildAllocationMapViewModel(input: {
  planId: string | null;
  planningStatus: string | null;
  planUpdatedAt: string | null;
  zones: PlannedZoneRow[];
  estimatedGraftsMin: number | null;
  estimatedGraftsMax: number | null;
  sourceImageRef?: string | null;
}): AllocationMapViewModel {
  const label = `${labelForArtifactType("graft_allocation_map")} · Clinical planning view`;
  assertAllocationMapLabelSafe(label);

  return {
    artifactType: "graft_allocation_map",
    patientSafeLabel: label,
    planId: input.planId,
    planVersionLabel: input.planUpdatedAt
      ? `plan@${input.planUpdatedAt.slice(0, 19)}`
      : "unversioned",
    planningStatus: input.planningStatus,
    zones: input.zones,
    totalGrafts: totalGraftsFromZones(input.zones),
    estimatedGraftsMin: input.estimatedGraftsMin,
    estimatedGraftsMax: input.estimatedGraftsMax,
    deferredZones: input.zones.filter((z) => z.deferred).map((z) => z.key),
    unassessedZones: input.zones.filter((z) => z.unassessed).map((z) => z.key),
    warnings: allocationMapWarnings(input.zones),
    sourceImageRef: input.sourceImageRef ?? null,
    boundToPlan: Boolean(input.planId),
  };
}

/** Default schematic zone polygons when photo geometry is missing (still tagged as map). */
export const DEFAULT_ZONE_POLYGONS: Record<string, Array<{ x: number; y: number }>> = {
  hairline: [
    { x: 0.22, y: 0.22 },
    { x: 0.5, y: 0.18 },
    { x: 0.78, y: 0.22 },
    { x: 0.72, y: 0.32 },
    { x: 0.28, y: 0.32 },
  ],
  left_temple: [
    { x: 0.1, y: 0.28 },
    { x: 0.22, y: 0.24 },
    { x: 0.26, y: 0.42 },
    { x: 0.12, y: 0.48 },
  ],
  right_temple: [
    { x: 0.78, y: 0.24 },
    { x: 0.9, y: 0.28 },
    { x: 0.88, y: 0.48 },
    { x: 0.74, y: 0.42 },
  ],
  frontal_third: [
    { x: 0.28, y: 0.32 },
    { x: 0.72, y: 0.32 },
    { x: 0.7, y: 0.48 },
    { x: 0.3, y: 0.48 },
  ],
  mid_scalp: [
    { x: 0.3, y: 0.48 },
    { x: 0.7, y: 0.48 },
    { x: 0.68, y: 0.62 },
    { x: 0.32, y: 0.62 },
  ],
  crown: [
    { x: 0.35, y: 0.62 },
    { x: 0.65, y: 0.62 },
    { x: 0.62, y: 0.78 },
    { x: 0.38, y: 0.78 },
  ],
};

const ZONE_COLORS = [
  "rgba(56, 189, 248, 0.35)",
  "rgba(52, 211, 153, 0.35)",
  "rgba(251, 191, 36, 0.35)",
  "rgba(244, 114, 182, 0.35)",
  "rgba(167, 139, 250, 0.35)",
  "rgba(248, 113, 113, 0.35)",
];

export function resolveZonePolygon(zone: PlannedZoneRow): Array<{ x: number; y: number }> {
  if (zone.polygonNorm && zone.polygonNorm.length >= 3) return zone.polygonNorm;
  const key = zone.key.toLowerCase().replace(/\s+/g, "_");
  return DEFAULT_ZONE_POLYGONS[key] ?? DEFAULT_ZONE_POLYGONS.frontal_third;
}

export function zoneFillColor(index: number): string {
  return ZONE_COLORS[index % ZONE_COLORS.length]!;
}

export function polygonToSvgPoints(
  polygon: Array<{ x: number; y: number }>,
  width: number,
  height: number
): string {
  return polygon.map((p) => `${p.x * width},${p.y * height}`).join(" ");
}
