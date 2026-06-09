import { z } from "zod";
import { BOOKING_TYPES } from "./bookingPolicy";

const UUID = z.string().uuid();

const optionalUuid = z.union([UUID, z.null()]).optional();

const bookingTypeSchema = z.enum([...BOOKING_TYPES] as [string, ...string[]]);

const BOOKING_STATUS_NON_TERMINAL = ["scheduled", "confirmed", "arrived", "no_show"] as const;
const bookingStatusWritableSchema = z.enum(BOOKING_STATUS_NON_TERMINAL);

const metadataSchema = z.record(z.string(), z.unknown()).refine((v) => v != null && typeof v === "object" && !Array.isArray(v), {
  message: "metadata must be a JSON object.",
});

export const bookingListQuerySchema = z
  .object({
    start: z.string().min(1, "start is required (ISO-8601)."),
    end: z.string().min(1, "end is required (ISO-8601)."),
  })
  .strict();

export const bookingCreateBodySchema = z
  .object({
    adminKey: z.string().optional(),
    leadId: optionalUuid,
    personId: optionalUuid,
    patientId: optionalUuid,
    caseId: optionalUuid,
    clinicId: optionalUuid,
    roomId: optionalUuid,
    roomRequired: z.boolean().optional(),
    assignedStaffId: optionalUuid,
    assignedUserId: optionalUuid,
    bookingType: bookingTypeSchema,
    title: z.string().max(2000).optional().nullable(),
    description: z.string().max(8000).optional().nullable(),
    startAt: z.string().min(1),
    endAt: z.string().min(1),
    timezone: z.string().max(128).optional().nullable(),
    location: z.string().max(2000).optional().nullable(),
    metadata: metadataSchema.optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    const has =
      (val.leadId && val.leadId.trim()) ||
      (val.personId && val.personId.trim()) ||
      (val.patientId && val.patientId.trim()) ||
      (val.caseId && val.caseId.trim());
    if (!has) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one of leadId, personId, patientId, or caseId.",
      });
    }
  });

/** PATCH body — never terminal statuses (use /complete and /cancel). */
export const bookingUpdateBodySchema = z
  .object({
    adminKey: z.string().optional(),
    leadId: optionalUuid,
    personId: optionalUuid,
    patientId: optionalUuid,
    caseId: optionalUuid,
    clinicId: optionalUuid,
    roomId: optionalUuid,
    roomRequired: z.boolean().optional(),
    assignedStaffId: optionalUuid,
    assignedUserId: optionalUuid,
    bookingType: bookingTypeSchema.optional(),
    bookingStatus: bookingStatusWritableSchema.optional(),
    title: z.string().max(2000).optional().nullable(),
    description: z.string().max(8000).optional().nullable(),
    startAt: z.string().min(1).optional(),
    endAt: z.string().min(1).optional(),
    timezone: z.string().max(128).optional().nullable(),
    location: z.string().max(2000).optional().nullable(),
    metadata: metadataSchema.optional(),
  })
  .strict();

export const bookingCancelBodySchema = z
  .object({
    adminKey: z.string().optional(),
    cancellationReason: z.string().max(4000).optional().nullable(),
  })
  .strict();

export const bookingCompleteBodySchema = z
  .object({
    adminKey: z.string().optional(),
  })
  .strict();
