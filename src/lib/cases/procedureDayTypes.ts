import { z } from "zod";

/** Procedure-day lifecycle (Stage 5C). */
export const PROCEDURE_STATUS_VALUES = [
  "scheduled",
  "checked_in",
  "in_progress",
  "paused",
  "completed",
  "cancelled",
  "aborted",
] as const;

export type ProcedureStatusValue = (typeof PROCEDURE_STATUS_VALUES)[number];

export function isProcedureStatus(s: string | null | undefined): s is ProcedureStatusValue {
  return !!s && (PROCEDURE_STATUS_VALUES as readonly string[]).includes(s.trim());
}

export const PROCEDURE_DAY_NOTES_MAX = 24_000;
export const PROCEDURE_DAY_SUMMARY_MAX = 8_000;

const uuidStr = z.string().uuid();

export const procedureDayUpsertBodySchema = z
  .object({
    adminKey: z.string().optional(),
    procedure_date: z.string().max(32).nullable().optional(),
    procedure_status: z.enum(PROCEDURE_STATUS_VALUES).optional(),
    surgeon_user_id: z.string().uuid().nullish(),
    team_member_user_ids: z.array(uuidStr).optional(),
    procedure_location: z.string().max(512).nullable().optional(),
    procedure_room: z.string().max(256).nullable().optional(),
    start_time: z.string().max(80).nullable().optional(),
    finish_time: z.string().max(80).nullable().optional(),
    punch_size: z.string().max(128).nullable().optional(),
    extraction_method: z.string().max(256).nullable().optional(),
    implantation_method: z.string().max(256).nullable().optional(),
    medication_notes: z.string().max(PROCEDURE_DAY_NOTES_MAX).nullable().optional(),
    intraoperative_notes: z.string().max(PROCEDURE_DAY_NOTES_MAX).nullable().optional(),
    grafts_extracted: z.number().int().min(0).nullable().optional(),
    grafts_implanted: z.number().int().min(0).nullable().optional(),
    hairs_implanted: z.number().int().min(0).nullable().optional(),
    graft_handling_notes: z.string().max(PROCEDURE_DAY_NOTES_MAX).nullable().optional(),
    complications_notes: z.string().max(PROCEDURE_DAY_NOTES_MAX).nullable().optional(),
    completion_summary: z.string().max(PROCEDURE_DAY_SUMMARY_MAX).nullable().optional(),
  })
  .refine(
    (b) => {
      const ex = b.grafts_extracted;
      const im = b.grafts_implanted;
      if (ex == null || im == null) return true;
      return im <= ex;
    },
    { message: "grafts_implanted must be <= grafts_extracted when both are set." }
  )
  .refine(
    (b) => {
      const s = b.start_time?.trim();
      const f = b.finish_time?.trim();
      if (!s || !f) return true;
      const a = Date.parse(s);
      const z = Date.parse(f);
      if (Number.isNaN(a) || Number.isNaN(z)) return true;
      return z >= a;
    },
    { message: "finish_time must be on or after start_time when both are set." }
  );

export type ProcedureDayUpsertBody = z.infer<typeof procedureDayUpsertBodySchema>;
export type ProcedureDayUpsertPatch = Omit<ProcedureDayUpsertBody, "adminKey">;
