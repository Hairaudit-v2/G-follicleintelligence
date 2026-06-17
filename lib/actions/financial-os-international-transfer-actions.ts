"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";

import { assertPaymentRecordWriteAllowed } from "@/src/lib/payments/paymentRecordAccess.server";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";
import {
  addInternationalTransferProof,
  createInternationalTransferApplication,
  resolveInternationalTransferAttention,
  updateInternationalTransferProof,
  updateInternationalTransferSettlement,
  updateInternationalTransferStatus,
} from "@/src/lib/financialOs/financialInternationalTransfer.server";

const optionalAdminKey = z.object({ adminKey: z.string().optional() });

const TRANSFER_METHODS = ["bank_transfer", "wise", "swift", "paypal", "other"] as const;

const TRANSFER_STATUSES = [
  "instructions_required",
  "instructions_sent",
  "awaiting_transfer",
  "proof_received",
  "under_reconciliation",
  "settlement_pending",
  "partially_settled",
  "settled",
  "variance_review",
  "rejected",
  "cancelled",
] as const;

const PROOF_TYPES = ["payment_receipt", "bank_confirmation", "wise_receipt", "swift_confirmation", "custom"] as const;

const PROOF_STATUSES = ["pending", "requested", "received", "verified", "rejected"] as const;

const createApplicationSchema = optionalAdminKey.extend({
  payment_pathway_id: z.string().uuid(),
  patient_id: z.string().uuid().optional().nullable(),
  case_id: z.string().uuid().optional().nullable(),
  booking_id: z.string().uuid().optional().nullable(),
  transfer_method: z.enum(TRANSFER_METHODS).optional(),
  source_country_code: z.string().max(3).optional().nullable(),
  source_currency_code: z.string().max(3).optional().nullable(),
  settlement_currency_code: z.string().max(3).optional(),
  expected_amount_cents: z.number().int().nonnegative().optional().nullable(),
  expected_settlement_amount_cents: z.number().int().nonnegative().optional().nullable(),
  expected_settlement_date: z.string().optional().nullable(),
  payment_reference: z.string().max(200).optional().nullable(),
  transfer_instructions: z.string().max(8000).optional().nullable(),
});

const updateStatusSchema = optionalAdminKey.extend({
  application_id: z.string().uuid(),
  status: z.enum(TRANSFER_STATUSES),
  transfer_instructions: z.string().max(8000).optional().nullable(),
  payment_reference: z.string().max(200).optional().nullable(),
});

const updateSettlementSchema = optionalAdminKey.extend({
  application_id: z.string().uuid(),
  status: z.enum(TRANSFER_STATUSES).optional(),
  received_amount_cents: z.number().int().nonnegative().optional().nullable(),
  expected_settlement_amount_cents: z.number().int().nonnegative().optional().nullable(),
  expected_exchange_rate: z.number().nonnegative().optional().nullable(),
  actual_exchange_rate: z.number().nonnegative().optional().nullable(),
  fx_fee_cents: z.number().int().nonnegative().optional().nullable(),
  expected_settlement_date: z.string().optional().nullable(),
  actual_settlement_date: z.string().optional().nullable(),
  source_country_code: z.string().max(3).optional().nullable(),
  source_currency_code: z.string().max(3).optional().nullable(),
  settlement_currency_code: z.string().max(3).optional().nullable(),
});

const addProofSchema = optionalAdminKey.extend({
  application_id: z.string().uuid(),
  proof_type: z.enum(PROOF_TYPES),
  status: z.enum(PROOF_STATUSES).optional(),
  file_url: z.string().max(2000).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

const updateProofSchema = optionalAdminKey.extend({
  proof_id: z.string().uuid(),
  status: z.enum(PROOF_STATUSES).optional(),
  file_url: z.string().max(2000).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

const resolveApplicationSchema = optionalAdminKey.extend({
  application_id: z.string().uuid(),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof StaffPinMutationBlockedError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateInternationalTransferPaths(tenantId: string) {
  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}/financial`;
  revalidatePath(base);
  revalidatePath(`${base}/dashboard`);
  revalidatePath(`${base}/international-transfers`);
  revalidatePath(`${base}/payment-pathways`);
  revalidatePath(`/fi-admin/${tid}/operations`);
  revalidatePath(`/fi-admin/${tid}/cases`);
}

export async function createInternationalTransferApplicationAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = createApplicationSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await createInternationalTransferApplication({
      tenantId: tenantId.trim(),
      paymentPathwayId: parsed.payment_pathway_id,
      patientId: parsed.patient_id,
      caseId: parsed.case_id,
      bookingId: parsed.booking_id,
      transferMethod: parsed.transfer_method,
      sourceCountryCode: parsed.source_country_code,
      sourceCurrencyCode: parsed.source_currency_code,
      settlementCurrencyCode: parsed.settlement_currency_code,
      expectedAmountCents: parsed.expected_amount_cents,
      expectedSettlementAmountCents: parsed.expected_settlement_amount_cents,
      expectedSettlementDate: parsed.expected_settlement_date,
      paymentReference: parsed.payment_reference,
      transferInstructions: parsed.transfer_instructions,
    });
    revalidateInternationalTransferPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateInternationalTransferStatusAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = updateStatusSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await updateInternationalTransferStatus({
      tenantId: tenantId.trim(),
      applicationId: parsed.application_id,
      status: parsed.status,
      transferInstructions: parsed.transfer_instructions,
      paymentReference: parsed.payment_reference,
    });
    revalidateInternationalTransferPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateInternationalTransferSettlementAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = updateSettlementSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await updateInternationalTransferSettlement({
      tenantId: tenantId.trim(),
      applicationId: parsed.application_id,
      status: parsed.status,
      receivedAmountCents: parsed.received_amount_cents,
      expectedSettlementAmountCents: parsed.expected_settlement_amount_cents,
      expectedExchangeRate: parsed.expected_exchange_rate,
      actualExchangeRate: parsed.actual_exchange_rate,
      fxFeeCents: parsed.fx_fee_cents,
      expectedSettlementDate: parsed.expected_settlement_date,
      actualSettlementDate: parsed.actual_settlement_date,
      sourceCountryCode: parsed.source_country_code,
      sourceCurrencyCode: parsed.source_currency_code,
      settlementCurrencyCode: parsed.settlement_currency_code,
    });
    revalidateInternationalTransferPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function addInternationalTransferProofAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = addProofSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await addInternationalTransferProof({
      tenantId: tenantId.trim(),
      applicationId: parsed.application_id,
      proofType: parsed.proof_type,
      status: parsed.status,
      fileUrl: parsed.file_url,
      notes: parsed.notes,
    });
    revalidateInternationalTransferPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateInternationalTransferProofAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = updateProofSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await updateInternationalTransferProof({
      tenantId: tenantId.trim(),
      proofId: parsed.proof_id,
      status: parsed.status,
      fileUrl: parsed.file_url,
      notes: parsed.notes,
    });
    revalidateInternationalTransferPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function resolveInternationalTransferAttentionAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = resolveApplicationSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await resolveInternationalTransferAttention(tenantId.trim(), parsed.application_id);
    revalidateInternationalTransferPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
