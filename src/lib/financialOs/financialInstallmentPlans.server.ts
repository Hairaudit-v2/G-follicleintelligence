import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceMappers";
import { invoiceBalanceDueCents } from "@/src/lib/revenueOs/revenueInvoiceModel";

export type FiInstallmentPlanRow = {
  id: string;
  tenant_id: string;
  invoice_id: string;
  patient_id: string | null;
  total_amount: number;
  currency: string;
  frequency: "weekly" | "biweekly" | "monthly";
  installment_amount: number;
  remaining_balance: number;
  next_payment_date: string | null;
  status: "active" | "paused" | "completed" | "cancelled";
  created_at: string;
};

function mapPlan(raw: Record<string, unknown>): FiInstallmentPlanRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    invoice_id: String(raw.invoice_id),
    patient_id: raw.patient_id ? String(raw.patient_id) : null,
    total_amount: Number(raw.total_amount ?? 0),
    currency: String(raw.currency ?? "AUD"),
    frequency: raw.frequency as FiInstallmentPlanRow["frequency"],
    installment_amount: Number(raw.installment_amount ?? 0),
    remaining_balance: Number(raw.remaining_balance ?? 0),
    next_payment_date: raw.next_payment_date ? String(raw.next_payment_date) : null,
    status: raw.status as FiInstallmentPlanRow["status"],
    created_at: String(raw.created_at ?? ""),
  };
}

export async function loadInstallmentPlansForTenant(tenantId: string): Promise<FiInstallmentPlanRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_installment_plans")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []).map((x) => mapPlan(x as Record<string, unknown>));
}

export async function createInstallmentPlanForInvoice(args: {
  tenantId: string;
  invoiceId: string;
  frequency: "weekly" | "biweekly" | "monthly";
  installmentAmountCents: number;
  nextPaymentDateYmd: string | null;
}): Promise<FiInstallmentPlanRow> {
  const tid = args.tenantId.trim();
  const iid = args.invoiceId.trim();
  const supabase = supabaseAdmin();
  const { data: invRaw, error: ie } = await supabase.from("fi_invoices").select("*").eq("tenant_id", tid).eq("id", iid).maybeSingle();
  if (ie) throw new Error(ie.message);
  if (!invRaw) throw new Error("Invoice not found.");
  const inv = mapInvoiceRow(invRaw as Record<string, unknown>);
  const bal = invoiceBalanceDueCents(inv);
  if (bal <= 0) throw new Error("Invoice has no balance to schedule.");

  const inst = Math.max(0, Math.floor(args.installmentAmountCents));
  if (!inst) throw new Error("installmentAmountCents must be positive.");
  if (inst > bal) throw new Error("Installment exceeds invoice balance.");

  const { data: ins, error: insE } = await supabase
    .from("fi_installment_plans")
    .insert({
      tenant_id: tid,
      invoice_id: iid,
      patient_id: inv.patient_id,
      total_amount: bal,
      currency: inv.currency,
      frequency: args.frequency,
      installment_amount: inst,
      remaining_balance: bal,
      next_payment_date: args.nextPaymentDateYmd?.trim() || null,
      status: "active",
      metadata: { source: "financial_os_ui" },
    })
    .select("*")
    .single();
  if (insE) throw new Error(insE.message);
  return mapPlan(ins as Record<string, unknown>);
}
