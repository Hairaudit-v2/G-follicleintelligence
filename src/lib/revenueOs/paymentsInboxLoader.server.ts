import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { crmQuoteTitleFromRowLike } from "@/src/lib/crm/crmQuoteDisplayTitle";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { mapInvoiceRow, mapPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceMappers";
import type { FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import type { FiPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import { invoiceBalanceDueCents, isInvoiceOpenForCollection, openCollectionStatusFilter } from "@/src/lib/revenueOs/revenueInvoiceModel";
import { readCrmQuoteIdFromObjectMetadata } from "@/src/lib/revenueOs/paymentsInboxQuoteMetadata";

export type PaymentsInboxFilters = {
  clinicId: string | null;
  patientQuery: string | null;
  invoiceStatuses: string[] | null;
  dueFrom: string | null;
  dueTo: string | null;
  caseLinkedOnly: boolean;
};

export type PaymentsInboxInvoiceRow = FiInvoiceRow & {
  balance_due_cents: number;
  patient_label: string | null;
  crm_quote_id: string | null;
  crm_quote_title: string | null;
};

export type PaymentsInboxPaymentRow = {
  id: string;
  created_at: string;
  total_cents: number;
  currency: string;
  invoice_id: string;
  patient_id: string | null;
  case_id: string | null;
  crm_quote_id: string | null;
  crm_quote_title: string | null;
};

export type PaymentsInboxFailedRequestRow = FiPaymentRequestRow & {
  invoice_title: string | null;
  failure_at: string | null;
  crm_quote_id: string | null;
  crm_quote_title: string | null;
};

export type PaymentsInboxClinicOption = { id: string; name: string };

export type PaymentsInboxSnapshot = {
  todayYmd: string;
  weekStartYmd: string;
  clinics: PaymentsInboxClinicOption[];
  overdue: PaymentsInboxInvoiceRow[];
  unpaidIssued: PaymentsInboxInvoiceRow[];
  partiallyPaid: PaymentsInboxInvoiceRow[];
  failedPaymentRequests: PaymentsInboxFailedRequestRow[];
  paymentsToday: PaymentsInboxPaymentRow[];
  paymentsThisWeek: PaymentsInboxPaymentRow[];
};

function startOfWeekMondayUtcYmd(todayYmd: string): string {
  const [y, m, d] = todayYmd.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 1, d));
  const wd = dt.getUTCDay(); // 0 Sun .. 6 Sat
  const delta = wd === 0 ? -6 : 1 - wd;
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function patientLabelFromRow(p: { first_name?: string | null; last_name?: string | null } | null): string | null {
  if (!p) return null;
  const a = String(p.first_name ?? "").trim();
  const b = String(p.last_name ?? "").trim();
  const s = `${a} ${b}`.trim();
  return s.length ? s : null;
}

async function loadCrmQuoteTitlesById(
  supabase: ReturnType<typeof supabaseAdmin>,
  tenantId: string,
  quoteIds: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(quoteIds.map((x) => x.trim()).filter(Boolean))].slice(0, 120);
  if (!ids.length) return out;
  const { data, error } = await supabase
    .from("fi_crm_quotes")
    .select("id, metadata, line_items_snapshot")
    .eq("tenant_id", tenantId)
    .in("id", ids);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const r = raw as { id: string; metadata?: unknown; line_items_snapshot?: unknown };
    out.set(String(r.id), crmQuoteTitleFromRowLike(r));
  }
  return out;
}

function matchesPatientQuery(label: string | null, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (!label) return false;
  return label.toLowerCase().includes(needle);
}

function passesInvoiceFilters(inv: PaymentsInboxInvoiceRow, f: PaymentsInboxFilters): boolean {
  if (f.clinicId?.trim() && inv.clinic_id !== f.clinicId.trim()) return false;
  if (f.caseLinkedOnly && !inv.case_id) return false;
  if (f.dueFrom?.trim() && inv.due_date && inv.due_date < f.dueFrom.trim()) return false;
  if (f.dueTo?.trim() && inv.due_date && inv.due_date > f.dueTo.trim()) return false;
  if (f.invoiceStatuses?.length && !f.invoiceStatuses.includes(inv.status)) return false;
  const pq = f.patientQuery?.trim() ?? "";
  if (pq) {
    const uuidish = /^[0-9a-f-]{36}$/i.test(pq);
    if (uuidish) {
      if (inv.patient_id !== pq) return false;
    } else if (!matchesPatientQuery(inv.patient_label, pq)) return false;
  }
  return true;
}

