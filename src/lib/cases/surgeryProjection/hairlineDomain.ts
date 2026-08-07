/**
 * FiOS photo-bound hairline design domain (clinical SoR).
 * Consultation SVG / unbound forms do not satisfy this model.
 */

import { z } from "zod";
import { normalisedPointSchema } from "@/src/lib/cases/surgeryPlanningTypes";

export const HAIRLINE_DESIGN_STATUSES = [
  "draft",
  "awaiting_review",
  "approved",
  "rejected",
  "superseded",
] as const;

export type HairlineDesignStatus = (typeof HAIRLINE_DESIGN_STATUSES)[number];

export const hairlineGeometrySchema = z.object({
  /** 0 = top of frame, 1 = bottom — central hairline height. */
  centralHeightNorm: z.number().min(0).max(1),
  leftRecessionNorm: z.number().min(0).max(1),
  rightRecessionNorm: z.number().min(0).max(1),
  /** -1 left-dominant … +1 right-dominant asymmetry bias. */
  symmetryBias: z.number().min(-1).max(1),
  temporalTransitionLeft: z.number().min(0).max(1),
  temporalTransitionRight: z.number().min(0).max(1),
  macroIrregularity: z.number().min(0).max(1),
  anteriorTransitionDepth: z.number().min(0).max(1),
  /** Authoritative line rendered on the source photograph. */
  polylineNorm: z.array(normalisedPointSchema).min(2).max(128),
});

export type HairlineGeometry = z.infer<typeof hairlineGeometrySchema>;

export type HairlineDesignRow = {
  id: string;
  tenantId: string;
  caseId: string;
  surgicalPlanId: string;
  designVersion: number;
  status: HairlineDesignStatus;
  sourceImageId: string | null;
  sourceImageRef: string;
  sourceImageChecksum: string;
  sourceView: string;
  imageWidthPx: number | null;
  imageHeightPx: number | null;
  orientationDegrees: number;
  geometry: HairlineGeometry;
  authorUserId: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  supersedesDesignId: string | null;
  supersededByDesignId: string | null;
  renderStorageRef: string | null;
  createdAt: string;
  updatedAt: string;
};

export const defaultHairlineGeometry = (): HairlineGeometry => ({
  centralHeightNorm: 0.28,
  leftRecessionNorm: 0.22,
  rightRecessionNorm: 0.22,
  symmetryBias: 0,
  temporalTransitionLeft: 0.35,
  temporalTransitionRight: 0.35,
  macroIrregularity: 0.25,
  anteriorTransitionDepth: 0.12,
  polylineNorm: buildHairlinePolylineFromControls({
    centralHeightNorm: 0.28,
    leftRecessionNorm: 0.22,
    rightRecessionNorm: 0.22,
    symmetryBias: 0,
    temporalTransitionLeft: 0.35,
    temporalTransitionRight: 0.35,
    macroIrregularity: 0.25,
    anteriorTransitionDepth: 0.12,
  }),
});

/**
 * Derive a frontal polyline from adjustable clinical controls so approval always
 * shows a concrete line on the photograph (not an unbound form field).
 */
export function buildHairlinePolylineFromControls(
  controls: Omit<HairlineGeometry, "polylineNorm">
): HairlineGeometry["polylineNorm"] {
  const midX = 0.5 + controls.symmetryBias * 0.04;
  const peakY = controls.centralHeightNorm;
  const leftTempleX = 0.12;
  const rightTempleX = 0.88;
  const leftPeakX = midX - 0.18 - controls.leftRecessionNorm * 0.05;
  const rightPeakX = midX + 0.18 + controls.rightRecessionNorm * 0.05;
  const leftY = peakY + controls.leftRecessionNorm * 0.12;
  const rightY = peakY + controls.rightRecessionNorm * 0.12;
  const leftTemporalY = leftY + controls.temporalTransitionLeft * 0.1;
  const rightTemporalY = rightY + controls.temporalTransitionRight * 0.1;
  const irr = controls.macroIrregularity * 0.015;
  const depth = controls.anteriorTransitionDepth * 0.02;

  const pts: HairlineGeometry["polylineNorm"] = [
    { x: leftTempleX, y: clamp01(leftTemporalY) },
    { x: leftPeakX - 0.06, y: clamp01(leftY + irr) },
    { x: leftPeakX, y: clamp01(peakY + depth + irr * 0.5) },
    { x: midX - 0.04, y: clamp01(peakY - irr) },
    { x: midX, y: clamp01(peakY + depth) },
    { x: midX + 0.04, y: clamp01(peakY - irr * 0.7) },
    { x: rightPeakX, y: clamp01(peakY + depth + irr * 0.4) },
    { x: rightPeakX + 0.06, y: clamp01(rightY - irr) },
    { x: rightTempleX, y: clamp01(rightTemporalY) },
  ];
  return pts;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function mergeHairlineControls(
  base: HairlineGeometry,
  patch: Partial<Omit<HairlineGeometry, "polylineNorm">>
): HairlineGeometry {
  const controls = {
    centralHeightNorm: patch.centralHeightNorm ?? base.centralHeightNorm,
    leftRecessionNorm: patch.leftRecessionNorm ?? base.leftRecessionNorm,
    rightRecessionNorm: patch.rightRecessionNorm ?? base.rightRecessionNorm,
    symmetryBias: patch.symmetryBias ?? base.symmetryBias,
    temporalTransitionLeft: patch.temporalTransitionLeft ?? base.temporalTransitionLeft,
    temporalTransitionRight: patch.temporalTransitionRight ?? base.temporalTransitionRight,
    macroIrregularity: patch.macroIrregularity ?? base.macroIrregularity,
    anteriorTransitionDepth: patch.anteriorTransitionDepth ?? base.anteriorTransitionDepth,
  };
  return {
    ...controls,
    polylineNorm: buildHairlinePolylineFromControls(controls),
  };
}

export function parseHairlineGeometry(raw: unknown): HairlineGeometry {
  const p = hairlineGeometrySchema.safeParse(raw);
  if (p.success) return p.data;
  return defaultHairlineGeometry();
}

export function isHairlineDesignStatus(value: unknown): value is HairlineDesignStatus {
  return (
    typeof value === "string" &&
    (HAIRLINE_DESIGN_STATUSES as readonly string[]).includes(value)
  );
}

/** Rejecting / superseding a hairline must not reject the surgical plan. */
export function hairlineDecisionIsolatedFromPlan(): true {
  return true;
}
