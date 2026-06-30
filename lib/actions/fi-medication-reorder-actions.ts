"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { MedicationReorderStatus } from "@/src/lib/medicationReorder/medicationReorderTypes";
import { validatePatientReorderEligibility } from "@/src/lib/medicationReorder/medicationReorderValidation";
import { loadPatientPortalPatientRow } from "@/src/lib/patientPortal/patientPortalAccess.server";
import { loadPrescriptionDetail } from "@/src/lib/prescribing/fiPrescribingLoaders.server";
import { requireFiPrescribingActor } from "@/src/lib/prescribing/fiPrescribingAccess.server";

function errMsg(e: unknown): string {
  if (e instanceof z.ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

const submitReorderSchema = z.object({
  tenantId: z.string().uuid(),
  prescriptionItemId: z.string().uuid(),
  deliveryAddress: z.string().min(5).max(8000),
  paymentAcknowledged: z.boolean().optional(),
});

export async function submitPatientMedicationReorderAction(
  raw: unknown
): Promise<
  { ok: true; id: string; status: MedicationReorderStatus } | { ok: false; error: string }
> {
  try {
    const parsed = submitReorderSchema.parse(raw);
    const tid = parsed.tenantId.trim();
    const portal = await loadPatientPortalPatientRow(tid);
    if (!portal)
      return { ok: false, error: "Sign in with a patient-linked portal account to reorder." };

    const supabase = supabaseAdmin();
    const { data: itemRow, error: ie } = await supabase
      .from("fi_prescription_items")
      .select("id, tenant_id, prescription_id")
      .eq("tenant_id", tid)
      .eq("id", parsed.prescriptionItemId.trim())
      .maybeSingle();
    if (ie || !itemRow) return { ok: false, error: "Medication line not found." };

    const bundle = await loadPrescriptionDetail(
      tid,
      String((itemRow as { prescription_id: string }).prescription_id)
    );
    if (!bundle) return { ok: false, error: "Prescription not found." };
    if (bundle.prescription.patient_id !== portal.patientId) {
      return { ok: false, error: "This medication does not belong to your patient record." };
    }

    const item = bundle.items.find((it) => it.id === parsed.prescriptionItemId.trim());
    if (!item) return { ok: false, error: "Line item not on prescription." };

    const v = validatePatientReorderEligibility({
      prescription: bundle.prescription,
      item,
      now: new Date(),
    });
    if (!v.ok) return { ok: false, error: v.reason };

    const { count: pendingCount, error: pe } = await supabase
      .from("fi_medication_reorder_requests")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("source_prescription_item_id", item.id)
      .in("status", [
        "requested",
        "doctor_review_required",
        "approved",
        "sent_to_pharmacy",
        "posted",
      ]);
    if (pe) return { ok: false, error: pe.message };
    if ((pendingCount ?? 0) > 0) {
      return {
        ok: false,
        error: "You already have an active reorder request for this medication.",
      };
    }

    const rx = bundle.prescription;
    const feePence =
      rx.patient_reorder_fee_pence != null ? Number(rx.patient_reorder_fee_pence) : null;
    const feeRequired =
      Boolean(rx.reorder_fee_payment_required) && feePence != null && feePence > 0;
    let paymentStatus: "not_required" | "pending" | "paid" | "waived" = "not_required";
    if (feeRequired) {
      if (!parsed.paymentAcknowledged) {
        return { ok: false, error: "Please confirm payment for this reorder before submitting." };
      }
      paymentStatus = "paid";
    }

    const initialStatus: MedicationReorderStatus = rx.reorder_review_required
      ? "doctor_review_required"
      : "requested";

    const { data: ins, error: insE } = await supabase
      .from("fi_medication_reorder_requests")
      .insert({
        tenant_id: tid,
        patient_id: portal.patientId,
        source_prescription_id: rx.id,
        source_prescription_item_id: item.id,
        delivery_address: parsed.deliveryAddress.trim(),
        status: initialStatus,
        fee_pence: feePence,
        payment_status: paymentStatus,
        metadata: { source: "patient_portal_1d" },
      })
      .select("id, status")
      .single();
    if (insE || !ins)
      return { ok: false, error: insE?.message ?? "Could not create reorder request." };

    const newId = String((ins as { id: string }).id);

    if (initialStatus === "doctor_review_required") {
      const leadId = await findLatestLeadIdForPatient(supabase, tid, portal.patientId);
      if (leadId) {
        const { data: taskIns, error: te } = await supabase
          .from("fi_crm_tasks")
          .insert({
            tenant_id: tid,
            lead_id: leadId,
            patient_id: portal.patientId,
            case_id: rx.case_id,
            title: `Medication reorder review — ${item.medication_name}`,
            description: `Patient requested a refill. Reorder request ${newId.slice(0, 8)}…`,
            task_type: "medication_reorder_review",
            status: "open",
            metadata: { medication_reorder_request_id: newId, prescription_item_id: item.id },
          })
          .select("id")
          .single();
        if (!te && taskIns) {
          await supabase
            .from("fi_medication_reorder_requests")
            .update({ doctor_review_crm_task_id: String((taskIns as { id: string }).id) })
            .eq("tenant_id", tid)
            .eq("id", newId);
        }
      }
    }

    revalidatePath(`/patient/${tid}/medications`);
    revalidatePath(`/fi-admin/${tid}/medication-reorders`);
    revalidatePath(`/fi-admin/${tid}/patients/${portal.patientId}`);

    return { ok: true, id: newId, status: initialStatus };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

async function findLatestLeadIdForPatient(
  supabase: ReturnType<typeof supabaseAdmin>,
  tenantId: string,
  patientId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fi_crm_leads")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("patient_id", patientId.trim())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return String((data as { id: string }).id);
}

const staffRequestIdSchema = z.object({
  tenantId: z.string().uuid(),
  requestId: z.string().uuid(),
  rejectionReason: z.string().max(4000).optional(),
});

export async function approveMedicationReorderRequestAction(
  raw: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = staffRequestIdSchema.parse(raw);
    await requireFiPrescribingActor(parsed.tenantId);
    const supabase = supabaseAdmin();
    const tid = parsed.tenantId.trim();
    const rid = parsed.requestId.trim();

    const { data: row, error: re } = await supabase
      .from("fi_medication_reorder_requests")
      .select("id, tenant_id, status, source_prescription_id, patient_id")
      .eq("tenant_id", tid)
      .eq("id", rid)
      .maybeSingle();
    if (re || !row) return { ok: false, error: "Reorder request not found." };
    const st = String((row as { status: string }).status);
    if (st !== "requested" && st !== "doctor_review_required") {
      return { ok: false, error: "Only queued requests can be approved." };
    }

    const rxId = String((row as { source_prescription_id: string }).source_prescription_id);
    const { data: rx, error: rxe } = await supabase
      .from("fi_patient_prescriptions")
      .select("id, reorders_used, repeat_limit")
      .eq("tenant_id", tid)
      .eq("id", rxId)
      .maybeSingle();
    if (rxe || !rx) return { ok: false, error: "Source prescription missing." };
    const used = Number((rx as { reorders_used: number }).reorders_used ?? 0);
    const limit = Number((rx as { repeat_limit: number }).repeat_limit ?? 0);
    if (limit >= 1 && used >= limit) {
      return { ok: false, error: "Repeat limit already reached on prescription." };
    }

    const { error: u1 } = await supabase
      .from("fi_medication_reorder_requests")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("tenant_id", tid)
      .eq("id", rid)
      .in("status", ["requested", "doctor_review_required"]);
    if (u1) return { ok: false, error: u1.message };

    const nextUsed = used + 1;
    const { error: u2 } = await supabase
      .from("fi_patient_prescriptions")
      .update({ reorders_used: nextUsed, updated_at: new Date().toISOString() })
      .eq("tenant_id", tid)
      .eq("id", rxId)
      .eq("reorders_used", used);
    if (u2) return { ok: false, error: u2.message };

    const pid = String((row as { patient_id: string }).patient_id);
    revalidatePath(`/fi-admin/${tid}/medication-reorders`);
    revalidatePath(`/patient/${tid}/medications`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function rejectMedicationReorderRequestAction(
  raw: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = staffRequestIdSchema.parse(raw);
    await requireFiPrescribingActor(parsed.tenantId);
    const supabase = supabaseAdmin();
    const tid = parsed.tenantId.trim();
    const rid = parsed.requestId.trim();

    const { data: row, error: re } = await supabase
      .from("fi_medication_reorder_requests")
      .select("id, status, patient_id")
      .eq("tenant_id", tid)
      .eq("id", rid)
      .maybeSingle();
    if (re || !row) return { ok: false, error: "Reorder request not found." };
    const st = String((row as { status: string }).status);
    if (st !== "requested" && st !== "doctor_review_required") {
      return { ok: false, error: "Only queued requests can be rejected." };
    }

    const { error: u1 } = await supabase
      .from("fi_medication_reorder_requests")
      .update({
        status: "rejected",
        rejection_reason: parsed.rejectionReason?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tid)
      .eq("id", rid);
    if (u1) return { ok: false, error: u1.message };

    const pid = String((row as { patient_id: string }).patient_id);
    revalidatePath(`/fi-admin/${tid}/medication-reorders`);
    revalidatePath(`/patient/${tid}/medications`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const advanceSchema = z.object({
  tenantId: z.string().uuid(),
  requestId: z.string().uuid(),
  nextStatus: z.enum(["sent_to_pharmacy", "posted", "completed"]),
});

export async function advanceMedicationReorderStatusAction(
  raw: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = advanceSchema.parse(raw);
    await requireFiPrescribingActor(parsed.tenantId);
    const supabase = supabaseAdmin();
    const tid = parsed.tenantId.trim();
    const rid = parsed.requestId.trim();

    const { data: row, error: re } = await supabase
      .from("fi_medication_reorder_requests")
      .select("id, status, patient_id")
      .eq("tenant_id", tid)
      .eq("id", rid)
      .maybeSingle();
    if (re || !row) return { ok: false, error: "Reorder request not found." };
    const st = String((row as { status: string }).status) as MedicationReorderStatus;

    const allowed: Record<string, MedicationReorderStatus | undefined> = {
      approved: "sent_to_pharmacy",
      sent_to_pharmacy: "posted",
      posted: "completed",
    };
    const expectedNext = allowed[st];
    if (!expectedNext || expectedNext !== parsed.nextStatus) {
      return { ok: false, error: `Cannot move from ${st} to ${parsed.nextStatus}.` };
    }

    const { error: u1 } = await supabase
      .from("fi_medication_reorder_requests")
      .update({ status: parsed.nextStatus, updated_at: new Date().toISOString() })
      .eq("tenant_id", tid)
      .eq("id", rid)
      .eq("status", st);
    if (u1) return { ok: false, error: u1.message };

    const pid = String((row as { patient_id: string }).patient_id);
    revalidatePath(`/fi-admin/${tid}/medication-reorders`);
    revalidatePath(`/patient/${tid}/medications`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
