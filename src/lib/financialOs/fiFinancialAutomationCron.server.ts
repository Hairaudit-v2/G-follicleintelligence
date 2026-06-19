import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "@/src/lib/crm/activity";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { isPostgresUniqueViolation } from "@/src/lib/payments/stripeWebhookIdempotency";
import { mapInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceMappers";
import { upsertArCaseFromInvoice } from "@/src/lib/financialOs/financialAccountsReceivable.server";
import { invoiceBalanceDueCents, isInvoiceOpenForCollection, openCollectionStatusFilter } from "@/src/lib/revenueOs/revenueInvoiceModel";

export type FiFinancialAutomationCronResult = {
  job: string;
  examined: number;
  recorded: number;
  skippedDuplicate: number;
  dryRun: boolean;
};

async function insertRun(
  tenantId: string,
  kind: string,
  entityKind: string,
  entityId: string,
  runDate: string,
  dryRun: boolean
): Promise<"inserted" | "duplicate"> {
  if (dryRun) return "inserted";
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("fi_financial_automation_runs").insert({
    tenant_id: tenantId,
    automation_kind: kind,
    entity_kind: entityKind,
    entity_id: entityId,
    run_date: runDate,
    metadata: {},
  });
  if (error) {
    if (isPostgresUniqueViolation(error)) return "duplicate";
    throw new Error(error.message);
  }
  return "inserted";
}

/** Invoices past due with positive balance — deposit / balance overdue signal. */
export async function runFinancialOsDepositOverdueJob(opts: {
  runDateYmd: string;
  dryRun: boolean;
  limit: number;
  tenantId?: string | null;
}): Promise<FiFinancialAutomationCronResult> {
  const runDate = opts.runDateYmd.trim();
  const supabase = supabaseAdmin();
  let q = supabase
    .from("fi_invoices")
    .select("*")
    .in("invoice_kind", ["surgery_deposit", "consultation_quote", "surgery_balance"])
    .in("status", openCollectionStatusFilter())
    .not("due_date", "is", null)
    .lt("due_date", runDate)
    .order("updated_at", { ascending: false })
    .limit(opts.limit);
  const tid = opts.tenantId?.trim();
  if (tid) q = q.eq("tenant_id", tid);
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);

  let examined = 0;
  let recorded = 0;
  let skippedDuplicate = 0;
  for (const raw of rows ?? []) {
    examined += 1;
    const inv = mapInvoiceRow(raw as Record<string, unknown>);
    if (!isInvoiceOpenForCollection(inv.status)) continue;
    if (invoiceBalanceDueCents(inv) <= 0) continue;
    const ins = await insertRun(inv.tenant_id, "deposit_or_balance_overdue", "invoice", inv.id, runDate, opts.dryRun);
    if (ins === "duplicate") {
      skippedDuplicate += 1;
      continue;
    }
    recorded += 1;
    if (!opts.dryRun) {
      try {
        await appendCrmActivityEvent({
          tenantId: inv.tenant_id,
          leadId: inv.lead_id,
          patientId: inv.patient_id,
          caseId: inv.case_id,
          activityKind: "fi_os_financial_overdue_signal",
          title: "FinancialOS: overdue receivable",
          detail: {
            invoice_id: inv.id,
            invoice_kind: inv.invoice_kind,
            due_date: inv.due_date,
            run_date: runDate,
            note: "Automation signal only — wire outbound messaging separately.",
          },
        });
      } catch {
        /* optional */
      }
      try {
        await upsertArCaseFromInvoice({
          tenantId: inv.tenant_id,
          invoice: inv,
          todayYmd: runDate,
          trigger: inv.invoice_kind === "surgery_deposit" ? "deposit_deadline_missed" : "invoice_overdue",
        });
      } catch {
        /* AR case best-effort */
      }
    }
  }
  return { job: "deposit_overdue", examined, recorded, skippedDuplicate, dryRun: opts.dryRun };
}