export async function loadPaymentsInboxSnapshot(
  tenantId: string,
  filters: PaymentsInboxFilters,
  todayYmd: string
): Promise<PaymentsInboxSnapshot> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const supabase = supabaseAdmin();
  const weekStartYmd = startOfWeekMondayUtcYmd(todayYmd);

  const [{ data: clinicRows, error: ce }, { data: invs, error: ie }] = await Promise.all([
    supabase.from("fi_clinics").select("id, name").eq("tenant_id", tid).order("name", { ascending: true }).limit(200),
    supabase
      .from("fi_invoices")
      .select("*")
      .eq("tenant_id", tid)
      .in("status", [...openCollectionStatusFilter(), "draft"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(400),
  ]);
  if (ce) throw new Error(ce.message);
  if (ie) throw new Error(ie.message);

  const clinics = (clinicRows ?? []).map((r) => ({
    id: String((r as { id: string }).id),
    name: String((r as { name?: string }).name ?? "Clinic"),
  }));

  const mapped = (invs ?? []).map((r) => {
    const inv = mapInvoiceRow(r as Record<string, unknown>);
    return {
      ...inv,
      balance_due_cents: invoiceBalanceDueCents(inv),
      patient_label: null as string | null,
      crm_quote_id: null as string | null,
      crm_quote_title: null as string | null,
    } satisfies PaymentsInboxInvoiceRow;
  });

  const patientIds = [...new Set(mapped.map((i) => i.patient_id).filter((x): x is string => Boolean(x?.trim())))];
  const patientLabels = new Map<string, string>();
  if (patientIds.length > 0) {
    const { data: prows, error: pe } = await supabase
      .from("fi_patients")
      .select("id, first_name, last_name")
      .eq("tenant_id", tid)
      .in("id", patientIds.slice(0, 200));
    if (pe) throw new Error(pe.message);
    for (const raw of prows ?? []) {
      const id = String((raw as { id: string }).id);
      patientLabels.set(id, patientLabelFromRow(raw as { first_name?: string | null; last_name?: string | null }) ?? "");
    }
  }

  const { data: payRows, error: paye } = await supabase
    .from("fi_payments")
    .select("id, created_at, total_cents, currency, invoice_id, patient_id, case_id, status")
    .eq("tenant_id", tid)
    .eq("status", "succeeded")
    .gte("created_at", `${weekStartYmd}T00:00:00.000Z`)
    .order("created_at", { ascending: false })
    .limit(400);
  if (paye) throw new Error(paye.message);

  const payInvoiceIds = [...new Set((payRows ?? []).map((r) => String((r as { invoice_id: string }).invoice_id)).filter(Boolean))];
  const payInvoiceQuoteId = new Map<string, string>();
  if (payInvoiceIds.length > 0) {
    const { data: invPay, error: ipe } = await supabase
      .from("fi_invoices")
      .select("id, metadata")
      .eq("tenant_id", tid)
      .in("id", payInvoiceIds.slice(0, 300));
    if (ipe) throw new Error(ipe.message);
    for (const raw of invPay ?? []) {
      const id = String((raw as { id: string }).id);
      const meta = (raw as { metadata?: unknown }).metadata;
      const qid = readCrmQuoteIdFromObjectMetadata(meta as Record<string, unknown>);
      if (qid) payInvoiceQuoteId.set(id, qid);
    }
  }

  const { data: prRows, error: pre } = await supabase
    .from("fi_payment_requests")
    .select("*")
    .eq("tenant_id", tid)
    .order("updated_at", { ascending: false })
    .limit(120);
  if (pre) throw new Error(pre.message);

  const quoteIdSet = new Set<string>();
  for (const inv of mapped) {
    const q = readCrmQuoteIdFromObjectMetadata(inv.metadata);
    if (q) quoteIdSet.add(q);
  }
  for (const q of payInvoiceQuoteId.values()) quoteIdSet.add(q);

  const failedPaymentRequests: PaymentsInboxFailedRequestRow[] = [];
  for (const raw of prRows ?? []) {
    const pr = mapPaymentRequestRow(raw as Record<string, unknown>);
    const failAt = pr.metadata?.stripe_checkout_failed_at;
    if (typeof failAt !== "string" || !failAt.trim()) continue;
    const inv = mapped.find((i) => i.id === pr.invoice_id);
    const fromInv = inv ? readCrmQuoteIdFromObjectMetadata(inv.metadata) : null;
    const fromPr = readCrmQuoteIdFromObjectMetadata(pr.metadata as Record<string, unknown>);
    const qid = fromInv ?? fromPr;
    if (qid) quoteIdSet.add(qid);
    failedPaymentRequests.push({
      ...pr,
      invoice_title: inv?.title ?? null,
      failure_at: failAt.trim(),
      crm_quote_id: qid,
      crm_quote_title: null,
    });
  }

  const quoteTitles = await loadCrmQuoteTitlesById(supabase, tid, [...quoteIdSet]);

  const withLabels: PaymentsInboxInvoiceRow[] = mapped.map((inv) => {
    const qid = readCrmQuoteIdFromObjectMetadata(inv.metadata);
    return {
      ...inv,
      patient_label: inv.patient_id ? patientLabels.get(inv.patient_id) || null : null,
      crm_quote_id: qid,
      crm_quote_title: qid ? quoteTitles.get(qid) ?? "Quote" : null,
    };
  });

  for (const fp of failedPaymentRequests) {
    if (fp.crm_quote_id) {
      fp.crm_quote_title = quoteTitles.get(fp.crm_quote_id) ?? "Quote";
    }
  }

  const filtered = withLabels.filter((inv) => passesInvoiceFilters(inv, filters));

  const overdue: PaymentsInboxInvoiceRow[] = [];
  const unpaidIssued: PaymentsInboxInvoiceRow[] = [];
  const partiallyPaid: PaymentsInboxInvoiceRow[] = [];

  for (const inv of filtered) {
    if (!isInvoiceOpenForCollection(inv.status)) continue;
    const bal = inv.balance_due_cents;
    if (bal <= 0) continue;
    const due = inv.due_date?.trim();
    const pastDue = Boolean(due && due < todayYmd);

    if (inv.status === "partially_paid") {
      partiallyPaid.push(inv);
    }

    if (
      inv.status === "overdue" ||
      (pastDue && (inv.status === "awaiting_payment" || inv.status === "sent" || inv.status === "partially_paid"))
    ) {
      overdue.push(inv);
    } else if (inv.status === "awaiting_payment" || inv.status === "sent") {
      unpaidIssued.push(inv);
    }
  }

  const dayStart = `${todayYmd}T00:00:00.000Z`;

  const paymentsToday: PaymentsInboxPaymentRow[] = [];
  const paymentsThisWeek: PaymentsInboxPaymentRow[] = [];
  for (const raw of payRows ?? []) {
    const row = raw as {
      id: string;
      created_at: string;
      total_cents: number;
      currency: string;
      invoice_id: string;
      patient_id: string | null;
      case_id: string | null;
    };
    const iid = String(row.invoice_id);
    const qid = payInvoiceQuoteId.get(iid) ?? null;
    const p: PaymentsInboxPaymentRow = {
      id: String(row.id),
      created_at: String(row.created_at),
      total_cents: Number(row.total_cents ?? 0),
      currency: String(row.currency ?? "AUD"),
      invoice_id: iid,
      patient_id: row.patient_id != null ? String(row.patient_id) : null,
      case_id: row.case_id != null ? String(row.case_id) : null,
      crm_quote_id: qid,
      crm_quote_title: qid ? quoteTitles.get(qid) ?? "Quote" : null,
    };
    paymentsThisWeek.push(p);
    if (p.created_at >= dayStart) paymentsToday.push(p);
  }

  return {
    todayYmd,
    weekStartYmd,
    clinics,
    overdue,
    unpaidIssued,
    partiallyPaid,
    failedPaymentRequests,
    paymentsToday,
    paymentsThisWeek,
  };
}
