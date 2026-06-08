"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { insertPrescriptionStatusAuditEvent } from "@/src/lib/prescribing/prescriptionStatusAudit.server";
import { requireFiPrescribingActor } from "@/src/lib/prescribing/fiPrescribingAccess.server";
import { loadPrescriptionDetail } from "@/src/lib/prescribing/fiPrescribingLoaders.server";
import { validateRepeatRulesPrescriberConfirmed } from "@/src/lib/prescribing/prescribingRepeatRules";
import {
  prescriptionIdBodySchema,
  savePrescriptionDraftBodySchema,
} from "@/src/lib/prescribing/fiPrescribingSchemas";
import type { MedicationFormType } from "@/src/lib/prescribing/fiPrescribingTypes";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidatePrescriptionPaths(tenantId: string, patientId?: string | null, caseId?: string | null): void {
  const base = `/fi-admin/${tenantId.trim()}`;
  revalidatePath(`${base}/prescriptions`);
  if (patientId?.trim()) revalidatePath(`${base}/patients/${patientId.trim()}`);
  if (caseId?.trim()) revalidatePath(`${base}/cases/${caseId.trim()}`);
}

async function assertPatientTenant(supabase: ReturnType<typeof supabaseAdmin>, tenantId: string, patientId: string) {
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("id", patientId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Patient not found for this tenant.");
}

async function assertStaffTenant(supabase: ReturnType<typeof supabaseAdmin>, tenantId: string, staffId: string) {
  const { data, error } = await supabase
    .from("fi_staff")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("id", staffId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Doctor not found for this tenant.");
}

async function assertCaseTenantAndPatient(
  supabase: ReturnType<typeof supabaseAdmin>,
  tenantId: string,
  caseId: string | null | undefined,
  patientId: string
) {
  if (!caseId?.trim()) return;
  const { data, error } = await supabase
    .from("fi_cases")
    .select("id, foundation_patient_id")
    .eq("tenant_id", tenantId.trim())
    .eq("id", caseId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Case not found for this tenant.");
  const fp = (data as { foundation_patient_id: string | null }).foundation_patient_id;
  if (fp && fp.trim() !== patientId.trim()) {
    throw new Error("Selected case is not linked to this patient.");
  }
}

async function insertStatusEvent(opts: {
  tenantId: string;
  prescriptionId: string;
  fromStatus: string | null;
  toStatus: string;
  actorFiUserId: string;
  note?: string | null;
}) {
  await insertPrescriptionStatusAuditEvent(opts);
}

async function loadCatalogueRowMap(
  supabase: ReturnType<typeof supabaseAdmin>,
  tenantId: string,
  catalogueIds: string[]
): Promise<Map<string, { medication_name: string; form_type: MedicationFormType; quantity_label: string }>> {
  const uniq = Array.from(new Set(catalogueIds.map((id) => id.trim()).filter(Boolean)));
  const map = new Map<string, { medication_name: string; form_type: MedicationFormType; quantity_label: string }>();
  if (uniq.length === 0) return map;
  const { data, error } = await supabase
    .from("fi_medication_catalogue")
    .select("id, medication_name, form_type, quantity_label")
    .eq("tenant_id", tenantId.trim())
    .in("id", uniq);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const r = raw as {
      id: string;
      medication_name: string;
      form_type: MedicationFormType;
      quantity_label: string;
    };
    map.set(String(r.id), {
      medication_name: String(r.medication_name ?? ""),
      form_type: r.form_type,
      quantity_label: String(r.quantity_label ?? ""),
    });
  }
  return map;
}

export async function savePrescriptionDraftAction(
  body: unknown
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const parsed = savePrescriptionDraftBodySchema.parse(body);
    const actor = await requireFiPrescribingActor(parsed.tenantId);
    const supabase = supabaseAdmin();
    const tid = parsed.tenantId.trim();

    await assertPatientTenant(supabase, tid, parsed.patientId);
    await assertStaffTenant(supabase, tid, parsed.doctorId);
    await assertCaseTenantAndPatient(supabase, tid, parsed.caseId, parsed.patientId);

    const repeatDraftErr = validateRepeatRulesPrescriberConfirmed(
      parsed.items.map((it) => ({
        repeats_instructions: it.repeatsInstructions?.trim() ?? null,
        reorder_rule: it.reorderRule?.trim() ?? null,
        repeat_rules_prescriber_confirmed: it.repeatRulesPrescriberConfirmed,
      }))
    );
    if (repeatDraftErr) return { ok: false, error: repeatDraftErr };

    if (parsed.repeatsAllowed && parsed.repeatLimit < 1) {
      return { ok: false, error: "Repeat limit must be at least 1 when patient repeats are allowed." };
    }

    const catIds = parsed.items.map((i) => i.catalogueId);
    const catMap = await loadCatalogueRowMap(supabase, tid, catIds);

    if (parsed.prescriptionId?.trim()) {
      const existing = await loadPrescriptionDetail(tid, parsed.prescriptionId.trim());
      if (!existing) return { ok: false, error: "Prescription not found." };
      if (existing.prescription.status !== "draft") {
        return { ok: false, error: "Only draft prescriptions can be edited." };
      }
      if (existing.prescription.patient_id !== parsed.patientId.trim()) {
        return { ok: false, error: "Patient mismatch." };
      }

      const { error: u1 } = await supabase
        .from("fi_patient_prescriptions")
        .update({
          doctor_id: parsed.doctorId.trim(),
          case_id: parsed.caseId?.trim() ?? null,
          clinical_notes: parsed.clinicalNotes?.trim() || null,
          delivery_type: parsed.deliveryType?.trim() || null,
          patient_shipping_address: parsed.patientShippingAddress?.trim() || null,
          pharmacy_name: parsed.pharmacyName?.trim() || null,
          repeats_allowed: parsed.repeatsAllowed ?? false,
          repeat_limit: parsed.repeatLimit ?? 0,
          reorder_valid_from: parsed.reorderValidFrom?.trim() || null,
          reorder_valid_until: parsed.reorderValidUntil?.trim() || null,
          reorder_review_required: parsed.reorderReviewRequired ?? false,
          patient_reorder_fee_pence: parsed.patientReorderFeePence ?? null,
          reorder_fee_payment_required: parsed.reorderFeePaymentRequired ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tid)
        .eq("id", parsed.prescriptionId.trim())
        .eq("status", "draft");
      if (u1) return { ok: false, error: u1.message };

      const { error: d1 } = await supabase
        .from("fi_prescription_items")
        .delete()
        .eq("tenant_id", tid)
        .eq("prescription_id", parsed.prescriptionId.trim());
      if (d1) return { ok: false, error: d1.message };

      const rows = parsed.items.map((it) => {
        const snap = catMap.get(it.catalogueId.trim());
        if (!snap) throw new Error("Unknown catalogue item.");
        return {
          tenant_id: tid,
          prescription_id: parsed.prescriptionId!.trim(),
          catalogue_id: it.catalogueId.trim(),
          medication_name: snap.medication_name,
          form_type: snap.form_type,
          quantity_label: snap.quantity_label,
          dose_instructions: it.doseInstructions.trim(),
          repeats_instructions: it.repeatsInstructions?.trim() || null,
          reorder_rule: it.reorderRule?.trim() || null,
          repeat_rules_prescriber_confirmed: Boolean(it.repeatRulesPrescriberConfirmed),
          sort_order: it.sortOrder,
        };
      });
      if (rows.length) {
        const { error: i1 } = await supabase.from("fi_prescription_items").insert(rows);
        if (i1) return { ok: false, error: i1.message };
      }

      revalidatePrescriptionPaths(tid, parsed.patientId, parsed.caseId ?? existing.prescription.case_id);
      return { ok: true, id: parsed.prescriptionId.trim() };
    }

    const { data: created, error: cErr } = await supabase
      .from("fi_patient_prescriptions")
      .insert({
        tenant_id: tid,
        patient_id: parsed.patientId.trim(),
        doctor_id: parsed.doctorId.trim(),
        case_id: parsed.caseId?.trim() ?? null,
        status: "draft",
        clinical_notes: parsed.clinicalNotes?.trim() || null,
        delivery_type: parsed.deliveryType?.trim() || null,
        patient_shipping_address: parsed.patientShippingAddress?.trim() || null,
        pharmacy_name: parsed.pharmacyName?.trim() || null,
        repeats_allowed: parsed.repeatsAllowed ?? false,
        repeat_limit: parsed.repeatLimit ?? 0,
        reorder_valid_from: parsed.reorderValidFrom?.trim() || null,
        reorder_valid_until: parsed.reorderValidUntil?.trim() || null,
        reorder_review_required: parsed.reorderReviewRequired ?? false,
        patient_reorder_fee_pence: parsed.patientReorderFeePence ?? null,
        reorder_fee_payment_required: parsed.reorderFeePaymentRequired ?? false,
        created_by_fi_user_id: actor.fiUserId,
      })
      .select("id")
      .single();
    if (cErr || !created) return { ok: false, error: cErr?.message ?? "Create failed." };
    const newId = String((created as { id: string }).id);

    await insertStatusEvent({
      tenantId: tid,
      prescriptionId: newId,
      fromStatus: null,
      toStatus: "draft",
      actorFiUserId: actor.fiUserId,
      note: "Prescription created",
    });

    const rows = parsed.items.map((it) => {
      const snap = catMap.get(it.catalogueId.trim());
      if (!snap) throw new Error("Unknown catalogue item.");
      return {
        tenant_id: tid,
        prescription_id: newId,
        catalogue_id: it.catalogueId.trim(),
        medication_name: snap.medication_name,
        form_type: snap.form_type,
        quantity_label: snap.quantity_label,
        dose_instructions: it.doseInstructions.trim(),
        repeats_instructions: it.repeatsInstructions?.trim() || null,
        reorder_rule: it.reorderRule?.trim() || null,
        repeat_rules_prescriber_confirmed: Boolean(it.repeatRulesPrescriberConfirmed),
        sort_order: it.sortOrder,
      };
    });
    if (rows.length) {
      const { error: i1 } = await supabase.from("fi_prescription_items").insert(rows);
      if (i1) return { ok: false, error: i1.message };
    }

    revalidatePrescriptionPaths(tid, parsed.patientId, parsed.caseId);
    return { ok: true, id: newId };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function signPrescriptionAction(
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = prescriptionIdBodySchema.parse(body);
    const actor = await requireFiPrescribingActor(parsed.tenantId);
    const supabase = supabaseAdmin();
    const tid = parsed.tenantId.trim();
    const rid = parsed.prescriptionId.trim();

    const bundle = await loadPrescriptionDetail(tid, rid);
    if (!bundle) return { ok: false, error: "Prescription not found." };
    if (bundle.prescription.status !== "draft") {
      return { ok: false, error: "Only draft prescriptions can be signed." };
    }
    if (bundle.items.length === 0) {
      return { ok: false, error: "Add at least one medication before signing." };
    }

    const repeatErr = validateRepeatRulesPrescriberConfirmed(bundle.items);
    if (repeatErr) return { ok: false, error: repeatErr };

    const signedAt = new Date().toISOString();
    const { error: u1 } = await supabase
      .from("fi_patient_prescriptions")
      .update({
        status: "signed",
        signed_at: signedAt,
        updated_at: signedAt,
      })
      .eq("tenant_id", tid)
      .eq("id", rid)
      .eq("status", "draft");
    if (u1) return { ok: false, error: u1.message };

    await insertStatusEvent({
      tenantId: tid,
      prescriptionId: rid,
      fromStatus: "draft",
      toStatus: "signed",
      actorFiUserId: actor.fiUserId,
      note: "Prescription signed",
    });

    revalidatePrescriptionPaths(tid, bundle.prescription.patient_id, bundle.prescription.case_id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function markPrescriptionReadyForPharmacyAction(
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = prescriptionIdBodySchema.parse(body);
    const actor = await requireFiPrescribingActor(parsed.tenantId);
    const supabase = supabaseAdmin();
    const tid = parsed.tenantId.trim();
    const rid = parsed.prescriptionId.trim();

    const bundle = await loadPrescriptionDetail(tid, rid);
    if (!bundle) return { ok: false, error: "Prescription not found." };
    if (bundle.prescription.status !== "signed") {
      return { ok: false, error: "Mark ready is only available after signing." };
    }
    if (bundle.prescription.ready_for_pharmacy_at) {
      return { ok: false, error: "Already marked ready for pharmacy." };
    }

    const ts = new Date().toISOString();
    const { error: u1 } = await supabase
      .from("fi_patient_prescriptions")
      .update({
        ready_for_pharmacy_at: ts,
        updated_at: ts,
      })
      .eq("tenant_id", tid)
      .eq("id", rid);
    if (u1) return { ok: false, error: u1.message };

    await insertStatusEvent({
      tenantId: tid,
      prescriptionId: rid,
      fromStatus: "signed",
      toStatus: "ready_for_pharmacy",
      actorFiUserId: actor.fiUserId,
      note: "Marked ready for pharmacy (internal queue — not transmitted)",
    });

    revalidatePrescriptionPaths(tid, bundle.prescription.patient_id, bundle.prescription.case_id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function cancelPrescriptionAction(
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = prescriptionIdBodySchema.parse(body);
    const actor = await requireFiPrescribingActor(parsed.tenantId);
    const supabase = supabaseAdmin();
    const tid = parsed.tenantId.trim();
    const rid = parsed.prescriptionId.trim();

    const bundle = await loadPrescriptionDetail(tid, rid);
    if (!bundle) return { ok: false, error: "Prescription not found." };
    if (bundle.prescription.status === "cancelled") {
      return { ok: false, error: "Already cancelled." };
    }
    if (bundle.prescription.status === "sent_to_pharmacy" || bundle.prescription.status === "dispensed" || bundle.prescription.status === "posted") {
      return { ok: false, error: "This prescription cannot be cancelled from FI Admin." };
    }

    const ts = new Date().toISOString();
    const { error: u1 } = await supabase
      .from("fi_patient_prescriptions")
      .update({
        status: "cancelled",
        updated_at: ts,
      })
      .eq("tenant_id", tid)
      .eq("id", rid);
    if (u1) return { ok: false, error: u1.message };

    await insertStatusEvent({
      tenantId: tid,
      prescriptionId: rid,
      fromStatus: bundle.prescription.status,
      toStatus: "cancelled",
      actorFiUserId: actor.fiUserId,
      note: "Cancelled",
    });

    revalidatePrescriptionPaths(tid, bundle.prescription.patient_id, bundle.prescription.case_id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
