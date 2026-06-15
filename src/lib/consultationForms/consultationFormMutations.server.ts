import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { createTimelineEvent } from "@/src/lib/fi/foundation/createTimelineEvent";
import { loadConsultationForTenant } from "@/src/lib/consultations/consultationLoaders.server";

import type { ConsultationCompletionSummary } from "./completion/consultationCompletionTypes";
import { buildConsultationCompletionSummary } from "./completion/buildConsultationCompletionSummary";
import { HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG, HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG } from "./consultationFormConstants";
import { loadConsultationFormInstance, mapConsultationFormInstanceRow } from "./consultationFormLoad.server";
import type { ConsultationFormChannel, ConsultationFormInstanceWithTemplate } from "./consultationFormTypes";
import {
  hairTransplantConsultationSchemaV1,
  hairTransplantConsultationSchemaV2,
} from "./templates/hairTransplantConsultationTemplate";
import { hairLossTreatmentConsultationSchemaV1 } from "./templates/hairLossTreatmentConsultationTemplate";

export type CreateConsultationFormInstanceInput = {
  tenantId: string;
  consultationId: string;
  templateVersionId: string;
  channel: ConsultationFormChannel;
  initialValues?: Record<string, unknown>;
};

export type AutosaveConsultationFormInstanceInput = {
  tenantId: string;
  instanceId: string;
  values: Record<string, unknown>;
  computed?: Record<string, unknown>;
};

export type SubmitConsultationFormInstanceInput = {
  tenantId: string;
  instanceId: string;
  values: Record<string, unknown>;
  submittedByUserId?: string | null;
};

/**
 * Ensures the global Hair Transplant Consultation template exists with a **published** template version.
 * Publishes immutable v1 (legacy 16-section) when bootstrapping an empty template, then publishes **v2**
 * (ConsultationOS adaptive pathway). New in-room instances always bind to the highest published version.
 */
