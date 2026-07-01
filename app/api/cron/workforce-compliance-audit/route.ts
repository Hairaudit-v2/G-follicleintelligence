/**
 * GET or POST /api/cron/workforce-compliance-audit
 * Daily WorkforceOS compliance audit — credentials, certifications, alerts.
 * Auth: Authorization Bearer CRON_SECRET (min 16 chars).
 */
import { NextRequest, NextResponse } from "next/server";

import { assertCronAuthorized } from "@/src/lib/server/cronAuth";
import { runWorkforceComplianceAuditCron } from "@/src/lib/workforce/workforceComplianceAuditCron.server";

export const dynamic = "force-dynamic";

async function handleCron(req: NextRequest): Promise<NextResponse> {
  const authFailure = assertCronAuthorized(req, [
    process.env.CRON_SECRET ?? "",
    process.env.WORKFORCE_COMPLIANCE_CRON_SECRET ?? "",
  ]);
  if (authFailure) return authFailure;

  try {
    const result = await runWorkforceComplianceAuditCron();
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