import { z } from "zod";

import { BOOKING_TYPES } from "@/src/lib/bookings/bookingPolicy";

const bookingTypeEnum = z.enum([...BOOKING_TYPES] as [string, ...string[]]);

const hexColor = z
  .string()
  .max(32)
  .regex(/^#[0-9a-f]{3}([0-9a-f]{3})?$/i, "Colour must be a hex value like #abc or #aabbcc.")
  .nullable()
  .optional();

export const fiServiceCreateBodySchema = z
  .object({
    adminKey: z.string().optional(),
    name: z.string().trim().min(1, "Name is required.").max(200),
    duration_minutes: z.coerce.number().int().min(1, "Duration must be at least 1 minute.").max(1440),
    base_price: z.coerce.number().min(0, "Price cannot be negative.").max(1_000_000),
    color: hexColor,
    category: z.string().trim().max(120).nullable().optional(),
    is_active: z.coerce.boolean().optional().default(true),
    booking_type: bookingTypeEnum.nullable().optional(),
  })
  .strict();

export const fiServicePatchBodySchema = z
  .object({
    adminKey: z.string().optional(),
    name: z.string().trim().min(1).max(200).optional(),
    duration_minutes: z.coerce.number().int().min(1).max(1440).optional(),
    base_price: z.coerce.number().min(0).max(1_000_000).optional(),
    color: hexColor,
    category: z.string().trim().max(120).nullable().optional(),
    is_active: z.coerce.boolean().optional(),
    booking_type: bookingTypeEnum.nullable().optional(),
  })
  .strict();

/** Body for catalogue deactivate (soft: `is_active = false`). */
export const fiServiceDeactivateBodySchema = z
  .object({
    adminKey: z.string().optional(),
  })
  .strict();
