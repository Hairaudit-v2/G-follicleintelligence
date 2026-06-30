import { z } from "zod";

import { STAFF_WEEKDAY_KEYS } from "@/src/lib/staff/staffWeeklyHours";

const uuid = z.string().uuid();
const optionalUuid = z.union([uuid, z.literal(""), z.null()]).optional();

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const staffDayHoursSchema = z
  .object({
    enabled: z.boolean().optional(),
    start: hhmm.optional(),
    end: hhmm.optional(),
  })
  .strict();

/** Stored on `fi_staff.working_hours` — weekly local wall times in staff `default_timezone` (fallback Perth). */
export const staffWorkingHoursDocumentSchema = z
  .object({
    weekly: z.record(staffDayHoursSchema).optional(),
  })
  .passthrough()
  .superRefine((doc, ctx) => {
    const w = doc.weekly;
    if (!w || typeof w !== "object") return;
    for (const key of Object.keys(w)) {
      if (!STAFF_WEEKDAY_KEYS.includes(key as (typeof STAFF_WEEKDAY_KEYS)[number])) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid weekday key: ${key}` });
      }
    }
  });

const workingHoursSchema = staffWorkingHoursDocumentSchema.optional();

export const staffCreateBodySchema = z.object({
  adminKey: z.string().optional(),
  full_name: z.string().min(1, "Name is required.").max(200),
  staff_role: z.string().min(1).max(80).optional(),
  email: z
    .union([z.string().email(), z.literal("")])
    .optional()
    .nullable(),
  mobile: z.string().max(40).optional().nullable(),
  default_timezone: z.string().max(80).optional().nullable(),
  working_hours: workingHoursSchema,
  is_active: z.boolean().optional(),
  calendar_color: z.string().max(32).optional().nullable(),
  fi_user_id: optionalUuid,
});

export const staffPatchBodySchema = z.object({
  adminKey: z.string().optional(),
  full_name: z.string().min(1).max(200).optional(),
  staff_role: z.string().min(1).max(80).optional(),
  email: z
    .union([z.string().email(), z.literal("")])
    .optional()
    .nullable(),
  mobile: z.string().max(40).optional().nullable(),
  default_timezone: z.string().max(80).optional().nullable(),
  working_hours: workingHoursSchema,
  is_active: z.boolean().optional(),
  calendar_color: z.string().max(32).optional().nullable(),
  fi_user_id: optionalUuid,
});

export type StaffCreateBody = z.infer<typeof staffCreateBodySchema>;
export type StaffPatchBody = z.infer<typeof staffPatchBodySchema>;
