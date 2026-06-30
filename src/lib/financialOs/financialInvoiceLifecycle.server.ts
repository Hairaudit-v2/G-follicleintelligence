import type { FiInvoiceKind, FiInvoiceStatus } from "@/src/lib/revenueOs/revenueInvoiceModel";
import { invoiceBalanceDueCents } from "@/src/lib/revenueOs/revenueInvoiceModel";

/** Legacy DB rows may still read `issued` until all replicas migrate. */
export function normalizeInvoiceStatus(status: string): FiInvoiceStatus {
  if (status === "issued") return "awaiting_payment";
  return status as FiInvoiceStatus;
}

export function computeInvoiceDaysOverdue(args: {
  due_date: string | null;
  remaining_balance_cents: number;
  todayYmd: string;
}): number {
  const due = args.due_date?.trim();
  if (!due || args.remaining_balance_cents <= 0) return 0;
  if (due >= args.todayYmd) return 0;
  const dueMs = Date.parse(`${due}T00:00:00.000Z`);
  const todayMs = Date.parse(`${args.todayYmd}T00:00:00.000Z`);
  if (!Number.isFinite(dueMs) || !Number.isFinite(todayMs) || todayMs <= dueMs) return 0;
  return Math.floor((todayMs - dueMs) / 86_400_000);
}

export function buildInvoiceLifecyclePatch(
  row: {
    status: FiInvoiceStatus;
    total_cents: number;
    amount_paid_cents: number;
    due_date: string | null;
    paid_at: string | null;
    sent_at: string | null;
  },
  nextStatus: FiInvoiceStatus,
  todayYmd: string
): Record<string, unknown> {
  const remaining = invoiceBalanceDueCents({
    total_cents: row.total_cents,
    amount_paid_cents: row.amount_paid_cents,
  });
  const daysOverdue = computeInvoiceDaysOverdue({
    due_date: row.due_date,
    remaining_balance_cents: remaining,
    todayYmd,
  });
  const patch: Record<string, unknown> = {
    status: nextStatus,
    remaining_balance_cents: remaining,
    days_overdue: daysOverdue,
    updated_at: new Date().toISOString(),
  };
  if (remaining <= 0 && row.total_cents > 0 && !row.paid_at) {
    patch.paid_at = new Date().toISOString();
  }
  if (
    remaining > 0 &&
    nextStatus !== "paid" &&
    nextStatus !== "cancelled" &&
    nextStatus !== "refunded"
  ) {
    patch.paid_at = null;
  }
  return patch;
}

export function resolveInvoiceSentAtPatch(
  currentSentAt: string | null,
  nextStatus: FiInvoiceStatus,
  issuedAtIso: string | null
): string | null {
  if (currentSentAt) return currentSentAt;
  if (nextStatus === "draft") return null;
  return issuedAtIso ?? new Date().toISOString();
}

export function depositDueDateFromRule(
  depositDueDays: number | null | undefined,
  issueYmd: string
): string | null {
  const days = depositDueDays != null ? Math.max(0, Math.floor(depositDueDays)) : null;
  if (days == null) return null;
  const base = Date.parse(`${issueYmd}T00:00:00.000Z`);
  if (!Number.isFinite(base)) return null;
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function resolveSourceModuleFromInvoiceKind(
  invoiceKind: FiInvoiceKind
): "consultation_os" | "surgery_os" | "revenue_os" {
  if (invoiceKind === "consultation_quote") return "consultation_os";
  if (invoiceKind === "surgery_deposit" || invoiceKind === "surgery_balance") return "surgery_os";
  return "revenue_os";
}
