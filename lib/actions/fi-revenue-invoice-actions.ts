"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";

import {
  PaymentRecordAccessError,
  assertPaymentRecordWriteAllowed,
} from "@/src/lib/payments/paymentRecordAccess.server";
import { resolveFiOsPublicOrigin } from "@/src/lib/fiOs/fiOsPublicOrigin.server";
import {
  cancelInvoice,
  createBalanceInvoiceFromSurgeryCase,
  createDepositInvoiceFromSurgeryCase,
  createInvoiceFromConsultationQuote,
  createPaymentRequestForInvoice,
  markInvoiceManuallyPaid,
  resendOpenPaymentRequest,
  updateInvoiceDueDateForTenant,
} from "@/src/lib/revenueOs/revenueInvoiceMutations.server";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";

const optionalAdminKey = z.object({ adminKey: z.string().optional() });

const createFromQuoteSchema = optionalAdminKey.extend({
  consultation_id: z.string().uuid(),
  amount_cents: z.number().int().positive().optional(),
  tax_cents: z.number().int().nonnegative().optional(),
  due_date_ymd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

const depositCaseSchema = optionalAdminKey.extend({
  case_id: z.string().uuid(),
  deposit_amount_cents: z.number().int().nonnegative().optional().nullable(),
  procedure_fee_estimate_cents: z.number().int().positive().optional().nullable(),
  tax_cents: z.number().int().nonnegative().optional(),
  due_date_ymd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

const balanceCaseSchema = optionalAdminKey.extend({
  case_id: z.string().uuid(),
  balance_amount_cents: z.number().int().positive(),
  tax_cents: z.number().int().nonnegative().optional(),
  due_date_ymd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

const paymentRequestSchema = optionalAdminKey.extend({
  invoice_id: z.string().uuid(),
  amount_cents: z.number().int().positive(),
  tax_cents: z.number().int().nonnegative().optional(),
  send: z.boolean().optional(),
  staff_note: z.string().max(4000).optional().nullable(),
  expires_at_iso: z.string().min(8).max(64).optional().nullable(),
});

const updateInvoiceDueDateSchema = optionalAdminKey.extend({
  invoice_id: z.string().uuid(),
  due_date_ymd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

const resendPaymentRequestSchema = optionalAdminKey.extend({
  payment_request_id: z.string().uuid(),
});

const invoiceIdSchema = optionalAdminKey.extend({
  invoice_id: z.string().uuid(),
  notes: z.string().optional().nullable(),
  today_ymd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const cancelSchema = optionalAdminKey.extend({
  invoice_id: z.string().uuid(),
  reason: z.string().optional().nullable(),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof PaymentRecordAccessError) return e.message;
  if (e instanceof StaffPinMutationBlockedError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateRevenuePaths(
  tenantId: string,
  hints?: { patientId?: string | null; caseId?: string | null; consultationId?: string | null }
) {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}`);
  revalidatePath(`/fi-admin/${tid}/settings/payments`);
  revalidatePath(`/fi-admin/${tid}/payments`);
  if (hints?.patientId?.trim())
    revalidatePath(`/fi-admin/${tid}/patients/${encodeURIComponent(hints.patientId.trim())}`);
  if (hints?.caseId?.trim())
    revalidatePath(`/fi-admin/${tid}/cases/${encodeURIComponent(hints.caseId.trim())}`);
  if (hints?.consultationId?.trim()) {
    revalidatePath(
      `/fi-admin/${tid}/consultations/${encodeURIComponent(hints.consultationId.trim())}`
    );
  }
}

export async function createInvoiceFromConsultationQuoteAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; invoice_id: string } | { ok: false; error: string }> {
  try {
    const parsed = createFromQuoteSchema.parse(body);
    const { actorFiUserId } = await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const inv = await createInvoiceFromConsultationQuote({
      tenantId: tenantId.trim(),
      consultationId: parsed.consultation_id,
      createdByFiUserId: actorFiUserId,
      amountCentsOverride: parsed.amount_cents ?? null,
      taxCents: parsed.tax_cents,
      dueDateYmd: parsed.due_date_ymd ?? null,
      issue: true,
    });
    revalidateRevenuePaths(tenantId, {
      patientId: inv.patient_id,
      consultationId: inv.consultation_id,
      caseId: inv.case_id,
    });
    return { ok: true, invoice_id: inv.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createDepositInvoiceFromSurgeryCaseAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; invoice_id: string } | { ok: false; error: string }> {
  try {
    const parsed = depositCaseSchema.parse(body);
    const { actorFiUserId } = await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const inv = await createDepositInvoiceFromSurgeryCase({
      tenantId: tenantId.trim(),
      caseId: parsed.case_id,
      createdByFiUserId: actorFiUserId,
      depositAmountCents: parsed.deposit_amount_cents ?? null,
      procedureFeeEstimateCents: parsed.procedure_fee_estimate_cents ?? null,
      taxCents: parsed.tax_cents,
      dueDateYmd: parsed.due_date_ymd ?? null,
    });
    revalidateRevenuePaths(tenantId, { patientId: inv.patient_id, caseId: inv.case_id });
    return { ok: true, invoice_id: inv.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createBalanceInvoiceFromSurgeryCaseAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; invoice_id: string } | { ok: false; error: string }> {
  try {
    const parsed = balanceCaseSchema.parse(body);
    const { actorFiUserId } = await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const inv = await createBalanceInvoiceFromSurgeryCase({
      tenantId: tenantId.trim(),
      caseId: parsed.case_id,
      balanceAmountCents: parsed.balance_amount_cents,
      createdByFiUserId: actorFiUserId,
      taxCents: parsed.tax_cents,
      dueDateYmd: parsed.due_date_ymd ?? null,
    });
    revalidateRevenuePaths(tenantId, { patientId: inv.patient_id, caseId: inv.case_id });
    return { ok: true, invoice_id: inv.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createPaymentRequestAction(
  tenantId: string,
  body: unknown
): Promise<
  | {
      ok: true;
      payment_request_id: string;
      checkout_url: string | null;
      public_token: string;
      pay_page_url: string;
    }
  | { ok: false; error: string }
> {
  try {
    const parsed = paymentRequestSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const row = await createPaymentRequestForInvoice({
      tenantId: tenantId.trim(),
      invoiceId: parsed.invoice_id,
      amountCents: parsed.amount_cents,
      taxCents: parsed.tax_cents,
      send: parsed.send === true,
      staffNote: parsed.staff_note ?? null,
      expiresAtIso: parsed.expires_at_iso ?? null,
    });
    revalidateRevenuePaths(tenantId);
    const origin = (await resolveFiOsPublicOrigin()).replace(/\/+$/, "");
    const pay_page_url = `${origin}/pay/${encodeURIComponent(row.public_token)}`;
    return {
      ok: true,
      payment_request_id: row.id,
      checkout_url: row.checkout_url,
      public_token: row.public_token,
      pay_page_url,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateInvoiceDueDateAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = updateInvoiceDueDateSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await updateInvoiceDueDateForTenant({
      tenantId: tenantId.trim(),
      invoiceId: parsed.invoice_id,
      dueDateYmd: parsed.due_date_ymd,
    });
    revalidateRevenuePaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function resendPaymentRequestAction(
  tenantId: string,
  body: unknown
): Promise<
  | {
      ok: true;
      payment_request_id: string;
      checkout_url: string | null;
      public_token: string;
      pay_page_url: string;
    }
  | { ok: false; error: string }
> {
  try {
    const parsed = resendPaymentRequestSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const row = await resendOpenPaymentRequest({
      tenantId: tenantId.trim(),
      paymentRequestId: parsed.payment_request_id,
    });
    revalidateRevenuePaths(tenantId);
    const origin = (await resolveFiOsPublicOrigin()).replace(/\/+$/, "");
    const pay_page_url = `${origin}/pay/${encodeURIComponent(row.public_token)}`;
    return {
      ok: true,
      payment_request_id: row.id,
      checkout_url: row.checkout_url,
      public_token: row.public_token,
      pay_page_url,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function markInvoiceManuallyPaidAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = invoiceIdSchema.parse(body);
    const { actorFiUserId } = await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const inv = await markInvoiceManuallyPaid({
      tenantId: tenantId.trim(),
      invoiceId: parsed.invoice_id,
      recordedByFiUserId: actorFiUserId,
      notes: parsed.notes,
      todayYmd: parsed.today_ymd ?? null,
    });
    revalidateRevenuePaths(tenantId, {
      patientId: inv.patient_id,
      caseId: inv.case_id,
      consultationId: inv.consultation_id,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function cancelInvoiceAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = cancelSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const inv = await cancelInvoice({
      tenantId: tenantId.trim(),
      invoiceId: parsed.invoice_id,
      reason: parsed.reason,
    });
    revalidateRevenuePaths(tenantId, {
      patientId: inv.patient_id,
      caseId: inv.case_id,
      consultationId: inv.consultation_id,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
