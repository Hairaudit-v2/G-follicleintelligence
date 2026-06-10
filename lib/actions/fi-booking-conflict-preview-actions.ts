"use server";

import { z, ZodError } from "zod";

import {
  previewBookingConflicts,
  type BookingConflictPreviewResult,
} from "@/src/lib/calendar/bookingConflictPreview.server";

const UUID = z.string().uuid();

const extraResourceAssignmentSchema = z
  .object({
    resource_type: z.enum(["staff", "room"]),
    resource_id: UUID,
  })
  .strict();

const bodySchema = z
  .object({
    clinicId: z.union([UUID, z.null()]).optional(),
    serviceId: z.union([UUID, z.null()]).optional(),
    bookingType: z.string().max(64).optional().nullable(),
    roomId: z.union([UUID, z.null()]).optional(),
    roomRequired: z.boolean().optional(),
    staffId: z.union([UUID, z.null()]).optional(),
    bookingId: z.union([UUID, z.null()]).optional(),
    startAt: z.string().min(1),
    endAt: z.string().min(1),
    previewIntent: z.enum(["quick_create", "edit"]).optional(),
    extraResourceAssignments: z.array(extraResourceAssignmentSchema).max(32).optional().nullable(),
  })
  .strict();

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Could not check availability.";
}

/** Read-only live conflict preview for booking drawers; save-time validation remains authoritative. */
export async function previewBookingConflictsAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; preview: BookingConflictPreviewResult } | { ok: false; error: string }> {
  try {
    const parsed = bodySchema.parse(body);
    const preview = await previewBookingConflicts({
      tenantId,
      clinicId: parsed.clinicId ?? null,
      serviceId: parsed.serviceId ?? null,
      bookingType: parsed.bookingType ?? null,
      roomId: parsed.roomId ?? null,
      roomRequired: parsed.roomRequired,
      staffId: parsed.staffId ?? null,
      bookingId: parsed.bookingId ?? null,
      startAt: parsed.startAt,
      endAt: parsed.endAt,
      previewIntent: parsed.previewIntent,
      extraResourceAssignments: parsed.extraResourceAssignments ?? null,
    });
    return { ok: true, preview };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
