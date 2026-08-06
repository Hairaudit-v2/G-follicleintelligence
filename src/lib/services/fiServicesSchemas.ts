import { z } from "zod";

import { BOOKING_TYPES } from "@/src/lib/bookings/bookingPolicy";
import {
  ROOM_REQUIREMENT_MODES,
  SERVICE_FAMILY_IDS,
  STAFF_ALLOCATION_MODES,
  STAFF_ALLOCATION_STRATEGIES,
  SURGICAL_TEAM_SLOTS,
} from "@/src/lib/services/setup/serviceSetupTypes";
import { CANONICAL_SERVICE_ROLES } from "@/src/lib/services/setup/canonicalServiceRoles";

const bookingTypeEnum = z.enum([...BOOKING_TYPES] as [string, ...string[]]);

const hexColor = z
  .string()
  .max(32)
  .regex(/^#[0-9a-f]{3}([0-9a-f]{3})?$/i, "Colour must be a hex value like #abc or #aabbcc.")
  .nullable()
  .optional();

const roleEnum = z.enum([...CANONICAL_SERVICE_ROLES] as [string, ...string[]]);

export const serviceSetupConfigSchema = z
  .object({
    version: z.literal(1).optional().default(1),
    serviceFamily: z.enum([...SERVICE_FAMILY_IDS] as [string, ...string[]]),
    eligibleRoles: z.array(roleEnum),
    legacyRolesForReview: z.array(z.string().trim().min(1).max(64)).max(40),
    staffAllocation: z
      .object({
        mode: z.enum([...STAFF_ALLOCATION_MODES] as [string, ...string[]]),
        strategy: z.enum([...STAFF_ALLOCATION_STRATEGIES] as [string, ...string[]]),
        preferredRoleOrder: z.array(roleEnum),
        preferredStaffIds: z.array(z.string().uuid()).max(50),
      })
      .strict(),
    competency: z
      .object({
        minimumClinicalTier: z.number().int().min(1).max(5).nullable(),
        requiredCertificationKeys: z.array(z.string().trim().min(1).max(80)).max(20),
        supervisionAllowed: z.boolean(),
        surgeryLeadRequired: z.boolean(),
      })
      .strict(),
    surgicalTeam: z
      .array(
        z
          .object({
            slot: z.enum([...SURGICAL_TEAM_SLOTS] as [string, ...string[]]),
            required: z.boolean(),
            minimum: z.number().int().min(0).max(20),
            preferred: z.number().int().min(0).max(20),
            automaticallyAllocate: z.boolean(),
          })
          .strict()
      )
      .nullable(),
    rooms: z
      .object({
        requirement: z.enum([...ROOM_REQUIREMENT_MODES] as [string, ...string[]]),
        automaticAllocation: z.boolean(),
        preferredRoomId: z
          .union([z.string().uuid(), z.literal(""), z.null()])
          .transform((v) => (v ? v : null)),
        fallbackRoomIds: z.array(z.string().uuid()).max(40),
        eligibleRoomIds: z.array(z.string().uuid()).max(80),
        resourceRequirementKeys: z.array(z.string().trim().min(1).max(64)).max(20),
      })
      .strict(),
  })
  .strict();

export const fiServiceCreateBodySchema = z
  .object({
    adminKey: z.string().optional(),
    name: z.string().trim().min(1, "Name is required.").max(200),
    duration_minutes: z.coerce
      .number()
      .int()
      .min(1, "Duration must be at least 1 minute.")
      .max(1440),
    base_price: z.coerce.number().min(0, "Price cannot be negative.").max(1_000_000),
    color: hexColor,
    category: z.string().trim().max(120).nullable().optional(),
    is_active: z.coerce.boolean().optional().default(true),
    booking_type: bookingTypeEnum.nullable().optional(),
    setup_config: serviceSetupConfigSchema.optional(),
    save_as_draft: z.boolean().optional(),
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
    setup_config: serviceSetupConfigSchema.optional(),
    save_as_draft: z.boolean().optional(),
  })
  .strict();

/** Body for catalogue deactivate (soft: `is_active = false`). */
export const fiServiceDeactivateBodySchema = z
  .object({
    adminKey: z.string().optional(),
  })
  .strict();
