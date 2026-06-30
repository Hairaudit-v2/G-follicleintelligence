"use server";

import { z, ZodError } from "zod";

import {
  findNextAvailableBookingSlots,
  type FindNextAvailableBookingSlotsResult,
} from "@/src/lib/calendar/findNextAvailableBookingSlots.server";

const UUID = z.string().uuid();

const bodySchema = z
  .object({
    clinicId: UUID,
    serviceId: z.union([UUID, z.null()]).optional(),
    bookingType: z.string().max(64).optional().nullable(),
    staffId: z.union([UUID, z.null()]).optional(),
    roomId: z.union([UUID, z.null()]).optional(),
    bookingId: z.union([UUID, z.null()]).optional(),
    preferredStartAt: z.string().min(1),
    durationMinutes: z
      .number()
      .int()
      .positive()
      .max(24 * 60),
    limit: z.number().int().positive().max(20).optional(),
  })
  .strict();

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Could not search availability.";
}

/** Read-only: next bookable room/time combinations for conflicted drawers. */
export async function findNextAvailableBookingSlotsAction(
  tenantId: string,
  body: unknown
): Promise<({ ok: true } & FindNextAvailableBookingSlotsResult) | { ok: false; error: string }> {
  try {
    const parsed = bodySchema.parse(body);
    const slots = await findNextAvailableBookingSlots({
      tenantId: tenantId.trim(),
      clinicId: parsed.clinicId,
      serviceId: parsed.serviceId ?? null,
      bookingType: parsed.bookingType ?? null,
      staffId: parsed.staffId ?? null,
      roomId: parsed.roomId ?? null,
      bookingId: parsed.bookingId ?? null,
      preferredStartAt: parsed.preferredStartAt,
      durationMinutes: parsed.durationMinutes,
      limit: parsed.limit,
    });
    return { ok: true, ...slots };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
