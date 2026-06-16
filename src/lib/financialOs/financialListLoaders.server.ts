import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapInvoiceRow, mapPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceMappers";
import type { FiInvoiceRow, FiPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceModel";

export async function loadFinancialOsInvoices(tenantId: string, limit = 300): Promise<FiInvoiceRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_invoices")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((x) => mapInvoiceRow(x as Record<string, unknown>));
}

export async function loadFinancialOsPayments(tenantId: string, limit = 300): Promise<
  {
    id: string;
    status: string;
    total_cents: number;
    currency: string;
    invoice_id: string;
    created_at: string;
    provider: string | null;
  }[]
> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payments")
    .select("id, status, total_cents, currency, invoice_id, created_at, provider")
    .eq("tenant_id", tenantId.trim())
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((x) => ({
    id: String((x as { id: string }).id),
    status: String((x as { status: string }).status),
    total_cents: Number((x as { total_cents: number }).total_cents),
    currency: String((x as { currency: string }).currency ?? "AUD"),
    invoice_id: String((x as { invoice_id: string }).invoice_id),
    created_at: String((x as { created_at: string }).created_at),
    provider: (x as { provider?: string | null }).provider ?? null,
  }));
}

export async function loadFinancialOsPaymentRequests(tenantId: string, limit = 300): Promise<FiPaymentRequestRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payment_requests")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((x) => mapPaymentRequestRow(x as Record<string, unknown>));
}

export async function loadFinancialOsDepositRules(tenantId: string): Promise<Record<string, unknown>[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_deposit_rules")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .order("priority", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, unknown>[];
}