export async function ensureGlobalHairTransplantConsultationTemplate(
  client?: SupabaseClient
): Promise<{ templateVersionId: string }> {
  const supabase = client ?? supabaseAdmin();
  const slug = HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG;

  const { data: existingTpl, error: te1 } = await supabase
    .from("fi_consultation_form_templates")
    .select("id")
    .is("tenant_id", null)
    .eq("slug", slug)
    .maybeSingle();
  if (te1) throw new Error(te1.message);

  let templateId: string;
  if (existingTpl?.id) {
    templateId = String((existingTpl as { id: string }).id);
  } else {
    const { data: insTpl, error: te2 } = await supabase
      .from("fi_consultation_form_templates")
      .insert({
        tenant_id: null,
        slug,
        name: "Hair Transplant Consultation",
        treatment_program: "scalp_hair_transplant",
        description: "Guided in-room / pre-arrival consultation form for hair transplant planning.",
        is_active: true,
        metadata: {},
      })
      .select("id")
      .single();
    if (te2) {
      const { data: again, error: te3 } = await supabase
        .from("fi_consultation_form_templates")
        .select("id")
        .is("tenant_id", null)
        .eq("slug", slug)
        .maybeSingle();
      if (te3) throw new Error(te3.message);
      if (!again?.id) throw new Error(te2.message);
      templateId = String((again as { id: string }).id);
    } else {
      templateId = String((insTpl as { id: string }).id);
    }
  }

  const fetchLatestPublished = async () => {
    const { data, error } = await supabase
      .from("fi_consultation_form_template_versions")
      .select("id, version")
      .eq("template_id", templateId)
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as { id: string; version: number } | null) ?? null;
  };

  const insertPublishedVersion = async (version: number, schema: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("fi_consultation_form_template_versions")
      .insert({
        template_id: templateId,
        version,
        status: "published",
        schema,
        ui_layout: {},
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    return { data: data as { id: string } | null, error };
  };

  const latest = await fetchLatestPublished();
  if (latest && latest.version >= 2) {
    return { templateVersionId: String(latest.id) };
  }

  if (latest && latest.version === 1) {
    const { data, error } = await insertPublishedVersion(2, hairTransplantConsultationSchemaV2 as unknown as Record<string, unknown>);
    if (!error && data?.id) {
      return { templateVersionId: String(data.id) };
    }
    const msg = error?.message ?? "";
    if (!msg.includes("duplicate") && !msg.includes("unique")) {
      throw new Error(msg || "Could not insert Hair Transplant Consultation template version 2.");
    }
    const { data: row2, error: e2 } = await supabase
      .from("fi_consultation_form_template_versions")
      .select("id")
      .eq("template_id", templateId)
      .eq("version", 2)
      .maybeSingle();
    if (e2) throw new Error(e2.message);
    if (!row2?.id) throw new Error(error?.message ?? "Template version 2 missing after insert race.");
    return { templateVersionId: String((row2 as { id: string }).id) };
  }

  const { error: ve1 } = await insertPublishedVersion(
    1,
    hairTransplantConsultationSchemaV1 as unknown as Record<string, unknown>
  );
  if (ve1) {
    const msg = ve1.message ?? "";
    if (!msg.includes("duplicate") && !msg.includes("unique")) throw new Error(msg);
  }

  const { data: insV2, error: ve2 } = await insertPublishedVersion(
    2,
    hairTransplantConsultationSchemaV2 as unknown as Record<string, unknown>
  );
  if (!ve2 && insV2?.id) {
    return { templateVersionId: String(insV2.id) };
  }
  const msg2 = ve2?.message ?? "";
  if (!msg2.includes("duplicate") && !msg2.includes("unique")) {
    throw new Error(msg2 || "Could not insert Hair Transplant Consultation template version 2.");
  }

  const recovered = await fetchLatestPublished();
  if (!recovered?.id) throw new Error(ve2?.message ?? "Could not resolve Hair Transplant Consultation template version.");
  return { templateVersionId: String(recovered.id) };
}

export async function createConsultationFormInstance(
  input: CreateConsultationFormInstanceInput,
  client?: SupabaseClient
): Promise<ConsultationFormInstanceWithTemplate> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const cid = input.consultationId.trim();
  const vid = input.templateVersionId.trim();
  if (!tid || !cid || !vid) throw new Error("tenantId, consultationId, and templateVersionId are required.");

  const cons = await loadConsultationForTenant(tid, cid);
  if (!cons) throw new Error("Consultation not found for tenant.");

  const values = input.initialValues && typeof input.initialValues === "object" ? input.initialValues : {};

  const { data: raw, error } = await supabase
    .from("fi_consultation_form_instances")
    .insert({
      tenant_id: tid,
      consultation_id: cid,
      template_version_id: vid,
      channel: input.channel,
      status: "draft",
      values,
      computed: {},
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const inst = mapConsultationFormInstanceRow(raw as Record<string, unknown>);
  const loaded = await loadConsultationFormInstance(tid, inst.id);
  if (!loaded) throw new Error("Could not load form instance after insert.");
  return loaded;
}

/**
 * Loads or creates the in-room Hair Transplant Consultation instance for this consultation.
 */
export async function ensureInRoomHairTransplantConsultationFormInstance(
  tenantId: string,
  consultationId: string,
  client?: SupabaseClient
): Promise<ConsultationFormInstanceWithTemplate> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const cid = consultationId.trim();
  if (!tid || !cid) throw new Error("tenantId and consultationId are required.");

  const { templateVersionId } = await ensureGlobalHairTransplantConsultationTemplate(supabase);

  const { data: existing, error: ee } = await supabase
    .from("fi_consultation_form_instances")
    .select("id")
    .eq("tenant_id", tid)
    .eq("consultation_id", cid)
    .eq("channel", "in_room")
    .eq("template_version_id", templateVersionId)
    .maybeSingle();
  if (ee) throw new Error(ee.message);
  if (existing?.id) {
    const loaded = await loadConsultationFormInstance(tid, String((existing as { id: string }).id));
    if (!loaded) throw new Error("Could not load existing form instance.");
    return loaded;
  }

  try {
    return await createConsultationFormInstance(
      { tenantId: tid, consultationId: cid, templateVersionId, channel: "in_room" },
      supabase
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate key") && !msg.includes("unique constraint")) throw e;
    const { data: again, error: e2 } = await supabase
      .from("fi_consultation_form_instances")
      .select("id")
      .eq("tenant_id", tid)
      .eq("consultation_id", cid)
      .eq("channel", "in_room")
      .eq("template_version_id", templateVersionId)
      .maybeSingle();
    if (e2) throw new Error(e2.message);
    if (!again?.id) throw e;
    const loaded = await loadConsultationFormInstance(tid, String((again as { id: string }).id));
    if (!loaded) throw new Error("Could not load form instance after duplicate.");
    return loaded;
  }
}

/**
 * Ensures the global Hair Loss Treatment / HLI consultation template exists with a **published** version.
 */
export async function ensureGlobalHairLossTreatmentConsultationTemplate(
  client?: SupabaseClient
): Promise<{ templateVersionId: string }> {
  const supabase = client ?? supabaseAdmin();
  const slug = HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG;

  const { data: existingTpl, error: te1 } = await supabase
    .from("fi_consultation_form_templates")
    .select("id")
    .is("tenant_id", null)
    .eq("slug", slug)
    .maybeSingle();
  if (te1) throw new Error(te1.message);

  let templateId: string;
  if (existingTpl?.id) {
    templateId = String((existingTpl as { id: string }).id);
  } else {
    const { data: insTpl, error: te2 } = await supabase
      .from("fi_consultation_form_templates")
      .insert({
        tenant_id: null,
        slug,
        name: "Hair Loss Treatment Consultation",
        treatment_program: "hair_longevity_medical",
        description:
          "ConsultationOS pathway 2 — non-surgical hair loss, treatment planning, and Hair Longevity / Patient Twin alignment.",
        is_active: true,
        metadata: { consultation_os_pathway: "hli_v1" },
      })
      .select("id")
      .single();
    if (te2) {
      const { data: again, error: te3 } = await supabase
        .from("fi_consultation_form_templates")
        .select("id")
        .is("tenant_id", null)
        .eq("slug", slug)
        .maybeSingle();
      if (te3) throw new Error(te3.message);
      if (!again?.id) throw new Error(te2.message);
      templateId = String((again as { id: string }).id);
    } else {
      templateId = String((insTpl as { id: string }).id);
    }
  }

  const { data: published, error: pe } = await supabase
    .from("fi_consultation_form_template_versions")
    .select("id, version")
    .eq("template_id", templateId)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pe) throw new Error(pe.message);
  if (published?.id) {
    return { templateVersionId: String((published as { id: string }).id) };
  }

  const { data: insVer, error: ve } = await supabase
    .from("fi_consultation_form_template_versions")
    .insert({
      template_id: templateId,
      version: 1,
      status: "published",
      schema: hairLossTreatmentConsultationSchemaV1 as unknown as Record<string, unknown>,
      ui_layout: {},
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (!ve && insVer?.id) {
    return { templateVersionId: String((insVer as { id: string }).id) };
  }
  const msg = ve?.message ?? "";
  if (!msg.includes("duplicate") && !msg.includes("unique")) {
    throw new Error(msg || "Could not insert Hair Loss Treatment Consultation template version.");
  }
  const { data: recovered, error: re } = await supabase
    .from("fi_consultation_form_template_versions")
    .select("id")
    .eq("template_id", templateId)
    .eq("version", 1)
    .maybeSingle();
  if (re) throw new Error(re.message);
  if (!recovered?.id) throw new Error(ve?.message ?? "Could not resolve Hair Loss Treatment template version.");
  return { templateVersionId: String((recovered as { id: string }).id) };
}

/**
 * Loads or creates the in-room Hair Loss Treatment / HLI consultation instance for this consultation.
 */
export async function ensureInRoomHairLossTreatmentConsultationFormInstance(
  tenantId: string,
  consultationId: string,
  client?: SupabaseClient
): Promise<ConsultationFormInstanceWithTemplate> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const cid = consultationId.trim();
  if (!tid || !cid) throw new Error("tenantId and consultationId are required.");

  const { templateVersionId } = await ensureGlobalHairLossTreatmentConsultationTemplate(supabase);

  const { data: existing, error: ee } = await supabase
    .from("fi_consultation_form_instances")
    .select("id")
    .eq("tenant_id", tid)
    .eq("consultation_id", cid)
    .eq("channel", "in_room")
    .eq("template_version_id", templateVersionId)
    .maybeSingle();
  if (ee) throw new Error(ee.message);
  if (existing?.id) {
    const loaded = await loadConsultationFormInstance(tid, String((existing as { id: string }).id));
    if (!loaded) throw new Error("Could not load existing form instance.");
    return loaded;
  }

  try {
    return await createConsultationFormInstance(
      { tenantId: tid, consultationId: cid, templateVersionId, channel: "in_room" },
      supabase
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate key") && !msg.includes("unique constraint")) throw e;
    const { data: again, error: e2 } = await supabase
      .from("fi_consultation_form_instances")
      .select("id")
      .eq("tenant_id", tid)
      .eq("consultation_id", cid)
      .eq("channel", "in_room")
      .eq("template_version_id", templateVersionId)
      .maybeSingle();
    if (e2) throw new Error(e2.message);
    if (!again?.id) throw e;
    const loaded = await loadConsultationFormInstance(tid, String((again as { id: string }).id));
    if (!loaded) throw new Error("Could not load form instance after duplicate.");
    return loaded;
  }
}

export async function autosaveConsultationFormInstance(
  input: AutosaveConsultationFormInstanceInput,
  client?: SupabaseClient
): Promise<ConsultationFormInstanceWithTemplate> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const iid = input.instanceId.trim();
  if (!tid || !iid) throw new Error("tenantId and instanceId are required.");

  const existing = await loadConsultationFormInstance(tid, iid);
  if (!existing) throw new Error("Form instance not found.");
  if (existing.status !== "draft") {
    throw new Error("Only draft form instances can be autosaved.");
  }

  const patchComputed =
    input.computed && typeof input.computed === "object" && !Array.isArray(input.computed) ? input.computed : {};
  const computed = { ...existing.computed, ...patchComputed };

  const { data: raw, error } = await supabase
    .from("fi_consultation_form_instances")
    .update({
      values: input.values,
      computed,
    })
    .eq("tenant_id", tid)
    .eq("id", iid)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const inst = mapConsultationFormInstanceRow(raw as Record<string, unknown>);
  const loaded = await loadConsultationFormInstance(tid, inst.id);
  if (!loaded) throw new Error("Could not load form instance after autosave.");
  return loaded;
}

export async function submitConsultationFormInstance(
  input: SubmitConsultationFormInstanceInput,
  client?: SupabaseClient
): Promise<ConsultationFormInstanceWithTemplate> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const iid = input.instanceId.trim();
  if (!tid || !iid) throw new Error("tenantId and instanceId are required.");

  const existing = await loadConsultationFormInstance(tid, iid);
  if (!existing) throw new Error("Form instance not found.");
  if (existing.status !== "draft") {
    throw new Error("Only draft form instances can be submitted.");
  }

  const {
    validateBodyAreaMapShapesInValues,
    validateConsultationFormRequiredFields,
    validateVoiceNoteClinicalNoteShapesInValues,
  } = await import("./consultationFormValidation");
  const issues = validateConsultationFormRequiredFields(existing.template_version.schema, input.values);
  if (issues.length > 0) {
    throw new Error(issues.map((i) => i.message).join(" "));
  }
  const shapeIssues = validateBodyAreaMapShapesInValues(existing.template_version.schema, input.values);
  if (shapeIssues.length > 0) {
    throw new Error(shapeIssues.map((i) => i.message).join(" "));
  }
  const noteShapeIssues = validateVoiceNoteClinicalNoteShapesInValues(existing.template_version.schema, input.values);
  if (noteShapeIssues.length > 0) {
    throw new Error(noteShapeIssues.map((i) => i.message).join(" "));
  }

  const nowIso = new Date().toISOString();
  const { data: raw, error } = await supabase
    .from("fi_consultation_form_instances")
    .update({
      values: input.values,
      computed: existing.computed,
      status: "submitted",
      submitted_at: nowIso,
      submitted_by_user_id: input.submittedByUserId?.trim() || null,
    })
    .eq("tenant_id", tid)
    .eq("id", iid)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const inst = mapConsultationFormInstanceRow(raw as Record<string, unknown>);
  const loaded = await loadConsultationFormInstance(tid, inst.id);
  if (!loaded) throw new Error("Could not load form instance after submit.");
  return loaded;
}

export type UpsertClinicalNoteForFormFieldInput = {
  tenantId: string;
  consultationId: string;
  formInstanceId: string;
  formFieldId: string;
  transcriptRaw: string;
  sections?: Record<string, unknown>;
  recordStatus?: "ai_draft" | "approved" | "archived";
  existingClinicalNoteId?: string | null;
  createdByFiUserId?: string | null;
};

/**
 * Creates or updates a `fi_clinical_notes` row for ConsultationOS voice dictation (no AI pipeline).
 * Requires a foundation patient on the consultation.
 */
export async function upsertClinicalNoteForFormField(
  input: UpsertClinicalNoteForFormFieldInput,
  client?: SupabaseClient
): Promise<{ clinicalNoteId: string }> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const cid = input.consultationId.trim();
  const fid = input.formInstanceId.trim();
  const fieldId = input.formFieldId.trim();
  const transcript = input.transcriptRaw ?? "";
  const recordStatus = input.recordStatus ?? "ai_draft";

  if (!tid || !cid || !fid || !fieldId) {
    throw new Error("tenantId, consultationId, formInstanceId, and formFieldId are required.");
  }

  const consultation = await loadConsultationForTenant(tid, cid);
  if (!consultation) throw new Error("Consultation not found.");
  const patientId = consultation.patient_id?.trim();
  if (!patientId) {
    throw new Error("Link a patient on the consultation workspace before saving to clinical notes.");
  }

  const { data: inst, error: ie } = await supabase
    .from("fi_consultation_form_instances")
    .select("id, consultation_id")
    .eq("tenant_id", tid)
    .eq("id", fid)
    .maybeSingle();
  if (ie) throw new Error(ie.message);
  if (!inst || String((inst as { consultation_id: string }).consultation_id) !== cid) {
    throw new Error("Form instance does not belong to this consultation.");
  }

  const { data: pat, error: pe } = await supabase
    .from("fi_patients")
    .select("id")
    .eq("tenant_id", tid)
    .eq("id", patientId)
    .maybeSingle();
  if (pe) throw new Error(pe.message);
  if (!pat) throw new Error("Patient not found for tenant.");

  const caseId = consultation.case_id?.trim() || null;
  if (caseId) {
    const { data: cs, error: ce } = await supabase
      .from("fi_cases")
      .select("id, foundation_patient_id")
      .eq("tenant_id", tid)
      .eq("id", caseId)
      .maybeSingle();
    if (ce) throw new Error(ce.message);
    if (!cs) throw new Error("Case not found.");
    const fp = (cs as { foundation_patient_id: string | null }).foundation_patient_id;
    if (fp != null && String(fp) !== patientId) {
      throw new Error("Case is not linked to this consultation patient.");
    }
  }

  const metadata: Record<string, unknown> = {
    consultation_os: true,
    form_instance_id: fid,
    form_field_id: fieldId,
  };

  const sectionsPayload = (input.sections && typeof input.sections === "object" && !Array.isArray(input.sections)
    ? input.sections
    : {}) as Record<string, unknown>;

  const existingId = input.existingClinicalNoteId?.trim() || null;

  if (existingId) {
    const { data: existing, error: exErr } = await supabase
      .from("fi_clinical_notes")
      .select("id, patient_id, tenant_id, form_instance_id, form_field_id")
      .eq("tenant_id", tid)
      .eq("id", existingId)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing) throw new Error("Clinical note not found.");
    if (String((existing as { patient_id: string }).patient_id) !== patientId) {
      throw new Error("Clinical note patient mismatch.");
    }
    const fi = (existing as { form_instance_id: string | null }).form_instance_id;
    const ff = (existing as { form_field_id: string | null }).form_field_id;
    if (fi != null && String(fi) !== fid) throw new Error("Clinical note is linked to a different form instance.");
    if (ff != null && String(ff) !== fieldId) throw new Error("Clinical note is linked to a different form field.");

    const now = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("fi_clinical_notes")
      .update({
        transcript_raw: transcript,
        sections: sectionsPayload,
        consultation_id: cid,
        form_instance_id: fid,
        form_field_id: fieldId,
        case_id: caseId,
        record_status: recordStatus,
        updated_at: now,
      })
      .eq("tenant_id", tid)
      .eq("id", existingId);
    if (upErr) throw new Error(upErr.message);
    return { clinicalNoteId: existingId };
  }

  const { data: ins, error: insErr } = await supabase
    .from("fi_clinical_notes")
    .insert({
      tenant_id: tid,
      patient_id: patientId,
      case_id: caseId,
      consultation_id: cid,
      form_instance_id: fid,
      form_field_id: fieldId,
      source: "consultation_form_voice",
      record_status: recordStatus,
      transcript_raw: transcript,
      sections: sectionsPayload,
      ai_model: null,
      metadata,
      created_by_fi_user_id: input.createdByFiUserId?.trim() || null,
    })
    .select("id")
    .single();
  if (insErr || !ins) throw new Error(insErr?.message ?? "Could not create clinical note.");
  return { clinicalNoteId: String((ins as { id: string }).id) };
}

