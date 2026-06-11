import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "@/src/lib/crm/activity";
import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";
import { pathologyAiInterpretationJsonSchema, type PathologyAiInterpretationJson } from "./pathologyAiInterpretationSchema";
import { mapPathologyAiInterpretationRow } from "./pathologyAiInterpretationLoad.server";
import type { PathologyAiInterpretationRow } from "./pathologyAiInterpretationTypes";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";

type ResultMarker = {
  test_code: string | null;
  test_label: string;
  result_value: string;
  result_unit: string | null;
  reference_range: string | null;
  flag: string;
};

type ResultHeader = {
  id: string;
  tenant_id: string;
  patient_id: string;
  pathology_request_id: string | null;
  result_date: string;
  provider_name: string | null;
  clinical_summary: string | null;
};

function requireOpenAiKey(): string {
  const k = process.env.OPENAI_API_KEY?.trim();
  if (!k) throw new Error("OPENAI_API_KEY is not configured for pathology AI interpretation.");
  return k;
}

function modelName(): string {
  return process.env.OPENAI_PATHOLOGY_INTERPRETATION_MODEL?.trim() || process.env.OPENAI_CLINICAL_NOTE_MODEL?.trim() || "gpt-4o-mini";
}

function maybeNumber(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function shapePrompt(): string {
  return JSON.stringify(
    {
      overview: "string",
      likely_contributors: [{ name: "string", rationale: "string" }],
      abnormal_markers: [
        {
          marker: "string",
          value: "string or null",
          unit: "string or null",
          reference_range: "string or null",
          flag: "string",
          hair_relevance: "string",
          suggested_next_step: "string or null",
        },
      ],
      suboptimal_markers_for_hair: [
        {
          marker: "string",
          value: "string or null",
          unit: "string or null",
          reference_range: "string or null",
          flag: "string",
          hair_relevance: "string",
          suggested_next_step: "string or null",
        },
      ],
      missing_markers: [
        {
          marker: "string",
          value: null,
          unit: null,
          reference_range: null,
          flag: "missing",
          hair_relevance: "string",
          suggested_next_step: "string",
        },
      ],
      risk_flags: [{ label: "string", rationale: "string", urgency: "routine | review_soon | urgent" }],
      treatment_considerations: [{ label: "string", rationale: "string" }],
      supplement_considerations: [{ label: "string", rationale: "string" }],
      medication_considerations: [{ label: "string", rationale: "string" }],
      surgery_readiness: {
        narrative: "string",
        score: 0,
        iron_status_score: 0,
        thyroid_status_score: 0,
        vitamin_status_score: 0,
        inflammation_status_score: 0,
        hormone_status_score: 0,
      },
      repeat_testing_recommendations: [{ marker_or_panel: "string", rationale: "string", suggested_timing: "string or null" }],
      patient_friendly_summary: "string",
      clinician_summary: "string",
      hair_loss_relevance_score: 0,
    },
    null,
    2
  );
}

function buildPrompt(params: {
  patientDisplayName: string | null;
  result: ResultHeader;
  markers: ResultMarker[];
  linkedRequest: { request_date: string; template_used: string; clinical_notes: string | null } | null;
}): string {
  const markers = params.markers.map((m) => ({
    test_code: m.test_code,
    marker: m.test_label,
    value: m.result_value,
    unit: m.result_unit,
    reference_range: m.reference_range,
    flag: m.flag,
  }));

  return [
    "Interpret structured blood pathology markers for a hair-loss / hair-restoration clinic.",
    "This is clinical decision support only and must be reviewed by the treating clinician.",
    "Do not diagnose. Do not state that the patient has a condition. Use hedged language such as may suggest, could contribute, consider clinical review, and doctor review required.",
    "Focus on hair-loss relevance and surgical readiness categories: iron/ferritin, thyroid, vitamins/minerals (vitamin D, B12, folate, zinc), inflammation/infection markers, metabolic health, and hormones where present.",
    "Only use markers provided below. If an important marker is absent, list it in missing_markers; do not invent values.",
    "Include the exact disclaimer sentence in both summaries: This interpretation is clinical decision support only and must be reviewed by the treating clinician.",
    "Return JSON only matching this exact shape; no markdown, no comments, no diagnosis framing:",
    shapePrompt(),
    "",
    "Patient/context:",
    JSON.stringify(
      {
        patient_display_name: params.patientDisplayName,
        result_date: params.result.result_date,
        provider_name: params.result.provider_name,
        result_clinical_summary: params.result.clinical_summary,
        linked_request: params.linkedRequest,
      },
      null,
      2
    ),
    "",
    "Markers:",
    JSON.stringify(markers, null, 2),
  ].join("\n");
}

async function loadGenerationContext(supabase: SupabaseClient, tenantId: string, patientId: string, resultId: string) {
  const { data: resultRow, error: re } = await supabase
    .from("fi_pathology_results")
    .select("id, tenant_id, patient_id, pathology_request_id, result_date, provider_name, clinical_summary")
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .eq("id", resultId)
    .maybeSingle();
  if (re) throw new Error(re.message);
  if (!resultRow) throw new Error("Pathology result not found.");

  const r = resultRow as Record<string, unknown>;
  const result: ResultHeader = {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    patient_id: String(r.patient_id),
    pathology_request_id: r.pathology_request_id != null ? String(r.pathology_request_id) : null,
    result_date: String(r.result_date ?? "").slice(0, 10),
    provider_name: r.provider_name != null ? String(r.provider_name) : null,
    clinical_summary: r.clinical_summary != null ? String(r.clinical_summary) : null,
  };

  const { data: itemRows, error: ie } = await supabase
    .from("fi_pathology_result_items")
    .select("test_code, test_label, result_value, result_unit, reference_range, flag")
    .eq("tenant_id", tenantId)
    .eq("result_id", resultId)
    .order("sort_order", { ascending: true });
  if (ie) throw new Error(ie.message);
  const markers = ((itemRows ?? []) as Record<string, unknown>[]).map((x) => ({
    test_code: x.test_code != null ? String(x.test_code) : null,
    test_label: String(x.test_label ?? ""),
    result_value: String(x.result_value ?? ""),
    result_unit: x.result_unit != null ? String(x.result_unit) : null,
    reference_range: x.reference_range != null ? String(x.reference_range) : null,
    flag: String(x.flag ?? "unknown"),
  }));
  if (markers.length === 0) throw new Error("No structured result markers are available for AI interpretation.");

  let patientDisplayName: string | null = null;
  const { data: patRow, error: pe } = await supabase.from("fi_patients").select("person_id").eq("tenant_id", tenantId).eq("id", patientId).maybeSingle();
  if (pe) throw new Error(pe.message);
  const personId = patRow ? String((patRow as { person_id: string }).person_id) : "";
  if (personId) {
    const { data: personRow } = await supabase.from("fi_persons").select("metadata").eq("tenant_id", tenantId).eq("id", personId).maybeSingle();
    const meta =
      personRow && typeof (personRow as { metadata: unknown }).metadata === "object" && !Array.isArray((personRow as { metadata: unknown }).metadata)
        ? ((personRow as { metadata: Record<string, unknown> }).metadata ?? {})
        : {};
    patientDisplayName = displayFromPersonMetadata(meta).name;
  }

  let linkedRequest: { request_date: string; template_used: string; clinical_notes: string | null } | null = null;
  if (result.pathology_request_id) {
    const { data: rq } = await supabase
      .from("fi_pathology_requests")
      .select("request_date, template_used, clinical_notes")
      .eq("tenant_id", tenantId)
      .eq("patient_id", patientId)
      .eq("id", result.pathology_request_id)
      .maybeSingle();
    if (rq) {
      const x = rq as Record<string, unknown>;
      linkedRequest = {
        request_date: String(x.request_date ?? "").slice(0, 10),
        template_used: String(x.template_used ?? ""),
        clinical_notes: x.clinical_notes != null ? String(x.clinical_notes) : null,
      };
    }
  }

  return { result, markers, patientDisplayName, linkedRequest };
}

async function callOpenAiForInterpretation(prompt: string): Promise<{ interpretation: PathologyAiInterpretationJson; model: string }> {
  const key = requireOpenAiKey();
  const model = modelName();
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a clinical decision support assistant for licensed hair-restoration clinicians. Return strict JSON only. Do not diagnose.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const raw = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(raw.error?.message?.trim() || `OpenAI chat HTTP ${res.status}`);
  }
  const content = raw.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenAI returned an empty pathology interpretation.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new Error("OpenAI returned non-JSON pathology interpretation content.");
  }

  const parsed = pathologyAiInterpretationJsonSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(`OpenAI pathology interpretation failed schema validation: ${parsed.error.issues[0]?.message ?? "invalid JSON"}`);
  }
  return { interpretation: parsed.data, model };
}

