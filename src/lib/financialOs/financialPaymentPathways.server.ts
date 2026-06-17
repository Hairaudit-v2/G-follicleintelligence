import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  resolveActivePaymentPathway,
  type FiPaymentPathwayRow,
  type FiPaymentPathwayStatus,
  type FiPaymentPathwayType,
} from "@/src/lib/financialOs/financialPaymentPathwayCore";
import { createPaymentPathwayTaskForPathway } from "@/src/lib/financialOs/financialPaymentPathwayInbox.server";
import type { FiPaymentPathwaySource } from "@/src/lib/financialOs/publicPaymentPathwaySelectionCore";

export type FinancialPaymentPathwayRecord = FiPaymentPathwayRow & {
  tenant_id: string;
  patient_id: string | null;
  case_id: string | null;
  invoice_id: string | null;
  booking_id: string | null;
  selected_at: string | null;
  source: FiPaymentPathwaySource;
  source_payment_request_id: string | null;
  metadata: Record<string, unknown>;
};

function mapRow(raw: Record<string, unknown>): FinancialPaymentPathwayRecord {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    patient_id: raw.patient_id ? String(raw.patient_id) : null,
    case_id: raw.case_id ? String(raw.case_id) : null,
    invoice_id: raw.invoice_id ? String(raw.invoice_id) : null,
    booking_id: raw.booking_id ? String(raw.booking_id) : null,
    pathway_type: raw.pathway_type as FiPaymentPathwayType,
    status: raw.status as FiPaymentPathwayStatus,
    provider: raw.provider ? String(raw.provider) : null,
    provider_reference: raw.provider_reference ? String(raw.provider_reference) : null,
    selected_at: raw.selected_at ? String(raw.selected_at) : null,
    expected_settlement_date: raw.expected_settlement_date ? String(raw.expected_settlement_date).slice(0, 10) : null,
    actual_settlement_date: raw.actual_settlement_date ? String(raw.actual_settlement_date).slice(0, 10) : null,
    currency_code: raw.currency_code ? String(raw.currency_code) : "AUD",
    expected_amount_cents: raw.expected_amount_cents != null ? Number(raw.expected_amount_cents) : null,
    settled_amount_cents: raw.settled_amount_cents != null ? Number(raw.settled_amount_cents) : null,
    source: (raw.source as FiPaymentPathwaySource) ?? "staff",
    source_payment_request_id: raw.source_payment_request_id ? String(raw.source_payment_request_id) : null,
    metadata: (raw.metadata as Record<string, unknown>) ?? {},
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

const SELECT_COLUMNS =
  "id, tenant_id, patient_id, case_id, invoice_id, booking_id, pathway_type, status, provider, provider_reference, selected_at, expected_settlement_date, actual_settlement_date, currency_code, expected_amount_cents, settled_amount_cents, source, source_payment_request_id, metadata, created_at, updated_at";

export async function loadPaymentPathwaysForCase(tenantId: string, caseId: string): Promise<FinancialPaymentPathwayRecord[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payment_pathways")
    .select(SELECT_COLUMNS)
    .eq("tenant_id", tenantId.trim())
    .eq("case_id", caseId.trim())
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((x) => mapRow(x as Record<string, unknown>));
}

export async function loadPaymentPathwaysForInvoice(tenantId: string, invoiceId: string): Promise<FinancialPaymentPathwayRecord[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payment_pathways")
    .select(SELECT_COLUMNS)
    .eq("tenant_id", tenantId.trim())
    .eq("invoice_id", invoiceId.trim())
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((x) => mapRow(x as Record<string, unknown>));
}

export async function loadPaymentPathwaysForBooking(tenantId: string, bookingId: string): Promise<FinancialPaymentPathwayRecord[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payment_pathways")
    .select(SELECT_COLUMNS)
    .eq("tenant_id", tenantId.trim())
    .eq("booking_id", bookingId.trim())
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((x) => mapRow(x as Record<string, unknown>));
}

export async function loadPaymentPathwaysForTenant(tenantId: string, limit = 500): Promise<FinancialPaymentPathwayRecord[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payment_pathways")
    .select(SELECT_COLUMNS)
    .eq("tenant_id", tenantId.trim())
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((x) => mapRow(x as Record<string, unknown>));
}

export async function createPaymentPathway(args: {
  tenantId: string;
  patientId?: string | null;
  caseId?: string | null;
  invoiceId?: string | null;
  bookingId?: string | null;
  pathwayType: FiPaymentPathwayType;
  status?: FiPaymentPathwayStatus;
  provider?: string | null;
  providerReference?: string | null;
  expectedSettlementDateYmd?: string | null;
  currencyCode?: string | null;
  expectedAmountCents?: number | null;
  metadata?: Record<string, unknown>;
  source?: FiPaymentPathwaySource;
  sourcePaymentRequestId?: string | null;
}): Promise<FinancialPaymentPathwayRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payment_pathways")
    .insert({
      tenant_id: tid,
      patient_id: args.patientId?.trim() || null,
      case_id: args.caseId?.trim() || null,
      invoice_id: args.invoiceId?.trim() || null,
      booking_id: args.bookingId?.trim() || null,
      pathway_type: args.pathwayType,
      status: args.status ?? "selected",
      provider: args.provider?.trim() || null,
      provider_reference: args.providerReference?.trim() || null,
      expected_settlement_date: args.expectedSettlementDateYmd?.trim() || null,
      currency_code: args.currencyCode?.trim() || "AUD",
      expected_amount_cents: args.expectedAmountCents ?? null,
      metadata: args.metadata ?? {},
      source: args.source ?? "staff",
      source_payment_request_id: args.sourcePaymentRequestId?.trim() || null,
    })
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  const pathway = mapRow(data as Record<string, unknown>);
  try {
    await createPaymentPathwayTaskForPathway(pathway);
  } catch {
    // Task auto-creation is best-effort; pathway creation must not fail.
  }
  return pathway;
}

