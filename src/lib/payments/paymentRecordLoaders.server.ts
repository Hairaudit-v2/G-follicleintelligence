import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type {
  PaymentContext,
  PaymentRecordRow,
  PaymentStatus,
} from "@/src/lib/payments/paymentRecordModel";
import { summarizePaymentRecordsForOperations } from "@/src/lib/payments/paymentRecordModel";

function mapRow(raw: Record<string, unknown>): PaymentRecordRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    payment_context: String(raw.payment_context) as PaymentContext,
    patient_id: raw.patient_id != null ? String(raw.patient_id) : null,
    lead_id: raw.lead_id != null ? String(raw.lead_id) : null,
    consultation_id: raw.consultation_id != null ? String(raw.consultation_id) : null,
    case_id: raw.case_id != null ? String(raw.case_id) : null,
    booking_id: raw.booking_id != null ? String(raw.booking_id) : null,
    amount_expected: Number(raw.amount_expected ?? 0),
    amount_paid: Number(raw.amount_paid ?? 0),
    currency: String(raw.currency ?? "AUD"),
    status: String(raw.status) as PaymentStatus,
    due_date: raw.due_date != null ? String(raw.due_date).slice(0, 10) : null,
    notes: raw.notes != null ? String(raw.notes) : null,
    recorded_by: raw.recorded_by != null ? String(raw.recorded_by) : null,
    recorded_at: String(raw.recorded_at ?? ""),
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  const s = new Set<string>();
  for (const id of ids) {
    if (id?.trim()) s.add(id.trim());
  }
  return Array.from(s);
}

/**
 * Latest payment row per consultation (consultation context), by `updated_at`.
 */
export async function loadPaymentRecordsForConsultations(
  tenantId: string,
  consultationIds: string[]
): Promise<Map<string, PaymentRecordRow>> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const ids = uniqueIds(consultationIds);
  const out = new Map<string, PaymentRecordRow>();
  if (!ids.length) return out;

  const supabase = supabaseAdmin();
  for (const part of chunk(ids, 60)) {
    const { data, error } = await supabase
      .from("fi_payment_records")
      .select("*")
      .eq("tenant_id", tid)
      .eq("payment_context", "consultation")
      .in("consultation_id", part)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    for (const raw of data ?? []) {
      const row = mapRow(raw as Record<string, unknown>);
      const cid = row.consultation_id?.trim();
      if (cid && !out.has(cid)) out.set(cid, row);
    }
  }
  return out;
}

/**
 * Surgery-context rows keyed by `booking_id` (preferred) or `case_id` when no booking match.
 */
export async function loadPaymentRecordsForSurgeryBoard(
  tenantId: string,
  bookingIds: string[],
  caseIds: string[]
): Promise<{
  byBookingId: Map<string, PaymentRecordRow>;
  byCaseId: Map<string, PaymentRecordRow>;
}> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const bids = uniqueIds(bookingIds);
  const cids = uniqueIds(caseIds);
  const byBookingId = new Map<string, PaymentRecordRow>();
  const byCaseId = new Map<string, PaymentRecordRow>();

  if (!bids.length && !cids.length) return { byBookingId, byCaseId };

  const supabase = supabaseAdmin();

  const mergeBooking = (row: PaymentRecordRow) => {
    const b = row.booking_id?.trim();
    if (!b) return;
    const prev = byBookingId.get(b);
    if (!prev || row.updated_at > prev.updated_at) byBookingId.set(b, row);
  };
  const mergeCase = (row: PaymentRecordRow) => {
    const c = row.case_id?.trim();
    if (!c) return;
    const prev = byCaseId.get(c);
    if (!prev || row.updated_at > prev.updated_at) byCaseId.set(c, row);
  };

  for (const part of chunk(bids, 80)) {
    const { data, error } = await supabase
      .from("fi_payment_records")
      .select("*")
      .eq("tenant_id", tid)
      .eq("payment_context", "surgery")
      .in("booking_id", part);
    if (error) throw new Error(error.message);
    for (const raw of data ?? []) {
      mergeBooking(mapRow(raw as Record<string, unknown>));
    }
  }

  for (const part of chunk(cids, 80)) {
    const { data, error } = await supabase
      .from("fi_payment_records")
      .select("*")
      .eq("tenant_id", tid)
      .eq("payment_context", "surgery")
      .in("case_id", part);
    if (error) throw new Error(error.message);
    for (const raw of data ?? []) {
      const row = mapRow(raw as Record<string, unknown>);
      mergeCase(row);
      mergeBooking(row);
    }
  }

  return { byBookingId, byCaseId };
}