/** Balance due soon: mirrors automation_hints offsets (same calendar math as revenue reminders). */
export async function runFinancialOsBalanceDueRemindersJob(opts: {
  runDateYmd: string;
  dryRun: boolean;
  limit: number;
  tenantId?: string | null;
}): Promise<FiFinancialAutomationCronResult> {
  const runDate = opts.runDateYmd.trim();
  const supabase = supabaseAdmin();
  let q = supabase
    .from("fi_invoices")
    .select("*")
    .in("status", openCollectionStatusFilter())
    .not("due_date", "is", null)
    .order("updated_at", { ascending: false })
    .limit(opts.limit);
  if (opts.tenantId?.trim()) q = q.eq("tenant_id", opts.tenantId.trim());
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);

  function ymdAddDays(ymd: string, deltaDays: number): string {
    const [y, m, d] = ymd.split("-").map((x) => Number(x));
    const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
    dt.setUTCDate(dt.getUTCDate() + deltaDays);
    return dt.toISOString().slice(0, 10);
  }

  let examined = 0;
  let recorded = 0;
  let skippedDuplicate = 0;

  for (const raw of rows ?? []) {
    examined += 1;
    const inv = mapInvoiceRow(raw as Record<string, unknown>);
    if (!isInvoiceOpenForCollection(inv.status)) continue;
    if (invoiceBalanceDueCents(inv) <= 0) continue;
    const due = inv.due_date?.trim();
    if (!due) continue;
    const hints = inv.automation_hints ?? {};
    const balDays = Array.isArray(hints.balance_due_reminder_days)
      ? (hints.balance_due_reminder_days as unknown[]).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n >= 0)
      : [];
    const depDays = Array.isArray(hints.deposit_due_reminder_days)
      ? (hints.deposit_due_reminder_days as unknown[]).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n >= 0)
      : [];
    const offsets = balDays.length ? balDays : depDays;
    if (!offsets.length) continue;

    let hit = false;
    for (const off of offsets) {
      if (ymdAddDays(due, -off) === runDate) {
        hit = true;
        break;
      }
    }
    if (!hit) continue;

    const ins = await insertRun(inv.tenant_id, "balance_due_reminder", "invoice", inv.id, runDate, opts.dryRun);
    if (ins === "duplicate") {
      skippedDuplicate += 1;
      continue;
    }
    recorded += 1;
    if (!opts.dryRun) {
      try {
        await appendCrmActivityEvent({
          tenantId: inv.tenant_id,
          leadId: inv.lead_id,
          patientId: inv.patient_id,
          caseId: inv.case_id,
          activityKind: "fi_os_financial_balance_due_reminder",
          title: "FinancialOS: balance due reminder window",
          detail: { invoice_id: inv.id, due_date: due, run_date: runDate },
        });
      } catch {
        /* optional */
      }
    }
  }
  return { job: "balance_due_reminders", examined, recorded, skippedDuplicate, dryRun: opts.dryRun };
}

