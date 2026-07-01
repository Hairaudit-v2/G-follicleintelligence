/**
 * GET or POST /api/cron/workforce-time-clock-auto-close
 * Closes forgotten open PIN punches (work_date before today in clinic timezone).
 */
import { NextRequest, NextResponse } from "next/server";

import { assertCronAuthorized } from "@/src/lib/server/cronAuth";
import { runWorkforceTimeClockAutoCloseCron } from "@/src/lib/workforce/workforceTimeClockAutoCloseCron.server";

export const dynamic = "force-dynamic";

async function handleCron(req: NextRequest): Promise<NextResponse> {
  const authFailure = assertCronAuthorized(req, [process.env.CRON_SECRET ?? ""]);
  if (authFailure) return authFailure;

  try {
    const result = await runWorkforceTimeClockAutoCloseCron();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Cron failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}