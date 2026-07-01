"use server";

import { z, ZodError } from "zod";

import {
  findNextAvailableSurgerySlots,
  type FindNextAvailableSurgerySlotsResult,
} from "@/src/lib/calendar/findNextAvailableSurgerySlots.server";

const UUID = z.string().uuid();

const bodySchema = z
  .object({
    clinicId: UUID,
    serviceId: z.union([UUID, z.null()]).optional(),
    staffId: z.union([UUID, z.null()]).optional(),
    roomId: z.union([UUID, z.null()]).optional(),
    bookingId: z.union([UUID, z.null()]).optional(),
    preferredStartAt: z.string().min(1),
    durationMinutes: z.number().int().positive().max(24 * 60).optional(),
    limit: z.number().int().positive().max(20).optional(),
  })
  .strict();

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Could not search surgery availability.";
}

/** Surgery booking wizard — ranked open surgery slots. */
export async function findNextAvailableSurgerySlotsAction(
  tenantId: string,
  body: unknown
): Promise<({ ok: true } & FindNextAvailableSurgerySlotsResult) | { ok: false; error: string }> {
  try {
    const parsed = bodySchema.parse(body);
    const slots = await findNextAvailableSurgerySlots({
      tenantId: tenantId.trim(),
      clinicId: parsed.clinicId,
      serviceId: parsed.serviceId ?? null,
      staffId: parsed.staffId ?? null,
      roomId: parsed.roomId ?? null,
      bookingId: parsed.bookingId ?? null,
      preferredStartAt: parsed.preferredStartAt,
      durationMinutes: parsed.durationMinutes ?? 480,
      limit: parsed.limit,
    });
    return { ok: true, ...slots };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}