/** Failed Stripe checkout rows (metadata) — recovery nudge. */
export async function runFinancialOsFailedPaymentRecoveryJob(opts: {
  runDateYmd: string;
  dryRun: boolean;
  limit: number;
  tenantId?: string | null;
}): Promise<FiFinancialAutomationCronResult> {
  const runDate = opts.runDateYmd.trim();
  const supabase = supabaseAdmin();
  let q = supabase
    .from("fi_payment_requests")
    .select("id, tenant_id, invoice_id, metadata, status")
    .in("status", ["draft", "sent", "viewed"])
    .order("updated_at", { ascending: false })
    .limit(opts.limit);
  if (opts.tenantId?.trim()) q = q.eq("tenant_id", opts.tenantId.trim());
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);

  let examined = 0;
  let recorded = 0;
  let skippedDuplicate = 0;
  for (const raw of rows ?? []) {
    examined += 1;
    const id = String((raw as { id: string }).id);
    const tid = String((raw as { tenant_id: string }).tenant_id);
    const meta = (raw as { metadata?: Record<string, unknown> }).metadata ?? {};
    if (!meta.stripe_checkout_failed_at) continue;

    const ins = await insertRun(tid, "failed_checkout_recovery", "payment_request", id, runDate, opts.dryRun);
    if (ins === "duplicate") {
      skippedDuplicate += 1;
      continue;
    }
    recorded += 1;
    if (!opts.dryRun) {
      try {
        await appendCrmActivityEvent({
          tenantId: tid,
          leadId: null,
          patientId: null,
          caseId: null,
          activityKind: "fi_os_financial_failed_checkout_recovery",
          title: "FinancialOS: failed checkout recovery",
          detail: { payment_request_id: id, invoice_id: (raw as { invoice_id?: string }).invoice_id ?? null, run_date: runDate },
        });
      } catch {
        /* optional */
      }
    }
  }
  return { job: "failed_payment_recovery", examined, recorded, skippedDuplicate, dryRun: opts.dryRun };
}

/** Escalation: multiple failures on same invoice (metadata on latest PR). */
export async function runFinancialOsEscalationAlertsJob(opts: {
  runDateYmd: string;
  dryRun: boolean;
  limit: number;
  tenantId?: string | null;
}): Promise<FiFinancialAutomationCronResult> {
  const runDate = opts.runDateYmd.trim();
  const supabase = supabaseAdmin();
  let q = supabase
    .from("fi_payment_requests")
    .select("id, tenant_id, invoice_id, metadata")
    .order("updated_at", { ascending: false })
    .limit(opts.limit);
  if (opts.tenantId?.trim()) q = q.eq("tenant_id", opts.tenantId.trim());
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);

  let examined = 0;
  let recorded = 0;
  let skippedDuplicate = 0;
  for (const raw of rows ?? []) {
    examined += 1;
    const meta = (raw as { metadata?: Record<string, unknown> }).metadata ?? {};
    const fails = Number(meta.stripe_failure_escalation_count ?? 0) || 0;
    if (fails < 2) continue;

    const id = String((raw as { id: string }).id);
    const tid = String((raw as { tenant_id: string }).tenant_id);
    const ins = await insertRun(tid, "payment_escalation", "payment_request", id, runDate, opts.dryRun);
    if (ins === "duplicate") {
      skippedDuplicate += 1;
      continue;
    }
    recorded += 1;
    if (!opts.dryRun) {
      try {
        await appendCrmActivityEvent({
          tenantId: tid,
          leadId: null,
          patientId: null,
          caseId: null,
          activityKind: "fi_os_financial_payment_escalation",
          title: "FinancialOS: payment escalation",
          detail: { payment_request_id: id, invoice_id: (raw as { invoice_id?: string }).invoice_id ?? null, run_date: runDate },
        });
      } catch {
        /* optional */
      }
    }
  }
  return { job: "payment_escalation_alerts", examined, recorded, skippedDuplicate, dryRun: opts.dryRun };
}

export async function runFinancialOsAutomationJob(
  job: "deposit_overdue" | "balance_due_reminders" | "failed_payment_recovery" | "payment_escalation_alerts",
  opts: { runDateYmd: string; dryRun: boolean; limit: number; tenantId?: string | null }
): Promise<FiFinancialAutomationCronResult> {
  if (opts.tenantId?.trim()) assertNonEmptyUuid(opts.tenantId, "tenantId");
  switch (job) {
    case "deposit_overdue":
      return runFinancialOsDepositOverdueJob(opts);
    case "balance_due_reminders":
      return runFinancialOsBalanceDueRemindersJob(opts);
    case "failed_payment_recovery":
      return runFinancialOsFailedPaymentRecoveryJob(opts);
    case "payment_escalation_alerts":
      return runFinancialOsEscalationAlertsJob(opts);
    default:
      throw new Error("Unknown job.");
  }
}
