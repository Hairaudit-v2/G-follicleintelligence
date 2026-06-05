/**
 * POST or GET /api/cron/fi-reminder-jobs
 * Authorisation: `Authorization: Bearer <FI_REMINDER_CRON_SECRET>` (or `x-fi-reminder-secret` header).
 * Intended for Vercel Cron, pg_cron HTTP call, or manual ops. Uses service role + {@link processReminderJobsOnce}.
 */
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processReminderJobsOnce } from "@/src/lib/reminders/reminderProcessor.server";

export const dynamic = "force-dynamic";

const MIN_CRON_SECRET_LENGTH = 16;

function extractBearer(req: Request): string | null {
  const auth = req.headers.get("authorization");
  const m = auth?.match(/^Bearer\s+(.+)$/i);
  const fromAuth = m?.[1]?.trim();
  if (fromAuth) return fromAuth;
  return req.headers.get("x-fi-reminder-secret")?.trim() || null;
}

function secretsEqual(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isAuthorized(req: Request, expected: string): boolean {
  const got = extractBearer(req);
  if (!got) return false;
  return secretsEqual(expected, got);
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
  if (expected.length < MIN_CRON_SECRET_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `FI_REMINDER_CRON_SECRET must be at least ${MIN_CRON_SECRET_LENGTH} characters.` },
      { status: 503 }
    );
  }
  if (!isAuthorized(req, expected)) {
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
