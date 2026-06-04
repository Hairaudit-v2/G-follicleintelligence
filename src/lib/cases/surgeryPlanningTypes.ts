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

export function isSurgeryPlanningStatus(s: string | null | undefined): s is SurgeryPlanningStatusValue {
  return !!s && (SURGERY_PLANNING_STATUS_VALUES as readonly string[]).includes(s.trim());
}

export const plannedZoneRowSchema = z.object({
  key: z.string().min(1).max(64),
  label: z.string().max(256).optional().nullable(),
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
