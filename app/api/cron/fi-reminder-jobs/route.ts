/**
 * POST or GET /api/cron/fi-reminder-jobs
 * Authorisation: `Authorization: Bearer` with one of `FI_REMINDER_CRON_SECRET` or `CRON_SECRET` (Vercel Cron),
 * or header `x-fi-reminder-secret` (same values, timing-safe).
 * Intended for Vercel Cron, pg_cron HTTP call, or manual ops. Uses service role + {@link processReminderJobsOnce}.
 */
import { NextRequest, NextResponse } from "next/server";
import { processReminderJobsOnce } from "@/src/lib/reminders/reminderProcessor.server";
import { assertCronAuthorized } from "@/src/lib/server/cronAuth";
import { logStructured } from "@/src/lib/server/structuredLog";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const auth = assertCronAuthorized(
    req,
    [process.env.FI_REMINDER_CRON_SECRET ?? "", process.env.CRON_SECRET ?? ""],
    { alternateTimingSafeHeaderName: "x-fi-reminder-secret" }
  );
  if (auth) return auth;
  try {
    const result = await processReminderJobsOnce({ limit: 25 });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    logStructured("error", "fi_reminder_jobs_cron_failed", { message });
    return NextResponse.json({ ok: false, error: "Processor unavailable." }, { status: 500 });
  }
}