async function appendAiActivity(params: {
  tenantId: string;
  patientId: string;
  kind: "generated" | "reviewed" | "archived";
  interpretation: PathologyAiInterpretationRow;
}) {
  const activityKind = `pathology.ai_interpretation.${params.kind}`;
  const title =
    params.kind === "generated"
      ? "AI blood interpretation generated"
      : params.kind === "reviewed"
        ? "AI blood interpretation reviewed"
        : "AI blood interpretation archived";
  await appendCrmActivityEvent({
    tenantId: params.tenantId,
    patientId: params.patientId,
    activityKind,
    title,
    detail: {
      pathology_result_id: params.interpretation.pathology_result_id,
      pathology_ai_interpretation_id: params.interpretation.id,
      hair_loss_relevance_score: params.interpretation.hair_loss_relevance_score,
      surgical_readiness_score: params.interpretation.surgical_readiness_score,
      major_risk_flags_count: params.interpretation.interpretation_json.risk_flags.length,
    },
  });
}

export async function generatePathologyAiInterpretation(
  tenantId: string,
  patientId: string,
  resultId: string,
  actingUserId: string | null,
  client?: SupabaseClient
): Promise<PathologyAiInterpretationRow> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const rid = resultId.trim();
  const context = await loadGenerationContext(supabase, tid, pid, rid);
  const prompt = buildPrompt(context);
  const { interpretation, model } = await callOpenAiForInterpretation(prompt);
  const surgicalReadinessScore = maybeNumber(interpretation.surgery_readiness.score);
  const hairLossRelevanceScore = maybeNumber(interpretation.hair_loss_relevance_score);

  const { data, error } = await supabase
    .from("fi_pathology_ai_interpretations")
    .insert({
      tenant_id: tid,
      patient_id: pid,
      pathology_result_id: rid,
      status: "draft",
      model_name: model,
      interpretation_json: interpretation,
      doctor_summary: interpretation.clinician_summary.trim() || null,
      patient_friendly_summary: interpretation.patient_friendly_summary.trim() || null,
      clinical_flags: interpretation.risk_flags,
      treatment_recommendations: [
        ...interpretation.treatment_considerations,
        ...interpretation.supplement_considerations,
        ...interpretation.medication_considerations,
      ],
      surgical_readiness_score: surgicalReadinessScore,
      hair_loss_relevance_score: hairLossRelevanceScore,
      reviewed_by_user_id: null,
      reviewed_at: null,
      // Generator identity belongs in `metadata`; `reviewed_by_user_id` is reserved for clinician review.
      metadata: { generated_by_user_id: actingUserId },
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const row = mapPathologyAiInterpretationRow(data as Record<string, unknown>);
  await appendAiActivity({ tenantId: tid, patientId: pid, kind: "generated", interpretation: row });
  return row;
}

async function resolveInterpretation(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  resultId: string,
  interpretationId?: string | null
): Promise<PathologyAiInterpretationRow> {
  let q = supabase
    .from("fi_pathology_ai_interpretations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .eq("pathology_result_id", resultId);
  if (interpretationId?.trim()) {
    q = q.eq("id", interpretationId.trim());
  } else {
    q = q.neq("status", "archived").order("created_at", { ascending: false }).limit(1);
  }
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("AI interpretation not found.");
  return mapPathologyAiInterpretationRow(data as Record<string, unknown>);
}

export async function updatePathologyAiInterpretationSummaries(
  tenantId: string,
  patientId: string,
  resultId: string,
  patch: { interpretationId?: string | null; doctorSummary: string | null; patientFriendlySummary: string | null },
  client?: SupabaseClient
): Promise<PathologyAiInterpretationRow> {
  const supabase = client ?? supabaseAdmin();
  const current = await resolveInterpretation(supabase, tenantId.trim(), patientId.trim(), resultId.trim(), patch.interpretationId);
  if (current.status === "archived") throw new Error("Archived AI interpretations cannot be edited.");

  const { data, error } = await supabase
    .from("fi_pathology_ai_interpretations")
    .update({
      doctor_summary: patch.doctorSummary?.trim() ? patch.doctorSummary.trim() : null,
      patient_friendly_summary: patch.patientFriendlySummary?.trim() ? patch.patientFriendlySummary.trim() : null,
    })
    .eq("tenant_id", tenantId.trim())
    .eq("id", current.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapPathologyAiInterpretationRow(data as Record<string, unknown>);
}

export async function markPathologyAiInterpretationReviewed(
  tenantId: string,
  patientId: string,
  resultId: string,
  interpretationId: string | null,
  actingUserId: string | null,
  client?: SupabaseClient
): Promise<PathologyAiInterpretationRow> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const current = await resolveInterpretation(supabase, tid, pid, resultId.trim(), interpretationId);
  if (current.status === "archived") throw new Error("Archived AI interpretations cannot be marked reviewed.");
  const { data, error } = await supabase
    .from("fi_pathology_ai_interpretations")
    .update({ status: "doctor_reviewed", reviewed_at: new Date().toISOString(), reviewed_by_user_id: actingUserId })
    .eq("tenant_id", tid)
    .eq("id", current.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const row = mapPathologyAiInterpretationRow(data as Record<string, unknown>);
  await appendAiActivity({ tenantId: tid, patientId: pid, kind: "reviewed", interpretation: row });
  return row;
}

export async function archivePathologyAiInterpretation(
  tenantId: string,
  patientId: string,
  resultId: string,
  interpretationId: string | null,
  client?: SupabaseClient
): Promise<PathologyAiInterpretationRow> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const current = await resolveInterpretation(supabase, tid, pid, resultId.trim(), interpretationId);
  if (current.status === "archived") return current;
  const { data, error } = await supabase
    .from("fi_pathology_ai_interpretations")
    .update({ status: "archived" })
    .eq("tenant_id", tid)
    .eq("id", current.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const row = mapPathologyAiInterpretationRow(data as Record<string, unknown>);
  await appendAiActivity({ tenantId: tid, patientId: pid, kind: "archived", interpretation: row });
  return row;
}
