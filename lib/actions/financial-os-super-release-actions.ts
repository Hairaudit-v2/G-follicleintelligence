"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";

import { assertPaymentRecordWriteAllowed } from "@/src/lib/payments/paymentRecordAccess.server";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";
import {
  addSuperReleaseDocument,
  createClinicalLetterRecord,
  createSuperReleaseApplication,
  resolveSuperReleaseAttention,
  updateClinicalLetterStatus,
  updateSuperReleaseDocument,
  updateSuperReleaseStatus,
} from "@/src/lib/financialOs/financialSuperRelease.server";

const optionalAdminKey = z.object({ adminKey: z.string().optional() });

const APPLICATION_STATUSES = [
  "draft",
  "eligibility_review",
  "documents_pending",
  "clinical_letter_required",
  "ready_for_submission",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "release_pending",
  "funds_released",
  "cancelled",
] as const;

const DOCUMENT_TYPES = [
  "identity_document",
  "medical_letter",
  "financial_hardship_statement",
  "super_release_form",
  "consent_form",
  "bank_details",
  "custom",
] as const;

const DOCUMENT_STATUSES = ["pending", "requested", "received", "verified", "rejected"] as const;

const LETTER_STATUSES = ["draft", "review_required", "approved", "issued"] as const;

const createApplicationSchema = optionalAdminKey.extend({
  payment_pathway_id: z.string().uuid(),
  patient_id: z.string().uuid().optional().nullable(),
  case_id: z.string().uuid().optional().nullable(),
  booking_id: z.string().uuid().optional().nullable(),
  provider_name: z.string().max(200).optional().nullable(),
  requested_amount_cents: z.number().int().nonnegative().optional().nullable(),
});

const updateApplicationStatusSchema = optionalAdminKey.extend({
  application_id: z.string().uuid(),
  status: z.enum(APPLICATION_STATUSES),
  approved_amount_cents: z.number().int().nonnegative().optional().nullable(),
  expected_release_date: z.string().optional().nullable(),
  provider_name: z.string().max(200).optional().nullable(),
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

const createLetterSchema = optionalAdminKey.extend({
  application_id: z.string().uuid(),
  generated_by: z.string().uuid().optional().nullable(),
  letter_status: z.enum(LETTER_STATUSES).optional(),
  file_url: z.string().max(2000).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

const updateLetterSchema = optionalAdminKey.extend({
  letter_id: z.string().uuid(),
  letter_status: z.enum(LETTER_STATUSES),
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

function revalidateSuperReleasePaths(tenantId: string) {
  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}/financial`;
  revalidatePath(base);
  revalidatePath(`${base}/dashboard`);
  revalidatePath(`${base}/super-release`);
  revalidatePath(`${base}/payment-pathways`);
  revalidatePath(`/fi-admin/${tid}/operations`);
  revalidatePath(`/fi-admin/${tid}/cases`);
}

export async function createSuperReleaseApplicationAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = createApplicationSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await createSuperReleaseApplication({
      tenantId: tenantId.trim(),
      paymentPathwayId: parsed.payment_pathway_id,
      patientId: parsed.patient_id,
      caseId: parsed.case_id,
      bookingId: parsed.booking_id,
      providerName: parsed.provider_name,
      requestedAmountCents: parsed.requested_amount_cents,
    });
    revalidateSuperReleasePaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateSuperReleaseStatusAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = updateApplicationStatusSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await updateSuperReleaseStatus({
      tenantId: tenantId.trim(),
      applicationId: parsed.application_id,
      status: parsed.status,
      approvedAmountCents: parsed.approved_amount_cents,
      expectedReleaseDate: parsed.expected_release_date,
      providerName: parsed.provider_name,
    });
    revalidateSuperReleasePaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function addSuperReleaseDocumentAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = addDocumentSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await addSuperReleaseDocument({
      tenantId: tenantId.trim(),
      applicationId: parsed.application_id,
      documentType: parsed.document_type,
      status: parsed.status,
      fileUrl: parsed.file_url,
      notes: parsed.notes,
    });
    revalidateSuperReleasePaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateSuperReleaseDocumentAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = updateDocumentSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await updateSuperReleaseDocument({
      tenantId: tenantId.trim(),
      documentId: parsed.document_id,
      status: parsed.status,
      fileUrl: parsed.file_url,
      notes: parsed.notes,
    });
    revalidateSuperReleasePaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createClinicalLetterRecordAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = createLetterSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await createClinicalLetterRecord({
      tenantId: tenantId.trim(),
      applicationId: parsed.application_id,
      generatedBy: parsed.generated_by,
      letterStatus: parsed.letter_status,
      fileUrl: parsed.file_url,
      notes: parsed.notes,
    });
    revalidateSuperReleasePaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateClinicalLetterStatusAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = updateLetterSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await updateClinicalLetterStatus({
      tenantId: tenantId.trim(),
      letterId: parsed.letter_id,
      letterStatus: parsed.letter_status,
      fileUrl: parsed.file_url,
      notes: parsed.notes,
    });
    revalidateSuperReleasePaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function resolveSuperReleaseAttentionAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = resolveApplicationSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await resolveSuperReleaseAttention(tenantId.trim(), parsed.application_id);
    revalidateSuperReleasePaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