export async function updatePaymentPathwayStatus(args: {
  tenantId: string;
  pathwayId: string;
  status: FiPaymentPathwayStatus;
  actualSettlementDateYmd?: string | null;
  settledAmountCents?: number | null;
  providerReference?: string | null;
  metadataPatch?: Record<string, unknown>;
}): Promise<FinancialPaymentPathwayRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();

  const update: Record<string, unknown> = { status: args.status };
  if (args.actualSettlementDateYmd !== undefined) {
    update.actual_settlement_date = args.actualSettlementDateYmd?.trim() || null;
  }
  if (args.settledAmountCents !== undefined) {
    update.settled_amount_cents = args.settledAmountCents;
  }
  if (args.providerReference !== undefined) {
    update.provider_reference = args.providerReference?.trim() || null;
  }

  if (args.metadataPatch && Object.keys(args.metadataPatch).length > 0) {
    const { data: existing, error: fetchErr } = await supabase
      .from("fi_payment_pathways")
      .select("metadata")
      .eq("tenant_id", tid)
      .eq("id", args.pathwayId.trim())
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    const currentMeta = ((existing as { metadata?: Record<string, unknown> } | null)?.metadata ?? {}) as Record<string, unknown>;
    update.metadata = { ...currentMeta, ...args.metadataPatch };
  }

  const { data, error } = await supabase
    .from("fi_payment_pathways")
    .update(update)
    .eq("tenant_id", tid)
    .eq("id", args.pathwayId.trim())
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Payment pathway not found.");
  return mapRow(data as Record<string, unknown>);
}

export async function updatePaymentPathwaySelection(args: {
  tenantId: string;
  pathwayId: string;
  pathwayType: FiPaymentPathwayType;
  status: FiPaymentPathwayStatus;
  source?: FiPaymentPathwaySource;
  sourcePaymentRequestId?: string | null;
  currencyCode?: string | null;
  expectedAmountCents?: number | null;
  metadataPatch?: Record<string, unknown>;
}): Promise<FinancialPaymentPathwayRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();

  const update: Record<string, unknown> = {
    pathway_type: args.pathwayType,
    status: args.status,
    selected_at: new Date().toISOString(),
  };
  if (args.source !== undefined) update.source = args.source;
  if (args.sourcePaymentRequestId !== undefined) {
    update.source_payment_request_id = args.sourcePaymentRequestId?.trim() || null;
  }
  if (args.currencyCode !== undefined) update.currency_code = args.currencyCode?.trim() || "AUD";
  if (args.expectedAmountCents !== undefined) update.expected_amount_cents = args.expectedAmountCents;

  if (args.metadataPatch && Object.keys(args.metadataPatch).length > 0) {
    const { data: existing, error: fetchErr } = await supabase
      .from("fi_payment_pathways")
      .select("metadata")
      .eq("tenant_id", tid)
      .eq("id", args.pathwayId.trim())
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    const currentMeta = ((existing as { metadata?: Record<string, unknown> } | null)?.metadata ?? {}) as Record<string, unknown>;
    update.metadata = { ...currentMeta, ...args.metadataPatch };
  }

  const { data, error } = await supabase
    .from("fi_payment_pathways")
    .update(update)
    .eq("tenant_id", tid)
    .eq("id", args.pathwayId.trim())
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Payment pathway not found.");
  return mapRow(data as Record<string, unknown>);
}

