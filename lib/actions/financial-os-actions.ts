"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";

import { assertPaymentRecordWriteAllowed } from "@/src/lib/payments/paymentRecordAccess.server";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";
import { startConsultationQuoteDepositPaymentRequest, setBookingFinancialOsStatus } from "@/src/lib/financialOs/financialDepositWorkflow.server";
import { createInstallmentPlanForInvoice } from "@/src/lib/financialOs/financialInstallmentPlans.server";

const optionalAdminKey = z.object({ adminKey: z.string().optional() });

const depositQuoteSchema = optionalAdminKey.extend({
  invoice_id: z.string().uuid(),
  deposit_amount_cents: z.number().int().positive(),
  send_checkout: z.boolean().optional(),
});

const installmentSchema = optionalAdminKey.extend({
  invoice_id: z.string().uuid(),
  frequency: z.enum(["weekly", "biweekly", "monthly"]),
  installment_amount_cents: z.number().int().positive(),
  next_payment_date_ymd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

const bookingStatusSchema = optionalAdminKey.extend({
  booking_id: z.string().uuid(),
  status: z.enum(["tentative", "deposit_pending", "confirmed", "paid_in_full"]),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof StaffPinMutationBlockedError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateFinancialPaths(tenantId: string) {
  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}/financial`;
  revalidatePath(base);
  revalidatePath(`${base}/dashboard`);
  revalidatePath(`${base}/invoices`);
  revalidatePath(`${base}/payments`);
  revalidatePath(`${base}/payment-requests`);
  revalidatePath(`${base}/installments`);
  revalidatePath(`/fi-admin/${tid}/payments`);
}

export async function startConsultationQuoteDepositPaymentRequestAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; payment_request_id: string; booking_id: string | null } | { ok: false; error: string }> {
  try {
    const parsed = depositQuoteSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const out = await startConsultationQuoteDepositPaymentRequest({
      tenantId: tenantId.trim(),
      invoiceId: parsed.invoice_id,
      depositAmountCents: parsed.deposit_amount_cents,
      sendCheckout: parsed.send_checkout === true,
    });
    revalidateFinancialPaths(tenantId);
    return { ok: true, payment_request_id: out.paymentRequestId, booking_id: out.bookingId };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createInstallmentPlanAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; plan_id: string } | { ok: false; error: string }> {
  try {
    const parsed = installmentSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const plan = await createInstallmentPlanForInvoice({
      tenantId: tenantId.trim(),
      invoiceId: parsed.invoice_id,
      frequency: parsed.frequency,
      installmentAmountCents: parsed.installment_amount_cents,
      nextPaymentDateYmd: parsed.next_payment_date_ymd ?? null,
    });
    revalidateFinancialPaths(tenantId);
    return { ok: true, plan_id: plan.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function setBookingFinancialOsStatusAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = bookingStatusSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await setBookingFinancialOsStatus({
      tenantId: tenantId.trim(),
      bookingId: parsed.booking_id,
      status: parsed.status,
    });
    revalidateFinancialPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
