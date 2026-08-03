"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import {
  PaymentRecordAccessError,
  assertPaymentRecordWriteAllowed,
} from "@/src/lib/payments/paymentRecordAccess.server";
import {
  createPaymentRecord,
  recordManualPayment,
  updatePaymentRecordStatus,
} from "@/src/lib/payments/paymentRecordMutations.server";
import {
  createPaymentRecordBodySchema,
  recordManualPaymentBodySchema,
  updatePaymentRecordStatusBodySchema,
} from "@/src/lib/payments/paymentRecordSchemas";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";
import { emitAuditEventBackground } from "@/src/lib/systemAudit/emitAuditEvent.server";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof PaymentRecordAccessError) return e.message;
  if (e instanceof StaffPinMutationBlockedError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidatePaymentSurfaces(tenantId: string): void {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/operations`);
  revalidatePath(`/fi-admin/${tid}/consultation-conversion`);
  revalidatePath(`/fi-admin/${tid}/surgery-readiness`);
  revalidatePath(`/fi-admin/${tid}/consultations`);
  revalidatePath(`/fi-admin/${tid}/cases`);
}

function revalidatePatientPaymentSurface(
  tenantId: string,
  patientId: string | null | undefined
): void {
  const pid = patientId?.trim();
  if (!pid) return;
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/patients/${encodeURIComponent(pid)}`);
}

export async function createPaymentRecordAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const parsed = createPaymentRecordBodySchema.parse(body);
    const { actorFiUserId } = await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const row = await createPaymentRecord(tenantId.trim(), parsed, actorFiUserId);
    const tid = tenantId.trim();
    const kind = String((row as { kind?: string; payment_kind?: string }).kind ?? (parsed as { kind?: string }).kind ?? "payment").toLowerCase();
    const isDeposit = kind.includes("deposit");
    emitAuditEventBackground({
      tenantId: tid,
      action: isDeposit ? "deposit.recorded" : "payment.recorded",
      entityType: "payment_record",
      entityId: row.id,
      parentEntityType: row.patient_id ? "patient" : null,
      parentEntityId: row.patient_id,
      summary: isDeposit ? "Deposit payment record created" : "Payment record created",
      metadata: {
        status: row.status ?? null,
        amount: (row as { amount?: unknown }).amount ?? null,
        kind,
      },
    });
    revalidatePaymentSurfaces(tenantId);
    if (row.consultation_id?.trim()) {
      revalidatePath(
        `/fi-admin/${tid}/consultations/${encodeURIComponent(row.consultation_id.trim())}`
      );
    }
    if (row.case_id?.trim()) {
      revalidatePath(`/fi-admin/${tid}/cases/${encodeURIComponent(row.case_id.trim())}`);
    }
    revalidatePatientPaymentSurface(tid, row.patient_id);
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updatePaymentRecordStatusAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = updatePaymentRecordStatusBodySchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const updated = await updatePaymentRecordStatus(
      tenantId.trim(),
      parsed.payment_record_id,
      parsed.status,
      parsed.notes
    );
    revalidatePaymentSurfaces(tenantId);
    revalidatePatientPaymentSurface(tenantId.trim(), updated.patient_id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function recordManualPaymentAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = recordManualPaymentBodySchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const updated = await recordManualPayment(
      tenantId.trim(),
      parsed.payment_record_id,
      parsed.payment_amount,
      parsed.notes
    );
    const tid = tenantId.trim();
    emitAuditEventBackground({
      tenantId: tid,
      action: "payment.recorded",
      entityType: "payment_record",
      entityId: updated.id ?? parsed.payment_record_id,
      parentEntityType: updated.patient_id ? "patient" : null,
      parentEntityId: updated.patient_id,
      summary: "Manual payment recorded",
      metadata: {
        payment_amount: parsed.payment_amount,
        has_notes: Boolean(parsed.notes?.trim()),
      },
    });
    revalidatePaymentSurfaces(tenantId);
    revalidatePatientPaymentSurface(tid, updated.patient_id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
