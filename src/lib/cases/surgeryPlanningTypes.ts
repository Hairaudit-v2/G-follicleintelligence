/**
 * Extended planned-zone model for FiOS Graft Allocation Map (clinical planning only).
 * Backward compatible: key/label alone still parse; graft/density/geometry optional.
 */

import { z } from "zod";

/** High-level planning lifecycle for SurgeryOS readiness (Stage 5B). */
export const SURGERY_PLANNING_STATUS_VALUES = [
  "draft",
  "in_progress",
  "ready_for_review",
  "approved",
  "on_hold",
  "cancelled",
] as const;

export type SurgeryPlanningStatusValue = (typeof SURGERY_PLANNING_STATUS_VALUES)[number];

export function isSurgeryPlanningStatus(
  s: string | null | undefined
): s is SurgeryPlanningStatusValue {
  return !!s && (SURGERY_PLANNING_STATUS_VALUES as readonly string[]).includes(s.trim());
}

export const normalisedPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export type NormalisedPoint = z.infer<typeof normalisedPointSchema>;

export const plannedZoneRowSchema = z.object({
  key: z.string().min(1).max(64),
  label: z.string().max(256).optional().nullable(),
  grafts: z.number().int().min(0).optional().nullable(),
  targetDensityPerCm2: z.number().min(0).max(120).optional().nullable(),
  deferred: z.boolean().optional().nullable(),
  unassessed: z.boolean().optional().nullable(),
  /** Normalised polygon on the bound source photograph (0–1). */
  polygonNorm: z.array(normalisedPointSchema).min(3).max(64).optional().nullable(),
});

export type PlannedZoneRow = z.infer<typeof plannedZoneRowSchema>;

export const SURGERY_PLANNING_NOTES_MAX = 16_000;
export const SURGERY_PLANNING_SUMMARY_MAX = 4_000;

export const surgeryPlanningUpsertBodySchema = z
  .object({
    adminKey: z.string().optional(),
    planning_status: z.enum(SURGERY_PLANNING_STATUS_VALUES).optional(),
    planned_procedure_type: z.string().max(256).nullable().optional(),
    planned_session_type: z.string().max(256).nullable().optional(),
    planned_zones: z.array(plannedZoneRowSchema).optional(),
    estimated_grafts_min: z.number().int().min(0).nullable().optional(),
    estimated_grafts_max: z.number().int().min(0).nullable().optional(),
    donor_strategy_notes: z.string().max(SURGERY_PLANNING_NOTES_MAX).nullable().optional(),
    recipient_strategy_notes: z.string().max(SURGERY_PLANNING_NOTES_MAX).nullable().optional(),
    medication_prep_notes: z.string().max(SURGERY_PLANNING_NOTES_MAX).nullable().optional(),
    planning_notes: z.string().max(SURGERY_PLANNING_NOTES_MAX).nullable().optional(),
    surgical_plan_summary: z.string().max(SURGERY_PLANNING_SUMMARY_MAX).nullable().optional(),
  })
  .refine(
    (b) => {
      const min = b.estimated_grafts_min;
      const max = b.estimated_grafts_max;
      if (min == null || max == null) return true;
      return max >= min;
    },
    { message: "estimated_grafts_max must be >= estimated_grafts_min when both are set." }
  );

export type SurgeryPlanningUpsertBody = z.infer<typeof surgeryPlanningUpsertBodySchema>;

export type SurgeryPlanningUpsertPatch = Omit<SurgeryPlanningUpsertBody, "adminKey">;

export function totalGraftsFromZones(zones: PlannedZoneRow[]): number {
  return zones.reduce((sum, z) => sum + (typeof z.grafts === "number" ? z.grafts : 0), 0);
}

export function allocationMapWarnings(zones: PlannedZoneRow[]): string[] {
  const warnings: string[] = [];
  if (zones.length === 0) warnings.push("No planned zones defined.");
  for (const z of zones) {
    if (z.deferred) continue;
    if (z.unassessed) {
      warnings.push(`Zone "${z.key}" is marked unassessed.`);
      continue;
    }
    if (z.grafts == null) warnings.push(`Zone "${z.key}" missing graft count.`);
    if (z.targetDensityPerCm2 == null) {
      warnings.push(`Zone "${z.key}" missing target density.`);
    }
    if (!z.polygonNorm || z.polygonNorm.length < 3) {
      warnings.push(`Zone "${z.key}" missing photo-bound geometry.`);
    }
  }
  return warnings;
}
