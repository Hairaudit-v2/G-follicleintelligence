"use server";

import { z } from "zod";

import { runCalendarConsultationSmokeTest } from "@/src/lib/calendar/calendarTestingSmoke.server";

const bodySchema = z.object({
  adminKey: z.string().optional().nullable(),
});

export async function runCalendarConsultationSmokeTestAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; message: string; bookingId: string } | { ok: false; error: string }> {
  const parsed = bodySchema.parse(body ?? {});
  const r = await runCalendarConsultationSmokeTest(tenantId, parsed.adminKey);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, message: r.message, bookingId: r.bookingId };
}
