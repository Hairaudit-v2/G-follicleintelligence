import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PaymentRecordRow, PaymentStatus } from "@/src/lib/payments/paymentRecordModel";
import type { CreatePaymentRecordBody } from "@/src/lib/payments/paymentRecordSchemas";

async function assertPatientInTenant(tenantId: string, patientId: string): Promise<void> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("fi_patients").select("id").eq("tenant_id", tenantId).eq("id", patientId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Patient not found for this tenant.");
}

async function assertLeadInTenant(tenantId: string, leadId: string): Promise<void> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("fi_crm_leads").select("id").eq("tenant_id", tenantId).eq("id", leadId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lead not found for this tenant.");
}

async function assertConsultationInTenant(tenantId: string, consultationId: string): Promise<void> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("fi_consultations").select("id").eq("tenant_id", tenantId).eq("id", consultationId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Consultation not found for this tenant.");
}

async function assertCaseInTenant(tenantId: string, caseId: string): Promise<void> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("fi_cases").select("id").eq("tenant_id", tenantId).eq("id", caseId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Case not found for this tenant.");
}

async function assertBookingInTenant(tenantId: string, bookingId: string): Promise<void> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("fi_bookings").select("id").eq("tenant_id", tenantId).eq("id", bookingId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Booking not found for this tenant.");
}

function mapRow(raw: Record<string, unknown>): PaymentRecordRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    payment_context: String(raw.payment_context) as PaymentRecordRow["payment_context"],
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

async function validateOptionalLinks(
  tenantId: string,
  input: Pick<
    CreatePaymentRecordBody,
    "patient_id" | "lead_id" | "consultation_id" | "case_id" | "booking_id"
  >
): Promise<void> {
  if (input.patient_id?.trim()) await assertPatientInTenant(tenantId, input.patient_id.trim());
  if (input.lead_id?.trim()) await assertLeadInTenant(tenantId, input.lead_id.trim());
  if (input.consultation_id?.trim()) await assertConsultationInTenant(tenantId, input.consultation_id.trim());
  if (input.case_id?.trim()) await assertCaseInTenant(tenantId, input.case_id.trim());
  if (input.booking_id?.trim()) await assertBookingInTenant(tenantId, input.booking_id.trim());
}

export async function createPaymentRecord(
  tenantId: string,
  input: CreatePaymentRecordBody,
  recordedByFiUserId: string | null
): Promise<PaymentRecordRow> {
  const tid = tenantId.trim();
  await validateOptionalLinks(tid, input);

  const supabase = supabaseAdmin();
  // Insert-time audit (`recorded_by` / `recorded_at`); updates must not overwrite these fields.
  const insert = {
    tenant_id: tid,
    payment_context: input.payment_context,
    patient_id: input.patient_id?.trim() || null,
    lead_id: input.lead_id?.trim() || null,
    consultation_id: input.consultation_id?.trim() || null,
    case_id: input.case_id?.trim() || null,
    booking_id: input.booking_id?.trim() || null,
    amount_expected: input.amount_expected,
    amount_paid: input.amount_paid ?? 0,
    currency: input.currency.trim().toUpperCase(),
    status: input.status,
    due_date: input.due_date?.trim() || null,
    notes: input.notes?.trim() || null,
    recorded_by: recordedByFiUserId?.trim() || null,
    recorded_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("fi_payment_records").insert(insert).select("*").single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

/**
 * Status / notes patch only. Does **not** change `recorded_by` or `recorded_at` (insert-time audit).
 */
export async function updatePaymentRecordStatus(
  tenantId: string,
  paymentRecordId: string,
  status: PaymentStatus,
  notes: string | null | undefined
): Promise<PaymentRecordRow> {
  const tid = tenantId.trim();
  const id = paymentRecordId.trim();
  const supabase = supabaseAdmin();

  const { data: existing, error: le } = await supabase.from("fi_payment_records").select("id").eq("tenant_id", tid).eq("id", id).maybeSingle();
  if (le) throw new Error(le.message);
  if (!existing) throw new Error("Payment record not found for this tenant.");

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (notes !== undefined) patch.notes = notes?.trim() || null;

  const { data, error } = await supabase.from("fi_payment_records").update(patch).eq("tenant_id", tid).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

/**
 * Increments `amount_paid` and derives status. Does **not** change `recorded_by` or `recorded_at` (insert-time audit).
 */
export async function recordManualPayment(
  tenantId: string,
  paymentRecordId: string,
  paymentAmount: number,
  notes: string | null | undefined
): Promise<PaymentRecordRow> {
  const tid = tenantId.trim();
  const id = paymentRecordId.trim();
  const supabase = supabaseAdmin();

  const { data: row, error: le } = await supabase
    .from("fi_payment_records")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", id)
    .maybeSingle();
  if (le) throw new Error(le.message);
  if (!row) throw new Error("Payment record not found for this tenant.");

  const cur = row as {
    amount_paid: string | number;
    amount_expected: string | number;
    status: string;
    notes: string | null;
  };
  const prevPaid = Number(cur.amount_paid);
  const expected = Number(cur.amount_expected);
  const nextPaid = prevPaid + paymentAmount;
  let nextStatus: PaymentStatus = cur.status as PaymentStatus;
  if (nextPaid >= expected && expected > 0) {
    nextStatus = "paid";
  } else if (nextPaid > 0 && nextPaid < expected) {
    nextStatus = "partially_paid";
  }

  let mergedNotes: string | null = cur.notes;
  if (notes?.trim()) {
    mergedNotes = [cur.notes?.trim(), notes.trim()].filter(Boolean).join("\n---\n");
  }

  const { data, error } = await supabase
    .from("fi_payment_records")
    .update({
      amount_paid: nextPaid,
      status: nextStatus,
      notes: mergedNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tid)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}
