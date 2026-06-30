/**
 * POST or GET /api/cron/financial-os/automation
 * Query: job = deposit_overdue | balance_due_reminders | failed_payment_recovery | payment_escalation_alerts
 * Auth: Bearer CRON_SECRET | FINANCIAL_OS_CRON_SECRET | FI_PAYMENTS_CRON_SECRET (timing-safe).
 * Optional: dryRun=1, date=YYYY-MM-DD, tenantId=uuid, limit (default 200, max 500).
 */
import { NextRequest, NextResponse } from "next/server";

import { validateCronAuth } from "@/src/lib/security/validateCronAuth";
import { logStructured } from "@/src/lib/server/structuredLog";
import { runFinancialOsAutomationJob } from "@/src/lib/financialOs/fiFinancialAutomationCron.server";

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
  const jobRaw = url.searchParams.get("job")?.trim() || "deposit_overdue";
  const dryRun = url.searchParams.get("dryRun") === "1" || url.searchParams.get("dry_run") === "1";
  const runDateYmd = url.searchParams.get("date")?.trim() || new Date().toISOString().slice(0, 10);
  const tenantId = url.searchParams.get("tenantId")?.trim() || null;
  const limitRaw = Number(url.searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 200;

  const jobs = [
    "deposit_overdue",
    "balance_due_reminders",
    "failed_payment_recovery",
    "payment_escalation_alerts",
  ] as const;
  const job = jobs.includes(jobRaw as (typeof jobs)[number])
    ? (jobRaw as (typeof jobs)[number])
    : null;
  if (!job) {
    return NextResponse.json({ ok: false, error: "Invalid job parameter." }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(runDateYmd)) {
    return NextResponse.json({ ok: false, error: "date must be YYYY-MM-DD." }, { status: 400 });
  }

  try {
    const result = await runFinancialOsAutomationJob(job, { runDateYmd, dryRun, limit, tenantId });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    logStructured("error", "financial_os_automation_cron_failed", {
      message,
      job,
      dry_run: dryRun,
      tenant_id: tenantId,
    });
    return NextResponse.json({ ok: false, error: "Processor unavailable." }, { status: 500 });
  }
}
