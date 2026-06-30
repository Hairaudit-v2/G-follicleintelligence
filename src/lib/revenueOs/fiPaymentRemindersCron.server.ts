import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "@/src/lib/crm/activity";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { isPostgresUniqueViolation } from "@/src/lib/payments/stripeWebhookIdempotency";
import { mapInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceMappers";
import type { FiInvoiceKind } from "@/src/lib/revenueOs/revenueInvoiceModel";
import {
  invoiceBalanceDueCents,
  isInvoiceOpenForCollection,
  openCollectionStatusFilter,
} from "@/src/lib/revenueOs/revenueInvoiceModel";

export type FiPaymentRemindersCronResult = {
  examined: number;
  candidates: number;
  recorded: number;
  skippedDuplicate: number;
  dryRun: boolean;
};

function ymdAddDays(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function offsetsForInvoiceKind(kind: FiInvoiceKind, hints: Record<string, unknown>): number[] {
  const dep = hints.deposit_due_reminder_days;
  const bal = hints.balance_due_reminder_days;
  const pick = (raw: unknown): number[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n >= 0);
  };
  if (kind === "surgery_deposit") return pick(dep).length ? pick(dep) : pick(bal);
  return pick(bal).length ? pick(bal) : pick(dep);
}

export async function runFiPaymentRemindersCronOnce(opts: {
  runDateYmd: string;
  dryRun: boolean;
  limit: number;
}): Promise<FiPaymentRemindersCronResult> {
  const runDate = opts.runDateYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(runDate)) {
    throw new Error("runDateYmd must be YYYY-MM-DD.");
  }
  const supabase = supabaseAdmin();
  const { data: rows, error } = await supabase
    .from("fi_invoices")
    .select("*")
    .in("status", openCollectionStatusFilter())
    .not("due_date", "is", null)
    .order("updated_at", { ascending: false })
    .limit(opts.limit);
  if (error) throw new Error(error.message);

  let examined = 0;
  let candidates = 0;
  let recorded = 0;
  let skippedDuplicate = 0;

  for (const raw of rows ?? []) {
    examined += 1;
    const inv = mapInvoiceRow(raw as Record<string, unknown>);
    if (!isInvoiceOpenForCollection(inv.status)) continue;
    const bal = invoiceBalanceDueCents(inv);
    if (bal <= 0) continue;
    const due = inv.due_date?.trim();
    if (!due) continue;

    const hints = inv.automation_hints ?? {};
    const offsets = offsetsForInvoiceKind(inv.invoice_kind, hints);
    const keys: string[] = [];

    for (const off of offsets) {
      const reminderYmd = ymdAddDays(due, -off);
      if (reminderYmd === runDate) {
        keys.push(`due_soon_${inv.invoice_kind}_d${off}`);
      }
    }

    const overdueEnabled = Boolean(hints.overdue_reminder_enabled);
    if (overdueEnabled && due < runDate) {
      keys.push(`overdue_on_${runDate}`);
    }

    if (!keys.length) continue;
    candidates += 1;

    for (const reminderKey of keys) {
      if (opts.dryRun) {
        recorded += 1;
        continue;
      }
      const { error: insErr } = await supabase.from("fi_revenue_reminder_runs").insert({
        tenant_id: inv.tenant_id,
        invoice_id: inv.id,
        reminder_key: reminderKey,
        run_date: runDate,
        metadata: { source: "fi_payments_reminders_cron", dry_run: false },
      });
      if (insErr) {
        if (isPostgresUniqueViolation(insErr)) {
          skippedDuplicate += 1;
          continue;
        }
        throw new Error(insErr.message);
      }
      recorded += 1;
      if (!opts.dryRun) {
        await supabase
          .from("fi_invoices")
          .update({
            last_reminder_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", inv.tenant_id)
          .eq("id", inv.id);
      }
      try {
        await appendCrmActivityEvent({
          tenantId: inv.tenant_id,
          leadId: inv.lead_id,
          patientId: inv.patient_id,
          caseId: inv.case_id,
          activityKind: "fi_os_revenue_reminder_due",
          title: "Revenue reminder (automation signal)",
          detail: {
            invoice_id: inv.id,
            reminder_key: reminderKey,
            run_date: runDate,
            due_date: due,
            invoice_kind: inv.invoice_kind,
            note: "No outbound message was sent — wire templates + cron send stage when ready.",
          },
        });
      } catch {
        /* CRM optional when anchors missing */
      }
    }
  }

  return { examined, candidates, recorded, skippedDuplicate, dryRun: opts.dryRun };
}

/** Scoped variant for a single tenant (admin UI / per-tenant cron hooks). */
export async function runFiPaymentRemindersCronOnceForTenant(
  tenantId: string,
  opts: { runDateYmd: string; dryRun: boolean; limit: number }
): Promise<FiPaymentRemindersCronResult> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const supabase = supabaseAdmin();
  const { data: rows, error } = await supabase
    .from("fi_invoices")
    .select("*")
    .eq("tenant_id", tid)
    .in("status", openCollectionStatusFilter())
    .not("due_date", "is", null)
    .order("updated_at", { ascending: false })
    .limit(opts.limit);
  if (error) throw new Error(error.message);

  let examined = 0;
  let candidates = 0;
  let recorded = 0;
  let skippedDuplicate = 0;
  const runDate = opts.runDateYmd.trim();

  for (const raw of rows ?? []) {
    examined += 1;
    const inv = mapInvoiceRow(raw as Record<string, unknown>);
    if (!isInvoiceOpenForCollection(inv.status)) continue;
    const bal = invoiceBalanceDueCents(inv);
    if (bal <= 0) continue;
    const due = inv.due_date?.trim();
    if (!due) continue;

    const hints = inv.automation_hints ?? {};
    const offsets = offsetsForInvoiceKind(inv.invoice_kind, hints);
    const keys: string[] = [];
    for (const off of offsets) {
      const reminderYmd = ymdAddDays(due, -off);
      if (reminderYmd === runDate) keys.push(`due_soon_${inv.invoice_kind}_d${off}`);
    }
    const overdueEnabled = Boolean(hints.overdue_reminder_enabled);
    if (overdueEnabled && due < runDate) keys.push(`overdue_on_${runDate}`);
    if (!keys.length) continue;
    candidates += 1;

    for (const reminderKey of keys) {
      if (opts.dryRun) {
        recorded += 1;
        continue;
      }
      const { error: insErr } = await supabase.from("fi_revenue_reminder_runs").insert({
        tenant_id: inv.tenant_id,
        invoice_id: inv.id,
        reminder_key: reminderKey,
        run_date: runDate,
        metadata: { source: "fi_payments_reminders_cron", dry_run: false },
      });
      if (insErr) {
        if (isPostgresUniqueViolation(insErr)) {
          skippedDuplicate += 1;
          continue;
        }
        throw new Error(insErr.message);
      }
      recorded += 1;
      if (!opts.dryRun) {
        await supabase
          .from("fi_invoices")
          .update({
            last_reminder_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", inv.tenant_id)
          .eq("id", inv.id);
      }
      try {
        await appendCrmActivityEvent({
          tenantId: inv.tenant_id,
          leadId: inv.lead_id,
          patientId: inv.patient_id,
          caseId: inv.case_id,
          activityKind: "fi_os_revenue_reminder_due",
          title: "Revenue reminder (automation signal)",
          detail: {
            invoice_id: inv.id,
            reminder_key: reminderKey,
            run_date: runDate,
            due_date: due,
            invoice_kind: inv.invoice_kind,
            note: "No outbound message was sent — wire templates + cron send stage when ready.",
          },
        });
      } catch {
        /* optional */
      }
    }
  }

  return { examined, candidates, recorded, skippedDuplicate, dryRun: opts.dryRun };
}
