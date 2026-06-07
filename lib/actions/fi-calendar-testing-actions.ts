"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { runCalendarConsultationSmokeTest } from "@/src/lib/calendar/calendarTestingSmoke.server";
import { runCalendarUatSeed } from "@/src/lib/calendar/calendarUatSeed.server";

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

export async function runCalendarUatSeedAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; lines: string[] } | { ok: false; error: string }> {
  const parsed = bodySchema.parse(body ?? {});
  const r = await runCalendarUatSeed(tenantId.trim(), parsed.adminKey);
  if (!r.ok) return { ok: false, error: r.error };
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/staff`);
  revalidatePath(`/fi-admin/${tid}/services`);
  revalidatePath(`/fi-admin/${tid}/calendar`);
  revalidatePath(`/fi-admin/${tid}/appointments`);
  revalidatePath(`/fi-admin/${tid}/bookings`);
  revalidatePath(`/fi-admin/${tid}/calendar/testing`);
  return { ok: true, lines: r.lines };
}
