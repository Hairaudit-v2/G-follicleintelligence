/**
 * POST or GET /api/cron/financial-os/clearance-snapshots
 * Computes and stores financial clearance snapshots for upcoming surgery bookings.
 * Auth: Bearer CRON_SECRET | FINANCIAL_OS_CRON_SECRET | FI_PAYMENTS_CRON_SECRET (timing-safe).
 * Optional: dryRun=1 | dry_run=1, tenantId=uuid, date=YYYY-MM-DD, horizonDays (default 14), limit (default 200, max 500).
 */
import { NextRequest, NextResponse } from "next/server";

import { validateCronAuth } from "@/src/lib/security/validateCronAuth";
import { logStructured } from "@/src/lib/server/structuredLog";
import { runFinancialClearanceSnapshotCron } from "@/src/lib/financialOs/financialClearance.server";

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
  const runDateYmd = url.searchParams.get("date")?.trim() || new Date().toISOString().slice(0, 10);
  const tenantId = url.searchParams.get("tenantId")?.trim() || null;
  const horizonRaw = Number(url.searchParams.get("horizonDays") ?? "14");
  const horizonDays = Number.isFinite(horizonRaw) ? Math.min(60, Math.max(1, Math.floor(horizonRaw))) : 14;
  const limitRaw = Number(url.searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 200;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(runDateYmd)) {
    return NextResponse.json({ ok: false, error: "date must be YYYY-MM-DD." }, { status: 400 });
  }

  try {
    const result = await runFinancialClearanceSnapshotCron({
      runDateYmd,
      dryRun,
      limit,
      tenantId,
      horizonDays,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    logStructured("error", "financial_os_clearance_snapshot_cron_failed", {
      message,
      dry_run: dryRun,
      tenant_id: tenantId,
    });
    return NextResponse.json({ ok: false, error: "Processor unavailable." }, { status: 500 });
  }
}