export async function resolveActivePaymentPathwayForInvoice(
  tenantId: string,
  invoiceId: string
): Promise<FinancialPaymentPathwayRecord | null> {
  const rows = await loadPaymentPathwaysForInvoice(tenantId, invoiceId);
  return (resolveActivePaymentPathway(rows) as FinancialPaymentPathwayRecord | null) ?? null;
}

export async function resolveActivePaymentPathwayForBooking(
  tenantId: string,
  bookingId: string
): Promise<FinancialPaymentPathwayRecord | null> {
  const rows = await loadPaymentPathwaysForBooking(tenantId, bookingId);
  return (resolveActivePaymentPathway(rows) as FinancialPaymentPathwayRecord | null) ?? null;
}

export type FinancialPaymentPathwayDashboardCounts = {
  countsByType: Record<FiPaymentPathwayType, number>;
  countsByStatus: Record<FiPaymentPathwayStatus, number>;
  expectedSettlementNext30DaysCount: number;
  attentionCount: number;
  /** Phase 2B: pathways selected by patients via public payment link in the last 30 days. */
  patientSelectedLast30DaysCount: number;
};

const PATHWAY_TYPES: FiPaymentPathwayType[] = [
  "pay_in_full",
  "deposit_balance",
  "installment_plan",
  "medical_finance",
  "super_release",
  "international_transfer",
  "manual",
];

const PATHWAY_STATUSES: FiPaymentPathwayStatus[] = [
  "draft",
  "selected",
  "pending_patient_action",
  "pending_clinic_action",
  "pending_provider",
  "approved",
  "rejected",
  "settlement_pending",
  "settled",
  "cancelled",
];

/**
 * Aggregates pathway counts for the FinancialOS dashboard (Phase 2). Read-only; does not
 * touch invoices, payments, or payment requests.
 */
export async function loadFinancialPaymentPathwayDashboardCounts(tenantId: string): Promise<FinancialPaymentPathwayDashboardCounts> {
  const tid = tenantId.trim();
  const rows = await loadPaymentPathwaysForTenant(tid, 5000);

  const countsByType = Object.fromEntries(PATHWAY_TYPES.map((t) => [t, 0])) as Record<FiPaymentPathwayType, number>;
  const countsByStatus = Object.fromEntries(PATHWAY_STATUSES.map((s) => [s, 0])) as Record<FiPaymentPathwayStatus, number>;

  const today = new Date();
  const todayYmd = today.toISOString().slice(0, 10);
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + 30);
  const horizonYmd = horizon.toISOString().slice(0, 10);

  let expectedSettlementNext30DaysCount = 0;
  let attentionCount = 0;
  let patientSelectedLast30DaysCount = 0;

  const patientWindowStart = new Date(today);
  patientWindowStart.setUTCDate(patientWindowStart.getUTCDate() - 30);
  const patientWindowIso = patientWindowStart.toISOString();

  for (const row of rows) {
    if (row.source === "patient_public_token" && row.selected_at && row.selected_at >= patientWindowIso) {
      patientSelectedLast30DaysCount += 1;
    }
    countsByType[row.pathway_type] = (countsByType[row.pathway_type] ?? 0) + 1;
    countsByStatus[row.status] = (countsByStatus[row.status] ?? 0) + 1;

    if (row.expected_settlement_date && row.expected_settlement_date >= todayYmd && row.expected_settlement_date <= horizonYmd) {
      expectedSettlementNext30DaysCount += 1;
    }

    if (row.status === "rejected") {
      attentionCount += 1;
      continue;
    }
    if (row.expected_settlement_date && row.expected_settlement_date < todayYmd && row.status !== "settled" && row.status !== "cancelled") {
      attentionCount += 1;
    }
  }

  return { countsByType, countsByStatus, expectedSettlementNext30DaysCount, attentionCount, patientSelectedLast30DaysCount };
}
