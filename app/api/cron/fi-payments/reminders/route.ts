/**
 * POST or GET /api/cron/fi-payments/reminders
 * Authorisation: Bearer `CRON_SECRET`, `FINANCIAL_OS_CRON_SECRET`, or `FI_PAYMENTS_CRON_SECRET` (timing-safe).
 * Query: `dryRun=1` | `dry_run=1`, optional `date=YYYY-MM-DD` (defaults to UTC today), optional `tenantId` (UUID), optional `limit` (default 200, max 500).
 */
import { NextRequest, NextResponse } from "next/server";

import { validateCronAuth } from "@/src/lib/security/validateCronAuth";
import { logStructured } from "@/src/lib/server/structuredLog";
import { runFiPaymentRemindersCronOnce, runFiPaymentRemindersCronOnceForTenant } from "@/src/lib/revenueOs/fiPaymentRemindersCron.server";

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
  const limitRaw = Number(url.searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 200;

  try {
    const result = tenantId
      ? await runFiPaymentRemindersCronOnceForTenant(tenantId, { runDateYmd, dryRun, limit })
      : await runFiPaymentRemindersCronOnce({ runDateYmd, dryRun, limit });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    logStructured("error", "fi_payment_reminders_cron_failed", {
      message,
      dry_run: dryRun,
      tenant_id: tenantId,
    });
    return NextResponse.json({ ok: false, error: "Processor unavailable." }, { status: 500 });
  }
}
