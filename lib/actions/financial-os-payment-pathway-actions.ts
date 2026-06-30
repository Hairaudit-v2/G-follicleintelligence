"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";

import { assertPaymentRecordWriteAllowed } from "@/src/lib/payments/paymentRecordAccess.server";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";
import {
  createPaymentPathway,
  updatePaymentPathwayStatus,
} from "@/src/lib/financialOs/financialPaymentPathways.server";

const optionalAdminKey = z.object({ adminKey: z.string().optional() });

const PATHWAY_TYPES = [
  "pay_in_full",
  "deposit_balance",
  "installment_plan",
  "medical_finance",
  "super_release",
  "international_transfer",
  "manual",
] as const;

const PATHWAY_STATUSES = [
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
] as const;

const createPathwaySchema = optionalAdminKey.extend({
  patient_id: z.string().uuid().optional().nullable(),
  case_id: z.string().uuid().optional().nullable(),
  invoice_id: z.string().uuid().optional().nullable(),
  booking_id: z.string().uuid().optional().nullable(),
  pathway_type: z.enum(PATHWAY_TYPES),
  status: z.enum(PATHWAY_STATUSES).optional(),
  provider: z.string().max(200).optional().nullable(),
  provider_reference: z.string().max(200).optional().nullable(),
  expected_settlement_date_ymd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  currency_code: z.string().max(8).optional().nullable(),
  expected_amount_cents: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const updateStatusSchema = optionalAdminKey.extend({
  pathway_id: z.string().uuid(),
  status: z.enum(PATHWAY_STATUSES),
  actual_settlement_date_ymd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  settled_amount_cents: z.number().int().nonnegative().optional().nullable(),
  provider_reference: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const cancelPathwaySchema = optionalAdminKey.extend({
  pathway_id: z.string().uuid(),
  notes: z.string().max(2000).optional().nullable(),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof StaffPinMutationBlockedError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidatePathwayPaths(tenantId: string) {
  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}/financial`;
  revalidatePath(base);
  revalidatePath(`${base}/dashboard`);
  revalidatePath(`${base}/payment-pathways`);
}

export async function createPaymentPathwayAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; pathway_id: string } | { ok: false; error: string }> {
  try {
    const parsed = createPathwaySchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const pathway = await createPaymentPathway({
      tenantId: tenantId.trim(),
      patientId: parsed.patient_id ?? null,
      caseId: parsed.case_id ?? null,
      invoiceId: parsed.invoice_id ?? null,
      bookingId: parsed.booking_id ?? null,
      pathwayType: parsed.pathway_type,
      status: parsed.status,
      provider: parsed.provider ?? null,
      providerReference: parsed.provider_reference ?? null,
      expectedSettlementDateYmd: parsed.expected_settlement_date_ymd ?? null,
      currencyCode: parsed.currency_code ?? null,
      expectedAmountCents: parsed.expected_amount_cents ?? null,
      metadata: parsed.notes?.trim() ? { notes: parsed.notes.trim() } : {},
    });
    revalidatePathwayPaths(tenantId);
    return { ok: true, pathway_id: pathway.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updatePaymentPathwayStatusAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = updateStatusSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await updatePaymentPathwayStatus({
      tenantId: tenantId.trim(),
      pathwayId: parsed.pathway_id,
      status: parsed.status,
      actualSettlementDateYmd: parsed.actual_settlement_date_ymd ?? undefined,
      settledAmountCents: parsed.settled_amount_cents ?? undefined,
      providerReference: parsed.provider_reference ?? undefined,
      metadataPatch: parsed.notes?.trim() ? { notes: parsed.notes.trim() } : undefined,
    });
    revalidatePathwayPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function cancelPaymentPathwayAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = cancelPathwaySchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await updatePaymentPathwayStatus({
      tenantId: tenantId.trim(),
      pathwayId: parsed.pathway_id,
      status: "cancelled",
      metadataPatch: parsed.notes?.trim() ? { notes: parsed.notes.trim() } : undefined,
    });
    revalidatePathwayPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
