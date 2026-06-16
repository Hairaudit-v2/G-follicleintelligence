import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceMappers";
import type { FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import { invoiceBalanceDueCents, isInvoiceOpenForCollection } from "@/src/lib/revenueOs/revenueInvoiceModel";
import {
  loadFinancialPaymentPathwayDashboardCounts,
  type FinancialPaymentPathwayDashboardCounts,
} from "@/src/lib/financialOs/financialPaymentPathways.server";

export type FinancialOsDashboardMetrics = {
  outstandingRevenueCents: number;
  outstandingInvoiceCount: number;
  upcomingPaymentRequestCount: number;
  upcomingInstallmentCount: number;
  failedPaymentCount: number;
  depositConversionRate: number | null;
  monthlyRevenueForecastCents: number | null;
  currency: string;
  /** FinancialOS Phase 2: payment pathway counts and settlement risk. */
  paymentPathways: FinancialPaymentPathwayDashboardCounts;
};

function sumBalances(rows: FiInvoiceRow[]): { cents: number; currency: string } {
  let cents = 0;
  let currency = "AUD";
  for (const r of rows) {
    if (!isInvoiceOpenForCollection(r.status)) continue;
    cents += invoiceBalanceDueCents(r);
    currency = r.currency?.trim().toUpperCase() || currency;
  }
  return { cents, currency };
}

/**
 * Aggregates FinancialOS dashboard metrics for a tenant (read-only; uses service role after portal gate).
 */
export async function loadFinancialOsDashboardMetrics(tenantId: string): Promise<FinancialOsDashboardMetrics> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();

  const { data: invRaw, error: ie } = await supabase
    .from("fi_invoices")
    .select("*")
    .eq("tenant_id", tid)
    .in("status", ["issued", "partially_paid", "overdue"])
    .order("updated_at", { ascending: false })
    .limit(2000);
  if (ie) throw new Error(ie.message);
  const invoices = (invRaw ?? []).map((x) => mapInvoiceRow(x as Record<string, unknown>));
  const { cents: outstandingRevenueCents, currency } = sumBalances(invoices);

  const today = new Date();
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + 30);
  const todayYmd = today.toISOString().slice(0, 10);
  const horizonYmd = horizon.toISOString().slice(0, 10);

  const { count: prCount } = await supabase
    .from("fi_payment_requests")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .in("status", ["sent", "viewed"]);

  const { count: instCount } = await supabase
    .from("fi_installment_plans")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .eq("status", "active")
    .not("next_payment_date", "is", null)
    .gte("next_payment_date", todayYmd)
    .lte("next_payment_date", horizonYmd);

  const failedSince = new Date();
  failedSince.setUTCDate(failedSince.getUTCDate() - 60);
  const { count: failedPay } = await supabase
    .from("fi_payments")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .eq("status", "failed")
    .gte("created_at", failedSince.toISOString());

  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - 90);
  const { data: cqRows } = await supabase
    .from("fi_invoices")
    .select("id, status, amount_paid_cents, issued_at, created_at")
    .eq("tenant_id", tid)
    .eq("invoice_kind", "consultation_quote")
    .gte("created_at", windowStart.toISOString());

  let depositConversionRate: number | null = null;
  const cqList = cqRows ?? [];
  if (cqList.length > 0) {
    const withDeposit = cqList.filter((r) => {
      const paid = Number((r as { amount_paid_cents?: unknown }).amount_paid_cents ?? 0);
      const st = String((r as { status?: unknown }).status ?? "");
      return paid > 0 || st === "paid" || st === "partially_paid";
    }).length;
    depositConversionRate = withDeposit / cqList.length;
  }

  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const prev0 = new Date(monthStart);
  prev0.setUTCMonth(prev0.getUTCMonth() - 1);
  const prev1 = new Date(monthStart);
  prev1.setUTCMonth(prev1.getUTCMonth() - 2);
  const prev2 = new Date(monthStart);
  prev2.setUTCMonth(prev2.getUTCMonth() - 3);

  const months = [prev2, prev1, prev0];
  const totals: number[] = [];
  for (const m of months) {
    const start = m.toISOString();
    const end = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)).toISOString();
    const { data: pays } = await supabase
      .from("fi_payments")
      .select("total_cents")
      .eq("tenant_id", tid)
      .eq("status", "succeeded")
      .gte("created_at", start)
      .lt("created_at", end);
    const sum = (pays ?? []).reduce((acc, p) => acc + Math.max(0, Number((p as { total_cents?: unknown }).total_cents ?? 0)), 0);
    totals.push(sum);
  }
  const monthlyRevenueForecastCents =
    totals.length > 0 ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : null;

  const paymentPathways = await loadFinancialPaymentPathwayDashboardCounts(tid);

  return {
    outstandingRevenueCents: outstandingRevenueCents,
    outstandingInvoiceCount: invoices.filter((r) => isInvoiceOpenForCollection(r.status) && invoiceBalanceDueCents(r) > 0).length,
    upcomingPaymentRequestCount: prCount ?? 0,
    upcomingInstallmentCount: instCount ?? 0,
    failedPaymentCount: failedPay ?? 0,
    depositConversionRate,
    monthlyRevenueForecastCents,
    currency,
    paymentPathways,
  };
}
