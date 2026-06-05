import { z } from "zod";

import { parseUtcCalendarDateString } from "./calendarQuery";
import { BOOKING_TYPES } from "./bookingPolicy";

const UUID = z.string().uuid();
const optionalUuid = z.union([UUID, z.null()]).optional();

const procedureSchema = z.enum([...BOOKING_TYPES] as [string, ...string[]]);

const metadataSchema = z
  .record(z.string(), z.unknown())
  .refine((v) => v != null && typeof v === "object" && !Array.isArray(v), {
    message: "metadata must be a JSON object.",
  });

const procedureDetailsSchema = z
  .object({
    graftCountEstimate: z.string().max(64).optional().nullable(),
    donorArea: z.string().max(256).optional().nullable(),
    technique: z.string().max(128).optional().nullable(),
    specialInstructions: z.string().max(4000).optional().nullable(),
    surgeonUserId: optionalUuid,
    consultantUserId: optionalUuid,
    techUserId: optionalUuid,
  })
  .strict()
  .optional();

const BOOKING_STATUS_NON_TERMINAL = ["scheduled", "confirmed", "arrived", "no_show"] as const;

function parseBoolParam(v: string | null): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

/** GET /appointments?date=&provider=&procedure= */
export const appointmentListQuerySchema = z
  .object({
    date: z
      .string()
      .min(1, "date is required (YYYY-MM-DD).")
      .refine((v) => parseUtcCalendarDateString(v) != null, "date must be YYYY-MM-DD."),
    provider: optionalUuid,
    procedure: procedureSchema.optional().nullable(),
    clinicId: optionalUuid,
    includeCancelled: z.boolean().optional(),
  })
  .strict();

export function parseAppointmentListQuery(searchParams: URLSearchParams): z.infer<typeof appointmentListQuerySchema> {
  const providerRaw = searchParams.get("provider") ?? searchParams.get("providerId") ?? searchParams.get("assignedUserId");
  const procedureRaw =
    searchParams.get("procedure") ?? searchParams.get("type") ?? searchParams.get("bookingType");

  return appointmentListQuerySchema.parse({
    date: searchParams.get("date") ?? "",
    provider: providerRaw?.trim() || null,
    procedure: procedureRaw?.trim() || null,
    clinicId: searchParams.get("clinicId")?.trim() || null,
    includeCancelled: parseBoolParam(searchParams.get("includeCancelled")),
  });
}

/** POST /appointments — calendar create for hair clinic procedures. */
export const appointmentCreateBodySchema = z
  .object({
    adminKey: z.string().optional(),
    procedure: procedureSchema,
    startAt: z.string().min(1),
    endAt: z.string().min(1).optional(),
    provider: optionalUuid,
    providerId: optionalUuid,
    assignedUserId: optionalUuid,
    clinicId: optionalUuid,
    leadId: optionalUuid,
    personId: optionalUuid,
    patientId: optionalUuid,
    caseId: optionalUuid,
    title: z.string().max(2000).optional().nullable(),
    description: z.string().max(8000).optional().nullable(),
    timezone: z.string().max(128).optional().nullable(),
    location: z.string().max(2000).optional().nullable(),
    status: z.enum(BOOKING_STATUS_NON_TERMINAL).optional(),
    procedureDetails: procedureDetailsSchema,
    metadata: metadataSchema.optional(),
    skipAvailabilityCheck: z.boolean().optional(),
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

/** PATCH /appointments/:id — reschedule / reassign. */
export const appointmentRescheduleBodySchema = z
  .object({
    adminKey: z.string().optional(),
    startAt: z.string().min(1).optional(),
    endAt: z.string().min(1).optional(),
    provider: optionalUuid,
    providerId: optionalUuid,
    assignedUserId: optionalUuid,
    clinicId: optionalUuid,
    procedure: procedureSchema.optional(),
    status: z.enum(BOOKING_STATUS_NON_TERMINAL).optional(),
    title: z.string().max(2000).optional().nullable(),
    location: z.string().max(2000).optional().nullable(),
    procedureDetails: procedureDetailsSchema,
    metadata: metadataSchema.optional(),
    skipAvailabilityCheck: z.boolean().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    const hasChange =
      val.startAt != null ||
      val.endAt != null ||
      val.provider !== undefined ||
      val.providerId !== undefined ||
      val.assignedUserId !== undefined ||
      val.clinicId !== undefined ||
      val.procedure != null ||
      val.status != null ||
      val.title !== undefined ||
      val.location !== undefined ||
      val.procedureDetails != null ||
      val.metadata != null;
    if (!hasChange) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one field to update (startAt, endAt, provider, procedure, etc.).",
      });
    }
  });

export type AppointmentProcedureDetailsInput = z.infer<typeof procedureDetailsSchema>;

export function resolveProviderId(input: {
  provider?: string | null;
  providerId?: string | null;
  assignedUserId?: string | null;
}): string | null | undefined {
  if (input.provider !== undefined) return input.provider;
  if (input.providerId !== undefined) return input.providerId;
  if (input.assignedUserId !== undefined) return input.assignedUserId;
  return undefined;
}

export function procedureDetailsToMetadata(
  details: AppointmentProcedureDetailsInput | undefined
): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const out: Record<string, unknown> = {};
  if (details.graftCountEstimate !== undefined) out.graft_count_estimate = details.graftCountEstimate;
  if (details.donorArea !== undefined) out.donor_area = details.donorArea;
  if (details.technique !== undefined) out.technique = details.technique;
  if (details.specialInstructions !== undefined) out.special_instructions = details.specialInstructions;
  if (details.surgeonUserId !== undefined) out.surgeon_user_id = details.surgeonUserId;
  if (details.consultantUserId !== undefined) out.consultant_user_id = details.consultantUserId;
  if (details.techUserId !== undefined) out.tech_user_id = details.techUserId;
  return Object.keys(out).length ? out : undefined;
}
