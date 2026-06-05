import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { loadConsultationForTenant } from "./consultationLoaders.server";
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

  const supabase = supabaseAdmin();
  const insertRow = {
    tenant_id: tid,
    consultation_type: typeParse.data,
    status: "draft" as const,
    structured_data: {},
    quote_data: {},
    created_by: input.createdByFiUserId ?? null,
    updated_by: input.createdByFiUserId ?? null,
  };

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
  return loaded;
}
