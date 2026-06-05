import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { loadConsultationForTenant } from "./consultationLoaders.server";
import { syncConsultationMedicalHairLossToPatientClinicalDetails } from "@/src/lib/patients/clinicalDetailsConsultationSync";
import { syncPostConsultReminderJobs } from "@/src/lib/reminders/reminderEnqueue.server";
import {
  CONSULTATION_EDITABLE_STATUSES,
  type ConsultationCreateDraftBody,
  type ConsultationRow,
  type ConsultationUpsertBody,
  consultationEditableStatusSchema,
  consultationTypeIdSchema,
} from "./consultationTypes";

function isEditableStatus(s: string): s is (typeof CONSULTATION_EDITABLE_STATUSES)[number] {
  return (CONSULTATION_EDITABLE_STATUSES as readonly string[]).includes(s);
}

function normalizeDateInput(v: string | null | undefined): string | null {
  if (v === null || v === undefined || v === "") return null;
  return v;
}

async function assertFoundationPatient(tenantId: string, patientId: string): Promise<{ id: string; person_id: string }> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id, person_id")
    .eq("tenant_id", tid)
    .eq("id", pid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Patient not found for this tenant.");
  const row = data as { id: string; person_id: string };
  return { id: String(row.id), person_id: String(row.person_id) };
}

async function assertPersonInTenant(tenantId: string, personId: string): Promise<void> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const id = personId.trim();
  const { data, error } = await supabase.from("fi_persons").select("id").eq("tenant_id", tid).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Person not found for this tenant.");
}

async function assertLeadInTenant(tenantId: string, leadId: string): Promise<void> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const id = leadId.trim();
  const { data, error } = await supabase.from("fi_crm_leads").select("id").eq("tenant_id", tid).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lead not found for this tenant.");
}

export type CreateConsultationDraftInput = ConsultationCreateDraftBody & {
  createdByFiUserId?: string | null;
};

