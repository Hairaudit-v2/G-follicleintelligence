/**
 * POST or GET /api/cron/financial-os/expense-ocr
 * Processes pending fi_expense_documents OCR jobs.
 * Auth: Bearer CRON_SECRET | FINANCIAL_OS_CRON_SECRET | FI_PAYMENTS_CRON_SECRET
 *
 * Query: tenantId (optional), limit (1–50, default 10)
 */
import { NextRequest, NextResponse } from "next/server";

import { validateCronAuth } from "@/src/lib/security/validateCronAuth";
import { logStructured } from "@/src/lib/server/structuredLog";
import { runExpenseOcrCron } from "@/src/lib/financialOs/expenses/expenseOcrJob.server";

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
  const tenantId = url.searchParams.get("tenantId")?.trim() || null;
  const limitRaw = Number(url.searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 10;

  try {
    const summary = await runExpenseOcrCron({ tenantId, limit });
    logStructured("info", "financial_os_expense_ocr_cron_completed", {
      mode: summary.mode,
      processed: summary.processed,
      succeeded: summary.succeeded,
      failed: summary.failed,
      duration_ms: summary.durationMs,
      tenant_id: tenantId,
    });
    return NextResponse.json(summary);
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    logStructured("error", "financial_os_expense_ocr_cron_failed", {
      message,
      tenant_id: tenantId,
    });
    return NextResponse.json({ ok: false, error: "Processor unavailable." }, { status: 500 });
  }
}