export type CompleteConsultationFormInstanceInput = {
  tenantId: string;
  consultationId: string;
  formInstanceId: string;
  completedByUserId?: string | null;
};

function toJsonObject(summary: ConsultationCompletionSummary): Record<string, unknown> {
  return JSON.parse(JSON.stringify(summary)) as Record<string, unknown>;
}

/**
 * Stage 4: lock submitted form, persist rules-based completion summary, update consultation row,
 * and optionally append a Patient Twin (`fi_timeline_events`) milestone when a case exists.
 */
export async function completeConsultationFormInstance(
  input: CompleteConsultationFormInstanceInput,
  client?: SupabaseClient
): Promise<{ instance: ConsultationFormInstanceWithTemplate; summary: ConsultationCompletionSummary }> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const cid = input.consultationId.trim();
  const iid = input.formInstanceId.trim();
  if (!tid || !cid || !iid) throw new Error("tenantId, consultationId, and formInstanceId are required.");

  const existing = await loadConsultationFormInstance(tid, iid);
  if (!existing) throw new Error("Form instance not found.");
  if (String(existing.consultation_id) !== cid) throw new Error("Form instance does not belong to this consultation.");

  if (existing.status === "locked" && existing.completed_at) {
    const cs = existing.completion_summary;
    if (cs && typeof cs === "object" && "consultationId" in cs && String((cs as { consultationId: unknown }).consultationId) === cid) {
      return { instance: existing, summary: cs as unknown as ConsultationCompletionSummary };
    }
    throw new Error("This form is locked but has no valid completion summary.");
  }

  if (existing.status !== "submitted") {
    throw new Error("Submit the guided form before completing the consultation.");
  }

  const cons = await loadConsultationForTenant(tid, cid);
  if (!cons) throw new Error("Consultation not found.");

  const nowIso = new Date().toISOString();
  const summary = buildConsultationCompletionSummary({
    consultationId: cid,
    formInstanceId: iid,
    templateSlug: existing.template.slug,
    values: existing.values,
    completedAt: nowIso,
    completedByUserId: input.completedByUserId?.trim() || null,
  });

  const summaryPlain = toJsonObject(summary);
  const computed = { ...existing.computed, consultation_completion: summaryPlain };

  const { data: rawInst, error: upInstErr } = await supabase
    .from("fi_consultation_form_instances")
    .update({
      status: "locked",
      completed_at: nowIso,
      completed_by_user_id: input.completedByUserId?.trim() || null,
      completion_summary: summaryPlain,
      computed,
    })
    .eq("tenant_id", tid)
    .eq("id", iid)
    .select("*")
    .single();

  if (upInstErr) throw new Error(upInstErr.message);
  const instRow = mapConsultationFormInstanceRow(rawInst as Record<string, unknown>);
  const loadedInst = await loadConsultationFormInstance(tid, instRow.id);
  if (!loadedInst) throw new Error("Could not load form instance after completion.");

  const nextStructured: Record<string, unknown> = {
    ...cons.structured_data,
    completion_summary: summaryPlain,
  };

  let nextStatus = cons.status;
  if (nextStatus === "draft" || nextStatus === "in_progress") {
    nextStatus = "completed";
  }

  const consPatch: Record<string, unknown> = {
    structured_data: nextStructured,
    status: nextStatus,
  };

  const existingRec = cons.recommendation_notes?.trim();
  if (!existingRec) {
    const hint = [summary.recommendedProcedure, summary.diagnosisImpression].filter(Boolean).join("\n\n").trim();
    if (hint) consPatch.recommendation_notes = hint.slice(0, 12000);
  }

  const { error: consErr } = await supabase.from("fi_consultations").update(consPatch).eq("tenant_id", tid).eq("id", cid);
  if (consErr) throw new Error(consErr.message);

  const caseId = cons.case_id?.trim();
  const patientId = cons.patient_id?.trim();
  if (caseId && patientId) {
    const { data: evs, error: evErr } = await supabase
      .from("fi_timeline_events")
      .select("id, detail")
      .eq("tenant_id", tid)
      .eq("case_id", caseId)
      .eq("event_kind", "consultation.completed")
      .limit(80);
    if (evErr) throw new Error(evErr.message);
    const dup = (evs ?? []).some((row) => {
      const d = row.detail as Record<string, unknown> | null;
      return d && String(d.form_instance_id ?? "") === iid;
    });
    if (!dup) {
      await createTimelineEvent(
        {
          tenant_id: tid,
          case_id: caseId,
          patient_id: patientId,
          event_type: "consultation.completed",
          title: "Guided consultation completed",
          metadata: {
            consultation_id: cid,
            form_instance_id: iid,
            outcomeType: summary.outcomeType,
            recommendedProcedure: summary.recommendedProcedure,
            template_slug: existing.template.slug,
          },
        },
        supabase
      );
    }
  }

  return { instance: loadedInst, summary };
}
