import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type {
  ConsultationFormInstance,
  ConsultationFormInstanceWithTemplate,
  ConsultationFormSchema,
  ConsultationFormTemplate,
  ConsultationFormTemplateVersion,
} from "./consultationFormTypes";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function mapConsultationFormTemplateRow(raw: Record<string, unknown>): ConsultationFormTemplate {
  return {
    id: String(raw.id),
    tenant_id: raw.tenant_id == null ? null : String(raw.tenant_id),
    slug: String(raw.slug),
    name: String(raw.name),
    treatment_program: String(raw.treatment_program),
    description: raw.description == null ? null : String(raw.description),
    is_active: Boolean(raw.is_active),
    metadata: asRecord(raw.metadata),
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  };
}

export function mapConsultationFormTemplateVersionRow(raw: Record<string, unknown>): ConsultationFormTemplateVersion {
  const schemaRaw = raw.schema;
  const schema: ConsultationFormSchema =
    schemaRaw && typeof schemaRaw === "object" && !Array.isArray(schemaRaw) && "sections" in (schemaRaw as object)
      ? (schemaRaw as ConsultationFormSchema)
      : { sections: [] };

  return {
    id: String(raw.id),
    template_id: String(raw.template_id),
    version: Number(raw.version),
    status: raw.status as ConsultationFormTemplateVersion["status"],
    schema,
    ui_layout: asRecord(raw.ui_layout),
    published_at: raw.published_at == null ? null : String(raw.published_at),
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  };
}

export function mapConsultationFormInstanceRow(raw: Record<string, unknown>): ConsultationFormInstance {
  const completionRaw = raw.completion_summary;
  const completion_summary =
    completionRaw && typeof completionRaw === "object" && !Array.isArray(completionRaw)
      ? (completionRaw as Record<string, unknown>)
      : {};
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    consultation_id: String(raw.consultation_id),
    template_version_id: String(raw.template_version_id),
    channel: raw.channel as ConsultationFormInstance["channel"],
    status: raw.status as ConsultationFormInstance["status"],
    values: asRecord(raw.values),
    computed: asRecord(raw.computed),
    started_at: String(raw.started_at),
    submitted_at: raw.submitted_at == null ? null : String(raw.submitted_at),
    submitted_by_user_id: raw.submitted_by_user_id == null ? null : String(raw.submitted_by_user_id),
    completed_at: raw.completed_at == null ? null : String(raw.completed_at),
    completed_by_user_id: raw.completed_by_user_id == null ? null : String(raw.completed_by_user_id),
    completion_summary,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  };
}

async function loadTemplateVersionBundle(
  supabase: ReturnType<typeof supabaseAdmin>,
  templateVersionId: string
): Promise<{
  version: ConsultationFormTemplateVersion;
  template: ConsultationFormTemplate;
} | null> {
  const vid = templateVersionId.trim();
  if (!vid) return null;

  const { data: verRow, error: ve } = await supabase
    .from("fi_consultation_form_template_versions")
    .select("*")
    .eq("id", vid)
    .maybeSingle();
  if (ve) throw new Error(ve.message);
  if (!verRow) return null;

  const version = mapConsultationFormTemplateVersionRow(verRow as Record<string, unknown>);
  const tid = version.template_id;

  const { data: tplRow, error: te } = await supabase
    .from("fi_consultation_form_templates")
    .select("*")
    .eq("id", tid)
    .maybeSingle();
  if (te) throw new Error(te.message);
  if (!tplRow) return null;

  return { version, template: mapConsultationFormTemplateRow(tplRow as Record<string, unknown>) };
}

export async function loadConsultationFormInstances(
  tenantId: string,
  consultationId: string
): Promise<ConsultationFormInstanceWithTemplate[]> {
  const tid = tenantId.trim();
  const cid = consultationId.trim();
  if (!tid || !cid) return [];

  const supabase = supabaseAdmin();
  const { data: rows, error } = await supabase
    .from("fi_consultation_form_instances")
    .select("*")
    .eq("tenant_id", tid)
    .eq("consultation_id", cid)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const out: ConsultationFormInstanceWithTemplate[] = [];
  for (const raw of rows) {
    const inst = mapConsultationFormInstanceRow(raw as Record<string, unknown>);
    const bundle = await loadTemplateVersionBundle(supabase, inst.template_version_id);
    if (!bundle) continue;
    out.push({
      ...inst,
      template: {
        id: bundle.template.id,
        slug: bundle.template.slug,
        name: bundle.template.name,
        treatment_program: bundle.template.treatment_program,
      },
      template_version: {
        id: bundle.version.id,
        version: bundle.version.version,
        status: bundle.version.status,
        schema: bundle.version.schema,
      },
    });
  }
  return out;
}

export async function loadConsultationFormInstance(
  tenantId: string,
  instanceId: string
): Promise<ConsultationFormInstanceWithTemplate | null> {
  const tid = tenantId.trim();
  const iid = instanceId.trim();
  if (!tid || !iid) return null;

  const supabase = supabaseAdmin();
  const { data: raw, error } = await supabase
    .from("fi_consultation_form_instances")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", iid)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!raw) return null;

  const inst = mapConsultationFormInstanceRow(raw as Record<string, unknown>);
  const bundle = await loadTemplateVersionBundle(supabase, inst.template_version_id);
  if (!bundle) return null;

  return {
    ...inst,
    template: {
      id: bundle.template.id,
      slug: bundle.template.slug,
      name: bundle.template.name,
      treatment_program: bundle.template.treatment_program,
    },
    template_version: {
      id: bundle.version.id,
      version: bundle.version.version,
      status: bundle.version.status,
      schema: bundle.version.schema,
    },
  };
}
