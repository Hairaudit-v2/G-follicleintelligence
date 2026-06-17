/**
 * POST or GET /api/cron/financial-os/pathway-task-escalation
 * Auth: Bearer CRON_SECRET | FINANCIAL_OS_CRON_SECRET | FI_PAYMENTS_CRON_SECRET (timing-safe).
 * Optional: dryRun=1, date=YYYY-MM-DD, tenantId=uuid, limit (default 500, max 500).
 */
import { NextRequest, NextResponse } from "next/server";

import { assertCronAuthorized } from "@/src/lib/server/cronAuth";
import { logStructured } from "@/src/lib/server/structuredLog";
import { runPaymentPathwayTaskEscalationCron } from "@/src/lib/financialOs/financialPaymentPathwayInbox.server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const auth = assertCronAuthorized(req, [
    process.env.FINANCIAL_OS_CRON_SECRET ?? "",
    process.env.FI_PAYMENTS_CRON_SECRET ?? "",
    process.env.CRON_SECRET ?? "",
  ]);
  if (auth) return auth;

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1" || url.searchParams.get("dry_run") === "1";
  const runDateYmd = url.searchParams.get("date")?.trim() || new Date().toISOString().slice(0, 10);
  const tenantId = url.searchParams.get("tenantId")?.trim() || null;
  const limitRaw = Number(url.searchParams.get("limit") ?? "500");
  const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 500;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(runDateYmd)) {
    return NextResponse.json({ ok: false, error: "date must be YYYY-MM-DD." }, { status: 400 });
  }

  try {
    const result = await runPaymentPathwayTaskEscalationCron({ todayYmd: runDateYmd, dryRun, limit, tenantId });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    logStructured("error", "financial_os_pathway_task_escalation_cron_failed", {
      message,
      dry_run: dryRun,
      tenant_id: tenantId,
    });
    return NextResponse.json({ ok: false, error: "Processor unavailable." }, { status: 500 });
  }
}
