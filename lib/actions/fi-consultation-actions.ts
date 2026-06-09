"use server";

import { revalidatePath } from "next/cache";
import { assertCrmTenantWriteAllowed, CrmAccessError, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import { completeConsultationDraft, createConsultationDraft, createConsultationFromBooking, updateConsultationDraft } from "@/src/lib/consultations/consultationMutations.server";
import {
  consultationCompleteBodySchema,
  consultationCreateDraftBodySchema,
  consultationUpsertBodySchema,
} from "@/src/lib/consultations/consultationTypes";
import { ZodError } from "zod";

/**
 * ConsultationOS mutations currently use **`assertCrmTenantWriteAllowed`** (same gate as cases / CRM operator flows).
 * Optional `FI_ADMIN_API_KEY` still works via that helper. Narrower “clinical-only” role is deferred.
 */
function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

export async function createConsultationDraftAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; consultationId: string } | { ok: false; error: string }> {
  try {
    const parsed = consultationCreateDraftBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    const fiUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    const row = await createConsultationDraft(tenantId, {
      consultation_type: parsed.consultation_type,
      adminKey: parsed.adminKey,
      createdByFiUserId: fiUserId,
      patient_id: parsed.patient_id,
      person_id: parsed.person_id,
      lead_id: parsed.lead_id,
      booking_id: parsed.booking_id,
    });

    const tid = tenantId.trim();
    revalidatePath(`/fi-admin/${tid}/consultations`);
    revalidatePath(`/fi-admin/${tid}/consultations/new`);
    revalidatePath(`/fi-admin/${tid}/consultations/${row.id}`);
    return { ok: true, consultationId: row.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateConsultationDraftAction(
  tenantId: string,
  consultationId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = consultationUpsertBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    const fiUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    const { adminKey, ...patch } = parsed;
    void adminKey;
    await updateConsultationDraft(tenantId, consultationId, {
      ...patch,
      updatedByFiUserId: fiUserId,
    });

    const tid = tenantId.trim();
    const cid = consultationId.trim();
    revalidatePath(`/fi-admin/${tid}/consultations`);
    revalidatePath(`/fi-admin/${tid}/consultations/${cid}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function completeConsultationDraftAction(
  tenantId: string,
  consultationId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = consultationCompleteBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const fiUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    await completeConsultationDraft(tenantId, consultationId, { updatedByFiUserId: fiUserId });

    const tid = tenantId.trim();
    const cid = consultationId.trim();
    revalidatePath(`/fi-admin/${tid}/consultations`);
    revalidatePath(`/fi-admin/${tid}/consultations/${cid}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createConsultationFromBookingAction(
  tenantId: string,
  bookingId: string,
  body?: unknown
): Promise<
  | { ok: true; consultationId: string; created: boolean }
  | { ok: false; error: string }
> {
  try {
    const adminKey =
      body && typeof body === "object" && body !== null && "adminKey" in body
        ? String((body as { adminKey?: string }).adminKey ?? "")
        : undefined;
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: undefined });

    const fiUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    const { consultation, created } = await createConsultationFromBooking(tenantId.trim(), bookingId.trim(), {
      createdByFiUserId: fiUserId,
    });

    const tid = tenantId.trim();
    const cid = consultation.id;
    revalidatePath(`/fi-admin/${tid}/consultations`);
    revalidatePath(`/fi-admin/${tid}/consultations/${cid}`);
    revalidatePath(`/fi-admin/${tid}/calendar`);
    return { ok: true, consultationId: cid, created };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
