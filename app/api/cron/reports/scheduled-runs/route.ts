/**
 * POST or GET /api/cron/reports/scheduled-runs
 * Auth: Bearer CRON_SECRET | FINANCIAL_OS_CRON_SECRET | FI_PAYMENTS_CRON_SECRET
 * Optional: dryRun=1, tenantId=uuid, limit (default 50, max 200)
 *
 * Processes active fi_report_schedules rows and inserts fi_report_runs snapshots.
 */
import { NextRequest, NextResponse } from "next/server";

import { validateCronAuth } from "@/src/lib/security/validateCronAuth";
import { logStructured } from "@/src/lib/server/structuredLog";
import { processActiveReportSchedules } from "@/src/lib/reports/reportRuns.server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  if (!validateCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1" || url.searchParams.get("dry_run") === "1";
  const tenantId = url.searchParams.get("tenantId")?.trim() || null;
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 50;

  try {
    const result = await processActiveReportSchedules({ tenantId, dryRun, limit });
    logStructured("info", "reports_scheduled_runs_cron", {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      dryRun: result.dryRun,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    logStructured("error", "reports_scheduled_runs_cron_failed", { message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