/**
 * Latest payment row per `booking_id` (any `payment_context`), by `updated_at` descending.
 * Used for cross-board badges where a manual record exists on the appointment.
 */
export async function loadLatestPaymentRecordsByBookingIds(
  tenantId: string,
  bookingIds: string[]
): Promise<Map<string, PaymentRecordRow>> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const bids = uniqueIds(bookingIds);
  const out = new Map<string, PaymentRecordRow>();
  if (!bids.length) return out;

  const supabase = supabaseAdmin();
  for (const part of chunk(bids, 80)) {
    const { data, error } = await supabase
      .from("fi_payment_records")
      .select("*")
      .eq("tenant_id", tid)
      .in("booking_id", part)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    for (const raw of data ?? []) {
      const row = mapRow(raw as Record<string, unknown>);
      const b = row.booking_id?.trim();
      if (!b || out.has(b)) continue;
      out.set(b, row);
    }
  }
  return out;
}

export async function loadPaymentRecordsForCases(
  tenantId: string,
  caseIds: string[],
  contexts?: PaymentContext[]
): Promise<Map<string, PaymentRecordRow[]>> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const ids = uniqueIds(caseIds);
  const out = new Map<string, PaymentRecordRow[]>();
  if (!ids.length) return out;

  const supabase = supabaseAdmin();
  const ctxFilter = contexts?.length ? contexts : null;

  for (const part of chunk(ids, 80)) {
    let q = supabase
      .from("fi_payment_records")
      .select("*")
      .eq("tenant_id", tid)
      .in("case_id", part);
    if (ctxFilter) q = q.in("payment_context", ctxFilter);
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    for (const raw of data ?? []) {
      const row = mapRow(raw as Record<string, unknown>);
      const cid = row.case_id?.trim();
      if (!cid) continue;
      const list = out.get(cid) ?? [];
      list.push(row);
      out.set(cid, list);
    }
  }
  return out;
}

export async function loadPaymentRecordsForConsultationId(
  tenantId: string,
  consultationId: string
): Promise<PaymentRecordRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const cid = assertNonEmptyUuid(consultationId, "consultationId").trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payment_records")
    .select("*")
    .eq("tenant_id", tid)
    .eq("consultation_id", cid)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function loadPaymentRecordsForPatientId(
  tenantId: string,
  patientId: string
): Promise<PaymentRecordRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const pid = assertNonEmptyUuid(patientId, "patientId").trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payment_records")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

/**
 * Commercial-style counts for the operations centre (service-role read).
 */
export async function loadPaymentSummaryForOperations(
  tenantId: string,
  todayYmd: string,
  operationalLocalStartIso: string,
  operationalLocalEndIso: string
): Promise<ReturnType<typeof summarizePaymentRecordsForOperations>> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_payment_records")
    .select("status, due_date, amount_expected, amount_paid, updated_at")
    .eq("tenant_id", tid)
    .limit(5000);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Pick<
    PaymentRecordRow,
    "status" | "due_date" | "amount_expected" | "amount_paid" | "updated_at"
  >[];
  return summarizePaymentRecordsForOperations(
    rows,
    todayYmd,
    operationalLocalStartIso,
    operationalLocalEndIso
  );
}
