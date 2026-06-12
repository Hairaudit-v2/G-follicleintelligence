/**
 * POST or GET /api/cron/fi-reminder-jobs
 * Authorisation: `Authorization: Bearer <FI_REMINDER_CRON_SECRET>` or header `x-fi-reminder-secret` (same value).
 * Intended for Vercel Cron, pg_cron HTTP call, or manual ops. Uses service role + {@link processReminderJobsOnce}.
 */
import { NextResponse } from "next/server";
import { processReminderJobsOnce } from "@/src/lib/reminders/reminderProcessor.server";
import { CRON_OR_WEBHOOK_SECRET_MIN_LENGTH, timingSafeUtf8Equal } from "@/src/lib/security/timingSafeSecret";

export const dynamic = "force-dynamic";

function extractBearer(req: Request): string | null {
  const auth = req.headers.get("authorization");
  const m = auth?.match(/^Bearer\s+(.+)$/i);
  const fromAuth = m?.[1]?.trim();
  if (fromAuth) return fromAuth;
  return req.headers.get("x-fi-reminder-secret")?.trim() || null;
}

function isAuthorized(req: Request, expected: string): boolean {
  const got = extractBearer(req);
  if (!got) return false;
  return timingSafeUtf8Equal(expected, got);
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
    return NextResponse.json({ ok: false, error: "Service unavailable." }, { status: 503 });
  }
  if (expected.length < CRON_OR_WEBHOOK_SECRET_MIN_LENGTH) {
    return NextResponse.json({ ok: false, error: "Service unavailable." }, { status: 503 });
  }
  if (!isAuthorized(req, expected)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  try {
    const result = await processReminderJobsOnce({ limit: 25 });
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false, error: "Processor unavailable." }, { status: 500 });
  }
}
