"use server";

import { z, ZodError } from "zod";

import {
  evaluateSmartScheduling,
  type EvaluateSmartSchedulingInput,
} from "@/src/lib/calendar/smart-scheduling/smartScheduling.server";
import type { SmartSchedulingSnapshot } from "@/src/lib/calendar/smart-scheduling/smartSchedulingTypes";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";

const UUID = z.string().uuid();

const bodySchema = z
  .object({
    clinicId: z.union([UUID, z.null()]).optional(),
    bookingType: z.string().max(64).optional().nullable(),
    roomId: z.union([UUID, z.null()]).optional(),
    roomRequired: z.boolean().optional(),
    staffId: z.union([UUID, z.null()]).optional(),
    staffLabel: z.string().max(200).optional().nullable(),
    roomLabel: z.string().max(200).optional().nullable(),
    patientId: z.union([UUID, z.null()]).optional(),
    bookingId: z.union([UUID, z.null()]).optional(),
    startAt: z.string().min(1),
    endAt: z.string().min(1),
    includeSuggestions: z.boolean().optional(),
  })
  .strict();

/**
 * Live Smart Scheduling Assistant evaluation while booking/editing.
 * Read-only; save-time validation remains authoritative.
 */
export async function evaluateSmartSchedulingAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; snapshot: SmartSchedulingSnapshot } | { ok: false; error: string }> {
  try {
    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const tid = UUID.parse(tenantId);
    const parsed = bodySchema.parse(body);
    const input: EvaluateSmartSchedulingInput = {
      tenantId: tid,
      clinicId: parsed.clinicId ?? null,
      bookingType: parsed.bookingType ?? null,
      roomId: parsed.roomId ?? null,
      roomRequired: parsed.roomRequired,
      staffId: parsed.staffId ?? null,
      staffLabel: parsed.staffLabel ?? null,
      roomLabel: parsed.roomLabel ?? null,
      patientId: parsed.patientId ?? null,
      bookingId: parsed.bookingId ?? null,
      startAt: parsed.startAt,
      endAt: parsed.endAt,
      includeSuggestions: parsed.includeSuggestions,
    };
    const snapshot = await evaluateSmartScheduling(input);
    return { ok: true, snapshot };
  } catch (e) {
    if (e instanceof ZodError) return { ok: false, error: e.errors[0]?.message ?? "Invalid input." };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not evaluate scheduling.",
    };
  }
}
