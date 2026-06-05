/**
 * POST or GET /api/cron/fi-reminder-jobs
 * Authorisation: `Authorization: Bearer <FI_REMINDER_CRON_SECRET>` (or `x-fi-reminder-secret` header).
 * Intended for Vercel Cron, pg_cron HTTP call, or manual ops. Uses service role + {@link processReminderJobsOnce}.
 */
import { NextResponse } from "next/server";
import { processReminderJobsOnce } from "@/src/lib/reminders/reminderProcessor.server";

export const dynamic = "force-dynamic";

function extractBearer(req: Request): string | null {
  const auth = req.headers.get("authorization");
  const m = auth?.match(/^Bearer\s+(.+)$/i);
  const fromAuth = m?.[1]?.trim();
  if (fromAuth) return fromAuth;
  return req.headers.get("x-fi-reminder-secret")?.trim() || null;
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const expected = process.env.FI_REMINDER_CRON_SECRET?.trim();
  if (!expected) {
    return NextResponse.json({ ok: false, error: "FI_REMINDER_CRON_SECRET is not configured." }, { status: 503 });
  }
  const got = extractBearer(req);
  if (!got || got !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  try {
    const result = await processReminderJobsOnce({ limit: 25 });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Processor failed.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
