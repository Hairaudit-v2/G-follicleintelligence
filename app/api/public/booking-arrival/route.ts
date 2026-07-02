import { NextResponse } from "next/server";
import { z } from "zod";

import { recordBookingArrivalIntentFromToken } from "@/src/lib/fiOs/todaySignal/bookingArrivalIntent.server";

const bodySchema = z.object({ token: z.string().min(10).max(4096) }).strict();

/**
 * POST /api/public/booking-arrival
 * Patient self-arrival intent — does not perform clinical check-in.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const result = await recordBookingArrivalIntentFromToken(parsed.data.token);
  if (!result.ok) {
    const status =
      result.code === "invalid_token" ? 400 : result.code === "not_found" ? 404 : 409;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
