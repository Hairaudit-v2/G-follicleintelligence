import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { readFiPaymentsEnabled } from "@/src/lib/payments/fiPaymentEnv.server";
import { mapInvoiceRow, mapPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceMappers";
import type { FiInvoiceKind, FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import type { FiPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import {
  invoiceBalanceDueCents,
  isInvoiceOpenForCollection,
  openCollectionStatusFilter,
} from "@/src/lib/revenueOs/revenueInvoiceModel";

export type PatientInvoiceSummary = {
  invoices: FiInvoiceRow[];
  outstandingCentsAud: number;
  unpaidOpenCount: number;
  overdueCount: number;
};

export async function loadPatientInvoiceSummary(
  tenantId: string,
  patientId: string
): Promise<PatientInvoiceSummary> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const pid = assertNonEmptyUuid(patientId, "patientId").trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_invoices")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const invoices = (data ?? []).map((r) => mapInvoiceRow(r as Record<string, unknown>));
  let outstandingCentsAud = 0;
  let unpaidOpenCount = 0;
  let overdueCount = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const inv of invoices) {
    if (!isInvoiceOpenForCollection(inv.status)) continue;
    const bal = invoiceBalanceDueCents(inv);
    if (bal <= 0) continue;
    unpaidOpenCount += 1;
    if (inv.currency === "AUD") outstandingCentsAud += bal;
    const due = inv.due_date?.trim();
    if (due && due < today) overdueCount += 1;
  }
  return { invoices, outstandingCentsAud, unpaidOpenCount, overdueCount };
}

export type CasePaymentRequestWithInvoiceKind = FiPaymentRequestRow & {
  invoice_kind: FiInvoiceKind;
};

export type CasePaymentReadiness = {
  invoices: FiInvoiceRow[];
  /** Recent payment requests for invoices on this case (newest first). */
  paymentRequests: CasePaymentRequestWithInvoiceKind[];
  /** Soft signal when deposit rules + unpaid deposit invoices align — staff can override. */
  depositReadinessBlock: boolean;
  depositReadinessMessage: string | null;
};

export async function loadCasePaymentReadiness(
  tenantId: string,
  caseId: string
): Promise<CasePaymentReadiness> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const cid = assertNonEmptyUuid(caseId, "caseId").trim();
  const supabase = supabaseAdmin();
  const [{ data: invs, error: ie }, { data: rules, error: re }] = await Promise.all([
    supabase
      .from("fi_invoices")
      .select("*")
      .eq("tenant_id", tid)
      .eq("case_id", cid)
      .order("created_at", { ascending: false }),
    supabase.from("fi_deposit_rules").select("*").eq("tenant_id", tid).eq("is_active", true),
  ]);
  if (ie) throw new Error(ie.message);
  if (re) throw new Error(re.message);
  const invoices = (invs ?? []).map((r) => mapInvoiceRow(r as Record<string, unknown>));
  const ruleBlocks = (rules ?? []).some((r) =>
    Boolean(
      (r as { blocks_surgery_readiness_when_unpaid?: boolean }).blocks_surgery_readiness_when_unpaid
    )
  );
  const unpaidDeposit = invoices.some(
    (inv) =>
      inv.invoice_kind === "surgery_deposit" &&
      isInvoiceOpenForCollection(inv.status) &&
      invoiceBalanceDueCents(inv) > 0
  );
  const depositReadinessBlock = ruleBlocks && unpaidDeposit;

  const invIds = invoices.map((i) => i.id);
  let paymentRequests: CasePaymentRequestWithInvoiceKind[] = [];
  if (invIds.length > 0) {
    const { data: prs, error: pme } = await supabase
      .from("fi_payment_requests")
      .select("*")
      .eq("tenant_id", tid)
      .in("invoice_id", invIds)
      .order("created_at", { ascending: false })
      .limit(120);
    if (pme) throw new Error(pme.message);
    paymentRequests = (prs ?? []).map((raw) => {
      const pr = mapPaymentRequestRow(raw as Record<string, unknown>);
      const inv = invoices.find((x) => x.id === pr.invoice_id);
      return { ...pr, invoice_kind: (inv?.invoice_kind ?? "other") as FiInvoiceKind };
    });
  }

  return {
    invoices,
    paymentRequests,
    depositReadinessBlock,
    depositReadinessMessage: depositReadinessBlock
      ? "An active deposit rule flags this case while a surgery deposit invoice remains unpaid — confirm with finance before proceeding."
      : null,
  };
}

export type UnpaidInvoicesDashboardRow = FiInvoiceRow & { balance_due_cents: number };

export async function loadUnpaidInvoicesDashboard(
  tenantId: string,
  limit = 25
): Promise<UnpaidInvoicesDashboardRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_invoices")
    .select("*")
    .eq("tenant_id", tid)
    .in("status", openCollectionStatusFilter())
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((r) => mapInvoiceRow(r as Record<string, unknown>))
    .map((inv) => ({
      ...inv,
      balance_due_cents: invoiceBalanceDueCents(inv),
    }))
    .filter((r) => r.balance_due_cents > 0);
}

export type RevenueCollectionsDashboardKpis = {
  moduleEnabled: boolean;
  unpaidIssuedInvoiceCount: number;
  overdueInvoiceCount: number;
};

export async function loadRevenueCollectionsDashboardKpis(
  tenantId: string,
  todayYmd: string
): Promise<RevenueCollectionsDashboardKpis> {
  if (!readFiPaymentsEnabled()) {
    return { moduleEnabled: false, unpaidIssuedInvoiceCount: 0, overdueInvoiceCount: 0 };
  }
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_invoices")
    .select("id, status, due_date, total_cents, amount_paid_cents")
    .eq("tenant_id", tid)
    .in("status", openCollectionStatusFilter());
  if (error) throw new Error(error.message);
  let unpaidIssuedInvoiceCount = 0;
  let overdueInvoiceCount = 0;
  for (const raw of data ?? []) {
    const row = raw as {
      status: string;
      due_date: string | null;
      total_cents: number;
      amount_paid_cents: number;
    };
    const total = Number(row.total_cents ?? 0);
    const paid = Number(row.amount_paid_cents ?? 0);
    const bal = Math.max(0, total - paid);
    if (bal <= 0) continue;
    unpaidIssuedInvoiceCount += 1;
    const due = row.due_date != null ? String(row.due_date).slice(0, 10) : null;
    if (row.status === "overdue" || (due && due < todayYmd)) overdueInvoiceCount += 1;
  }
  return {
    moduleEnabled: true,
    unpaidIssuedInvoiceCount,
    overdueInvoiceCount,
  };
}
