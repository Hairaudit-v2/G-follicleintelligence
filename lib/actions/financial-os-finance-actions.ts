"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";

import { assertPaymentRecordWriteAllowed } from "@/src/lib/payments/paymentRecordAccess.server";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";
import {
  addFinanceApplicationDocument,
  createFinanceApplication,
  resolveFinanceApplicationAttention,
  updateFinanceApplicationDocument,
  updateFinanceApplicationStatus,
} from "@/src/lib/financialOs/financialFinanceApplications.server";
import {
  createFinanceProvider,
  updateFinanceProvider,
} from "@/src/lib/financialOs/financialFinanceProviders.server";

const optionalAdminKey = z.object({ adminKey: z.string().optional() });

const PROVIDER_TYPES = ["medical_financing", "bnpl", "super_release", "international_financing", "custom"] as const;

const APPLICATION_STATUSES = [
  "draft",
  "documents_pending",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "settlement_pending",
  "settled",
  "cancelled",
] as const;

const DOCUMENT_TYPES = [
  "id_verification",
  "bank_statement",
  "medical_letter",
  "super_release_form",
  "income_verification",
  "consent_form",
  "custom",
] as const;

const DOCUMENT_STATUSES = ["pending", "requested", "received", "verified", "rejected"] as const;

const createProviderSchema = optionalAdminKey.extend({
  name: z.string().min(1).max(200),
  provider_type: z.enum(PROVIDER_TYPES),
  country_code: z.string().max(8).optional().nullable(),
  is_active: z.boolean().optional(),
});

const updateProviderSchema = optionalAdminKey.extend({
  provider_id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  provider_type: z.enum(PROVIDER_TYPES).optional(),
  country_code: z.string().max(8).optional().nullable(),
  is_active: z.boolean().optional(),
});

const createApplicationSchema = optionalAdminKey.extend({
  payment_pathway_id: z.string().uuid(),
  finance_provider_id: z.string().uuid(),
  patient_id: z.string().uuid().optional().nullable(),
  case_id: z.string().uuid().optional().nullable(),
  booking_id: z.string().uuid().optional().nullable(),
  requested_amount_cents: z.number().int().nonnegative().optional().nullable(),
  application_reference: z.string().max(200).optional().nullable(),
});

const updateApplicationStatusSchema = optionalAdminKey.extend({
  application_id: z.string().uuid(),
  status: z.enum(APPLICATION_STATUSES),
  approved_amount_cents: z.number().int().nonnegative().optional().nullable(),
  expected_settlement_date: z.string().optional().nullable(),
  application_reference: z.string().max(200).optional().nullable(),
});

const addDocumentSchema = optionalAdminKey.extend({
  application_id: z.string().uuid(),
  document_type: z.enum(DOCUMENT_TYPES),
  status: z.enum(DOCUMENT_STATUSES).optional(),
  file_url: z.string().max(2000).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

const updateDocumentSchema = optionalAdminKey.extend({
  document_id: z.string().uuid(),
  status: z.enum(DOCUMENT_STATUSES).optional(),
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

function revalidateFinancePaths(tenantId: string) {
  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}/financial`;
  revalidatePath(base);
  revalidatePath(`${base}/dashboard`);
  revalidatePath(`${base}/providers`);
  revalidatePath(`${base}/finance-applications`);
  revalidatePath(`${base}/payment-pathways`);
  revalidatePath(`/fi-admin/${tid}/operations`);
  revalidatePath(`/fi-admin/${tid}/cases`);
}

export async function createFinanceProviderAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = createProviderSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await createFinanceProvider({
      tenantId: tenantId.trim(),
      name: parsed.name,
      providerType: parsed.provider_type,
      countryCode: parsed.country_code,
      isActive: parsed.is_active,
    });
    revalidateFinancePaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateFinanceProviderAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = updateProviderSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await updateFinanceProvider({
      tenantId: tenantId.trim(),
      providerId: parsed.provider_id,
      name: parsed.name,
      providerType: parsed.provider_type,
      countryCode: parsed.country_code,
      isActive: parsed.is_active,
    });
    revalidateFinancePaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createFinanceApplicationAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = createApplicationSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await createFinanceApplication({
      tenantId: tenantId.trim(),
      paymentPathwayId: parsed.payment_pathway_id,
      financeProviderId: parsed.finance_provider_id,
      patientId: parsed.patient_id,
      caseId: parsed.case_id,
      bookingId: parsed.booking_id,
      requestedAmountCents: parsed.requested_amount_cents,
      applicationReference: parsed.application_reference,
    });
    revalidateFinancePaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateFinanceApplicationStatusAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = updateApplicationStatusSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await updateFinanceApplicationStatus({
      tenantId: tenantId.trim(),
      applicationId: parsed.application_id,
      status: parsed.status,
      approvedAmountCents: parsed.approved_amount_cents,
      expectedSettlementDate: parsed.expected_settlement_date,
      applicationReference: parsed.application_reference,
    });
    revalidateFinancePaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function addFinanceApplicationDocumentAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = addDocumentSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await addFinanceApplicationDocument({
      tenantId: tenantId.trim(),
      applicationId: parsed.application_id,
      documentType: parsed.document_type,
      status: parsed.status,
      fileUrl: parsed.file_url,
      notes: parsed.notes,
    });
    revalidateFinancePaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateFinanceApplicationDocumentAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = updateDocumentSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await updateFinanceApplicationDocument({
      tenantId: tenantId.trim(),
      documentId: parsed.document_id,
      status: parsed.status,
      fileUrl: parsed.file_url,
      notes: parsed.notes,
    });
    revalidateFinancePaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function resolveFinanceApplicationAttentionAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = resolveApplicationSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await resolveFinanceApplicationAttention(tenantId.trim(), parsed.application_id);
    revalidateFinancePaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