export async function createConsultationDraft(
  tenantId: string,
  input: CreateConsultationDraftInput
): Promise<ConsultationRow> {
  const tid = tenantId.trim();
  if (!tid) throw new Error("tenantId is required.");

  const typeParse = consultationTypeIdSchema.safeParse(input.consultation_type);
  if (!typeParse.success) throw new Error(typeParse.error.errors[0]?.message ?? "Invalid consultation_type.");

  const insertRow: Record<string, unknown> = {
    tenant_id: tid,
    consultation_type: typeParse.data,
    status: "draft" as const,
    structured_data: {},
    quote_data: {},
    created_by: input.createdByFiUserId ?? null,
    updated_by: input.createdByFiUserId ?? null,
  };

  if (input.patient_id?.trim()) {
    const p = await assertFoundationPatient(tid, input.patient_id);
    insertRow.patient_id = p.id;
    insertRow.person_id = p.person_id;
  } else if (input.person_id?.trim()) {
    await assertPersonInTenant(tid, input.person_id);
    insertRow.person_id = input.person_id.trim();
  }

  if (input.lead_id?.trim()) {
    await assertLeadInTenant(tid, input.lead_id);
    insertRow.lead_id = input.lead_id.trim();
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("fi_consultations").insert(insertRow).select("*").single();
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object") throw new Error("Insert failed.");

  const loaded = await loadConsultationForTenant(tid, String((data as { id: string }).id));
  if (!loaded) throw new Error("Could not load consultation after insert.");
  return loaded;
}

export type UpdateConsultationDraftInput = ConsultationUpsertBody & {
  updatedByFiUserId?: string | null;
};

export async function updateConsultationDraft(
  tenantId: string,
  consultationId: string,
  patch: UpdateConsultationDraftInput
): Promise<ConsultationRow> {
  const tid = tenantId.trim();
  const cid = consultationId.trim();
  if (!tid || !cid) throw new Error("tenantId and consultationId are required.");

  const existing = await loadConsultationForTenant(tid, cid);
  if (!existing) throw new Error("Consultation not found.");

  if (!isEditableStatus(existing.status)) {
    throw new Error("This consultation can no longer be edited (only draft or in-progress rows are mutable in this stage).");
  }

  const updatePayload: Record<string, unknown> = {
    updated_by: patch.updatedByFiUserId ?? null,
  };

  if (patch.consultation_type !== undefined) {
    const t = consultationTypeIdSchema.safeParse(patch.consultation_type);
    if (!t.success) throw new Error(t.error.errors[0]?.message ?? "Invalid consultation_type.");
    updatePayload.consultation_type = t.data;
  }

  if (patch.status !== undefined) {
    const s = consultationEditableStatusSchema.safeParse(patch.status);
    if (!s.success) throw new Error(s.error.errors[0]?.message ?? "Invalid status.");
    updatePayload.status = s.data;
  }

  if (patch.consultant_name !== undefined) {
    updatePayload.consultant_name = patch.consultant_name;
  }

  if (patch.consultation_date !== undefined) {
    updatePayload.consultation_date = normalizeDateInput(patch.consultation_date);
  }

  if (patch.structured_data !== undefined) {
    updatePayload.structured_data = patch.structured_data;
  }

  if (patch.live_notes !== undefined) {
    updatePayload.live_notes = patch.live_notes;
  }

  if (patch.recommendation_notes !== undefined) {
    updatePayload.recommendation_notes = patch.recommendation_notes;
  }

  if (patch.quote_data !== undefined) {
    updatePayload.quote_data = patch.quote_data;
  }

  if (patch.lead_id !== undefined) {
    if (patch.lead_id === null) {
      updatePayload.lead_id = null;
    } else {
      await assertLeadInTenant(tid, patch.lead_id);
      updatePayload.lead_id = patch.lead_id.trim();
    }
  }

  let patientBranchSetPerson = false;
  if (patch.patient_id !== undefined) {
    if (patch.patient_id === null) {
      updatePayload.patient_id = null;
    } else {
      const p = await assertFoundationPatient(tid, patch.patient_id);
      updatePayload.patient_id = p.id;
      updatePayload.person_id = p.person_id;
      patientBranchSetPerson = true;
    }
  }

  if (patch.person_id !== undefined && !patientBranchSetPerson) {
    if (patch.person_id === null) {
      updatePayload.person_id = null;
    } else {
      await assertPersonInTenant(tid, patch.person_id);
      updatePayload.person_id = patch.person_id.trim();
    }
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_consultations")
    .update(updatePayload)
    .eq("tenant_id", tid)
    .eq("id", cid)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Update failed.");

  const loaded = await loadConsultationForTenant(tid, cid);
  if (!loaded) throw new Error("Could not load consultation after update.");

  if ((patch.structured_data !== undefined || patch.patient_id !== undefined) && loaded.patient_id?.trim()) {
    const sd =
      loaded.structured_data && typeof loaded.structured_data === "object" && !Array.isArray(loaded.structured_data)
        ? (loaded.structured_data as Record<string, unknown>)
        : {};
    await syncConsultationMedicalHairLossToPatientClinicalDetails({
      tenantId: tid,
      patientId: loaded.patient_id,
      structuredData: sd,
    });
  }

  return loaded;
}

/**
 * One-way transition to `completed` (outside draft autosave). Enqueues `post_consult` reminder templates when eligible.
 */
export async function completeConsultationDraft(
  tenantId: string,
  consultationId: string,
  opts?: { updatedByFiUserId?: string | null }
): Promise<ConsultationRow> {
  const tid = tenantId.trim();
  const cid = consultationId.trim();
  if (!tid || !cid) throw new Error("tenantId and consultationId are required.");

  const existing = await loadConsultationForTenant(tid, cid);
  if (!existing) throw new Error("Consultation not found.");
  if (!isEditableStatus(existing.status)) {
    throw new Error("Only draft or in-progress consultations can be marked completed.");
  }

  const nowIso = new Date().toISOString();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_consultations")
    .update({
      status: "completed",
      updated_at: nowIso,
      updated_by: opts?.updatedByFiUserId ?? null,
    })
    .eq("tenant_id", tid)
    .eq("id", cid)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Update failed.");

  const loaded = await loadConsultationForTenant(tid, cid);
  if (!loaded) throw new Error("Could not load consultation after completion.");
  await syncPostConsultReminderJobs(loaded, supabase);
  return loaded;
}
