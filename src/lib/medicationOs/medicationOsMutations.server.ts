import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadMedicationOsCanonicalForTenant, loadTherapyPlanById } from "./medicationOsLoaders.server";
import {
  mirrorTherapyEventRowToTimeline,
  type TherapyTimelineMirrorOutcome,
} from "./medicationOsTimeline.server";
import {
  assertCanonicalCodesAllowed,
  assertPlanCanTransition,
  normaliseTherapyPlanItems,
  type PlanLifecycleAction,
} from "./medicationOsMutationPolicy";
import { toPatientTherapyEventRow, toPatientTherapyPlanItemRow, toPatientTherapyPlanRow } from "./medicationOsMappers";
import type {
  DraftTherapyPlanItemInput,
  PatientTherapyEventRow,
  PatientTherapyPlanItemRow,
  PatientTherapyPlanRow,
  PlanSource,
  PlanStatus,
  PlanType,
  TherapyEventType,
} from "./medicationOsTypes";
import { PATIENT_THERAPY_EVENT_SELECT, PATIENT_THERAPY_PLAN_ITEM_SELECT } from "./medicationOsTypes";

function nowIso(): string {
  return new Date().toISOString();
}

function asObjectRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

async function buildActiveCanonicalCodeSet(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Set<string>> {
  const rows = await loadMedicationOsCanonicalForTenant(supabase, tenantId);
  return new Set(rows.map((r) => r.canonical_code.trim().toLowerCase()));
}

/**
 * Validates that every non-empty canonical_code exists as an **active** row for the tenant.
 */
export async function validateTherapyCanonicalCodes(
  supabase: SupabaseClient,
  tenantId: string,
  codes: string[]
): Promise<void> {
  const set = await buildActiveCanonicalCodeSet(supabase, tenantId);
  assertCanonicalCodesAllowed(codes, set);
}

async function assertCaseMatchesPatient(
  supabase: SupabaseClient,
  tenantId: string,
  caseId: string,
  patientId: string
): Promise<void> {
  const tid = tenantId.trim();
  const cid = caseId.trim();
  const pid = patientId.trim();
  const { data, error } = await supabase
    .from("fi_cases")
    .select("id, foundation_patient_id, patient_id")
    .eq("tenant_id", tid)
    .eq("id", cid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Case not found for this tenant.");
  const row = data as { foundation_patient_id: string | null; patient_id: string | null };
  const fp = row.foundation_patient_id?.trim() || null;
  const legacy = row.patient_id?.trim() || null;
  const effective = fp || legacy;
  if (!effective || effective !== pid) {
    throw new Error("Case is not linked to this foundation patient.");
  }
}

export type AppendTherapyEventInput = {
  tenantId: string;
  patientId: string;
  event_type: TherapyEventType;
  occurred_at?: string;
  actor_user_id?: string | null;
  plan_id?: string | null;
  plan_item_id?: string | null;
  case_id?: string | null;
  consultation_id?: string | null;
  prescription_id?: string | null;
  prescription_item_id?: string | null;
  pathology_request_id?: string | null;
  pathology_result_id?: string | null;
  canonical_code?: string | null;
  detail?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type AppendTherapyEventResult = PatientTherapyEventRow & {
  therapyTimelineMirror: TherapyTimelineMirrorOutcome;
};

/**
 * Central append-only write for `fi_patient_therapy_events`.
 * Validates optional `canonical_code` against tenant active vocabulary.
 */
export async function appendTherapyEvent(
  supabase: SupabaseClient,
  input: AppendTherapyEventInput
): Promise<AppendTherapyEventResult> {
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const occurredAt = input.occurred_at?.trim() || nowIso();
  const detail = asObjectRecord(input.detail);
  const metadata = asObjectRecord(input.metadata);
  const canonical = input.canonical_code?.trim() ? input.canonical_code.trim().toLowerCase() : null;
  if (canonical) {
    await validateTherapyCanonicalCodes(supabase, tid, [canonical]);
  }

  let resolvedPlanId = input.plan_id?.trim() || null;
  const resolvedPlanItemId = input.plan_item_id?.trim() || null;
  let planBundle: Awaited<ReturnType<typeof loadTherapyPlanById>> | null = null;

  if (resolvedPlanItemId) {
    const { data: itemRow, error: itemErr } = await supabase
      .from("fi_patient_therapy_plan_items")
      .select("id, tenant_id, plan_id")
      .eq("tenant_id", tid)
      .eq("id", resolvedPlanItemId)
      .maybeSingle();
    if (itemErr) throw new Error(itemErr.message);
    if (!itemRow) throw new Error("Therapy plan item not found.");
    const itemPlanId = String((itemRow as { plan_id: string }).plan_id);
    if (resolvedPlanId && resolvedPlanId !== itemPlanId) {
      throw new Error("plan_item_id does not belong to the given plan_id.");
    }
    resolvedPlanId = itemPlanId;
  }

  if (resolvedPlanId) {
    planBundle = await loadTherapyPlanById(supabase, tid, resolvedPlanId, {
      includeItems: Boolean(resolvedPlanItemId),
    });
    if (!planBundle) throw new Error("Therapy plan not found.");
    if (planBundle.plan.patient_id !== pid) {
      throw new Error("Therapy plan patient mismatch.");
    }
    if (resolvedPlanItemId && !planBundle.items.some((it) => it.id === resolvedPlanItemId)) {
      throw new Error("plan_item_id is not on the specified plan.");
    }
  }

  if (input.prescription_id?.trim()) {
    const { data: rxRow, error: rxErr } = await supabase
      .from("fi_patient_prescriptions")
      .select("id, patient_id")
      .eq("tenant_id", tid)
      .eq("id", input.prescription_id.trim())
      .maybeSingle();
    if (rxErr) throw new Error(rxErr.message);
    if (!rxRow) throw new Error("Prescription not found for tenant.");
    if (String((rxRow as { patient_id: string }).patient_id) !== pid) {
      throw new Error("Prescription patient mismatch for therapy event.");
    }
  }

  const insertRow = {
    tenant_id: tid,
    patient_id: pid,
    case_id: input.case_id?.trim() || null,
    consultation_id: input.consultation_id?.trim() || null,
    plan_id: resolvedPlanId,
    plan_item_id: resolvedPlanItemId,
    prescription_id: input.prescription_id?.trim() || null,
    prescription_item_id: input.prescription_item_id?.trim() || null,
    pathology_request_id: input.pathology_request_id?.trim() || null,
    pathology_result_id: input.pathology_result_id?.trim() || null,
    event_type: input.event_type,
    canonical_code: canonical,
    occurred_at: occurredAt,
    actor_user_id: input.actor_user_id?.trim() || null,
    detail,
    metadata,
  };

  const { data: created, error } = await supabase
    .from("fi_patient_therapy_events")
    .insert(insertRow)
    .select(PATIENT_THERAPY_EVENT_SELECT)
    .single();
  if (error) throw new Error(error.message);
  const row = toPatientTherapyEventRow(created as Record<string, unknown>);
  const planTypeForCompleted =
    row.event_type === "plan_completed" ? planBundle?.plan.plan_type ?? null : null;
  const therapyTimelineMirror = await mirrorTherapyEventRowToTimeline(supabase, {
    tenantId: tid,
    patientId: pid,
    caseId: row.case_id ?? input.case_id,
    planTypeForCompleted,
    row,
  });
  return { ...row, therapyTimelineMirror };
}

async function replacePlanItems(
  supabase: SupabaseClient,
  tenantId: string,
  planId: string,
  normalised: ReturnType<typeof normaliseTherapyPlanItems>
): Promise<void> {
  const tid = tenantId.trim();
  const pid = planId.trim();
  const { error: dErr } = await supabase
    .from("fi_patient_therapy_plan_items")
    .delete()
    .eq("tenant_id", tid)
    .eq("plan_id", pid);
  if (dErr) throw new Error(dErr.message);
  if (!normalised.length) return;
  const rows = normalised.map((it) => ({
    tenant_id: tid,
    plan_id: pid,
    canonical_code: it.canonical_code,
    role: it.role,
    dosing_summary: it.dosing_summary,
    sessions_planned: it.sessions_planned,
    sessions_completed: it.sessions_completed,
    day_offset_start: it.day_offset_start,
    day_offset_end: it.day_offset_end,
    pathology_gate: it.pathology_gate,
    sort_order: it.sort_order,
    metadata: it.metadata,
  }));
  const { error: iErr } = await supabase.from("fi_patient_therapy_plan_items").insert(rows);
  if (iErr) throw new Error(iErr.message);
}

async function revertPlanStatus(
  supabase: SupabaseClient,
  tenantId: string,
  planId: string,
  previousStatus: PlanStatus
): Promise<void> {
  const ts = nowIso();
  const { error } = await supabase
    .from("fi_patient_therapy_plans")
    .update({ status: previousStatus, updated_at: ts })
    .eq("tenant_id", tenantId.trim())
    .eq("id", planId.trim())
    .select("id");
  if (error) throw new Error(`Failed to revert plan status after event error: ${error.message}`);
}

export type CreateDraftTherapyPlanInput = {
  tenantId: string;
  patientId: string;
  actor_user_id?: string | null;
  plan_type: PlanType;
  title: string;
  source: PlanSource;
  case_id?: string | null;
  consultation_id?: string | null;
  surgery_plan_id?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  surgery_anchor_date?: string | null;
  metadata?: Record<string, unknown>;
  items: DraftTherapyPlanItemInput[];
};

export async function createDraftTherapyPlan(
  supabase: SupabaseClient,
  input: CreateDraftTherapyPlanInput
): Promise<{ plan: PatientTherapyPlanRow; therapyTimelineMirrors: TherapyTimelineMirrorOutcome[] }> {
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  if (input.case_id?.trim()) {
    await assertCaseMatchesPatient(supabase, tid, input.case_id.trim(), pid);
  }
  const set = await buildActiveCanonicalCodeSet(supabase, tid);
  const normalised = normaliseTherapyPlanItems(input.items);
  assertCanonicalCodesAllowed(
    normalised.map((i) => i.canonical_code),
    set
  );
  const ts = nowIso();
  const meta = asObjectRecord(input.metadata);
  const { data: planRow, error: pErr } = await supabase
    .from("fi_patient_therapy_plans")
    .insert({
      tenant_id: tid,
      patient_id: pid,
      case_id: input.case_id?.trim() || null,
      consultation_id: input.consultation_id?.trim() || null,
      surgery_plan_id: input.surgery_plan_id?.trim() || null,
      plan_type: input.plan_type,
      title: input.title.trim(),
      status: "draft",
      source: input.source,
      valid_from: input.valid_from?.trim() || null,
      valid_until: input.valid_until?.trim() || null,
      surgery_anchor_date: input.surgery_anchor_date?.trim() || null,
      metadata: meta,
      created_at: ts,
      updated_at: ts,
    })
    .select("*")
    .single();
  if (pErr || !planRow) {
    throw new Error(pErr?.message ?? "Failed to create therapy plan.");
  }
  const plan = toPatientTherapyPlanRow(planRow as Record<string, unknown>);
  try {
    await replacePlanItems(supabase, tid, plan.id, normalised);
  } catch (e) {
    await supabase.from("fi_patient_therapy_plans").delete().eq("tenant_id", tid).eq("id", plan.id);
    throw e;
  }
  try {
    const appendResult = await appendTherapyEvent(supabase, {
      tenantId: tid,
      patientId: pid,
      plan_id: plan.id,
      case_id: plan.case_id,
      consultation_id: plan.consultation_id,
      event_type: "plan_created",
      actor_user_id: input.actor_user_id ?? null,
      detail: { title: plan.title, plan_type: plan.plan_type },
    });
    return { plan, therapyTimelineMirrors: [appendResult.therapyTimelineMirror] };
  } catch (e) {
    await supabase.from("fi_patient_therapy_plan_items").delete().eq("tenant_id", tid).eq("plan_id", plan.id);
    await supabase.from("fi_patient_therapy_plans").delete().eq("tenant_id", tid).eq("id", plan.id);
    throw e;
  }
}

export type UpdateDraftTherapyPlanInput = {
  tenantId: string;
  planId: string;
  actor_user_id?: string | null;
  plan_type?: PlanType;
  title?: string;
  case_id?: string | null;
  consultation_id?: string | null;
  surgery_plan_id?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  surgery_anchor_date?: string | null;
  metadata?: Record<string, unknown>;
  items?: DraftTherapyPlanItemInput[];
};

export async function updateDraftTherapyPlan(
  supabase: SupabaseClient,
  input: UpdateDraftTherapyPlanInput
): Promise<{ plan: PatientTherapyPlanRow }> {
  const tid = input.tenantId.trim();
  const bundle = await loadTherapyPlanById(supabase, tid, input.planId.trim(), { includeItems: true });
  if (!bundle) throw new Error("Therapy plan not found.");
  if (bundle.plan.status !== "draft") {
    throw new Error("Only draft therapy plans can be updated.");
  }
  const pid = bundle.plan.patient_id;
  if (input.case_id !== undefined && input.case_id?.trim()) {
    await assertCaseMatchesPatient(supabase, tid, input.case_id.trim(), pid);
  }
  const patch: Record<string, unknown> = { updated_at: nowIso() };
  if (input.plan_type != null) patch.plan_type = input.plan_type;
  if (input.title != null) patch.title = input.title.trim();
  if (input.case_id !== undefined) patch.case_id = input.case_id?.trim() || null;
  if (input.consultation_id !== undefined) patch.consultation_id = input.consultation_id?.trim() || null;
  if (input.surgery_plan_id !== undefined) patch.surgery_plan_id = input.surgery_plan_id?.trim() || null;
  if (input.valid_from !== undefined) patch.valid_from = input.valid_from?.trim() || null;
  if (input.valid_until !== undefined) patch.valid_until = input.valid_until?.trim() || null;
  if (input.surgery_anchor_date !== undefined) patch.surgery_anchor_date = input.surgery_anchor_date?.trim() || null;
  if (input.metadata !== undefined) patch.metadata = asObjectRecord(input.metadata);

  const { data: patchRows, error: uErr } = await supabase
    .from("fi_patient_therapy_plans")
    .update(patch)
    .eq("tenant_id", tid)
    .eq("id", bundle.plan.id)
    .eq("status", "draft")
    .select("id");
  if (uErr) throw new Error(uErr.message);
  if (!patchRows?.length) {
    throw new Error("Draft therapy plan could not be updated (no longer draft or not found).");
  }

  if (input.items) {
    const set = await buildActiveCanonicalCodeSet(supabase, tid);
    const normalised = normaliseTherapyPlanItems(input.items);
    assertCanonicalCodesAllowed(
      normalised.map((i) => i.canonical_code),
      set
    );
    await replacePlanItems(supabase, tid, bundle.plan.id, normalised);
  }

  const refreshed = await loadTherapyPlanById(supabase, tid, bundle.plan.id, { includeItems: false });
  if (!refreshed) throw new Error("Therapy plan not found after update.");
  return { plan: refreshed.plan };
}

async function transitionPlanWithEvent(params: {
  supabase: SupabaseClient;
  tenantId: string;
  planId: string;
  nextStatus: PlanStatus;
  event_type: TherapyEventType;
  actor_user_id?: string | null;
  assertAction: PlanLifecycleAction;
  detail?: Record<string, unknown>;
}): Promise<{ plan: PatientTherapyPlanRow; therapyTimelineMirrors: TherapyTimelineMirrorOutcome[] }> {
  const tid = params.tenantId.trim();
  const sb = params.supabase;
  const bundle = await loadTherapyPlanById(sb, tid, params.planId.trim(), { includeItems: false });
  if (!bundle) throw new Error("Therapy plan not found.");
  assertPlanCanTransition(bundle.plan.status, params.assertAction);
  const previous = bundle.plan.status;
  const ts = nowIso();
  const { data: updatedRows, error: uErr } = await sb
    .from("fi_patient_therapy_plans")
    .update({ status: params.nextStatus, updated_at: ts })
    .eq("tenant_id", tid)
    .eq("id", bundle.plan.id)
    .eq("status", previous)
    .select("id");
  if (uErr) throw new Error(uErr.message);
  if (!updatedRows?.length) {
    throw new Error("Therapy plan status could not be updated (concurrent change or invalid state).");
  }
  try {
    const appendResult = await appendTherapyEvent(sb, {
      tenantId: tid,
      patientId: bundle.plan.patient_id,
      plan_id: bundle.plan.id,
      case_id: bundle.plan.case_id,
      consultation_id: bundle.plan.consultation_id,
      event_type: params.event_type,
      actor_user_id: params.actor_user_id ?? null,
      detail: params.detail ?? { from_status: previous, to_status: params.nextStatus },
    });
    const out = await loadTherapyPlanById(sb, tid, bundle.plan.id, { includeItems: false });
    if (!out) throw new Error("Therapy plan not found after transition.");
    return { plan: out.plan, therapyTimelineMirrors: [appendResult.therapyTimelineMirror] };
  } catch (e) {
    await revertPlanStatus(sb, tid, bundle.plan.id, previous);
    throw e;
  }
}

export async function activateTherapyPlan(
  supabase: SupabaseClient,
  params: { tenantId: string; planId: string; actor_user_id?: string | null }
): Promise<{ plan: PatientTherapyPlanRow; therapyTimelineMirrors: TherapyTimelineMirrorOutcome[] }> {
  return transitionPlanWithEvent({
    supabase,
    tenantId: params.tenantId,
    planId: params.planId,
    nextStatus: "active",
    event_type: "plan_activated",
    actor_user_id: params.actor_user_id,
    assertAction: "activate",
  });
}

export async function pauseTherapyPlan(
  supabase: SupabaseClient,
  params: { tenantId: string; planId: string; actor_user_id?: string | null }
): Promise<{ plan: PatientTherapyPlanRow; therapyTimelineMirrors: TherapyTimelineMirrorOutcome[] }> {
  return transitionPlanWithEvent({
    supabase,
    tenantId: params.tenantId,
    planId: params.planId,
    nextStatus: "paused",
    event_type: "plan_paused",
    actor_user_id: params.actor_user_id,
    assertAction: "pause",
  });
}

export async function resumeTherapyPlan(
  supabase: SupabaseClient,
  params: { tenantId: string; planId: string; actor_user_id?: string | null }
): Promise<{ plan: PatientTherapyPlanRow; therapyTimelineMirrors: TherapyTimelineMirrorOutcome[] }> {
  return transitionPlanWithEvent({
    supabase,
    tenantId: params.tenantId,
    planId: params.planId,
    nextStatus: "active",
    event_type: "plan_resumed",
    actor_user_id: params.actor_user_id,
    assertAction: "resume",
  });
}

export async function completeTherapyPlan(
  supabase: SupabaseClient,
  params: { tenantId: string; planId: string; actor_user_id?: string | null }
): Promise<{ plan: PatientTherapyPlanRow; therapyTimelineMirrors: TherapyTimelineMirrorOutcome[] }> {
  return transitionPlanWithEvent({
    supabase,
    tenantId: params.tenantId,
    planId: params.planId,
    nextStatus: "completed",
    event_type: "plan_completed",
    actor_user_id: params.actor_user_id,
    assertAction: "complete",
  });
}

export async function cancelTherapyPlan(
  supabase: SupabaseClient,
  params: { tenantId: string; planId: string; actor_user_id?: string | null; reason?: string | null }
): Promise<{ plan: PatientTherapyPlanRow; therapyTimelineMirrors: TherapyTimelineMirrorOutcome[] }> {
  return transitionPlanWithEvent({
    supabase,
    tenantId: params.tenantId,
    planId: params.planId,
    nextStatus: "cancelled",
    event_type: "plan_cancelled",
    actor_user_id: params.actor_user_id,
    assertAction: "cancel",
    detail: params.reason?.trim() ? { reason: params.reason.trim() } : undefined,
  });
}

export type SupersedeTherapyPlanInput = {
  tenantId: string;
  oldPlanId: string;
  actor_user_id?: string | null;
  newPlan: {
    initialStatus: Extract<PlanStatus, "draft" | "active">;
    plan_type: PlanType;
    title: string;
    source: PlanSource;
    case_id?: string | null;
    consultation_id?: string | null;
    surgery_plan_id?: string | null;
    valid_from?: string | null;
    valid_until?: string | null;
    surgery_anchor_date?: string | null;
    metadata?: Record<string, unknown>;
    items: DraftTherapyPlanItemInput[];
  };
};

export async function supersedeTherapyPlan(
  supabase: SupabaseClient,
  input: SupersedeTherapyPlanInput
): Promise<{
  oldPlan: PatientTherapyPlanRow;
  newPlan: PatientTherapyPlanRow;
  therapyTimelineMirrors: TherapyTimelineMirrorOutcome[];
}> {
  const tid = input.tenantId.trim();
  const oldBundle = await loadTherapyPlanById(supabase, tid, input.oldPlanId.trim(), { includeItems: false });
  if (!oldBundle) throw new Error("Therapy plan not found.");
  assertPlanCanTransition(oldBundle.plan.status, "supersede");
  const patientId = oldBundle.plan.patient_id;
  const caseId = input.newPlan.case_id !== undefined ? input.newPlan.case_id : oldBundle.plan.case_id;
  if (caseId?.trim()) {
    await assertCaseMatchesPatient(supabase, tid, caseId.trim(), patientId);
  }
  const set = await buildActiveCanonicalCodeSet(supabase, tid);
  const normalised = normaliseTherapyPlanItems(input.newPlan.items);
  assertCanonicalCodesAllowed(
    normalised.map((i) => i.canonical_code),
    set
  );
  const ts = nowIso();
  const newMeta = {
    ...asObjectRecord(input.newPlan.metadata),
    supersedes_plan_id: oldBundle.plan.id,
  };
  const { data: created, error: cErr } = await supabase
    .from("fi_patient_therapy_plans")
    .insert({
      tenant_id: tid,
      patient_id: patientId,
      case_id: caseId?.trim() || null,
      consultation_id: input.newPlan.consultation_id?.trim() || null,
      surgery_plan_id: input.newPlan.surgery_plan_id?.trim() || null,
      plan_type: input.newPlan.plan_type,
      title: input.newPlan.title.trim(),
      status: input.newPlan.initialStatus,
      source: input.newPlan.source,
      valid_from: input.newPlan.valid_from?.trim() || null,
      valid_until: input.newPlan.valid_until?.trim() || null,
      surgery_anchor_date: input.newPlan.surgery_anchor_date?.trim() || null,
      metadata: newMeta,
      created_at: ts,
      updated_at: ts,
    })
    .select("*")
    .single();
  if (cErr || !created) throw new Error(cErr?.message ?? "Failed to create replacement therapy plan.");
  const newPlan = toPatientTherapyPlanRow(created as Record<string, unknown>);
  const therapyTimelineMirrors: TherapyTimelineMirrorOutcome[] = [];
  try {
    await replacePlanItems(supabase, tid, newPlan.id, normalised);
  } catch (e) {
    await supabase.from("fi_patient_therapy_plans").delete().eq("tenant_id", tid).eq("id", newPlan.id);
    throw e;
  }
  try {
    const createdEv = await appendTherapyEvent(supabase, {
      tenantId: tid,
      patientId,
      plan_id: newPlan.id,
      case_id: newPlan.case_id,
      consultation_id: newPlan.consultation_id,
      event_type: "plan_created",
      actor_user_id: input.actor_user_id ?? null,
      detail: { title: newPlan.title, plan_type: newPlan.plan_type, supersedes_plan_id: oldBundle.plan.id },
    });
    therapyTimelineMirrors.push(createdEv.therapyTimelineMirror);
    if (input.newPlan.initialStatus === "active") {
      const activatedEv = await appendTherapyEvent(supabase, {
        tenantId: tid,
        patientId,
        plan_id: newPlan.id,
        case_id: newPlan.case_id,
        consultation_id: newPlan.consultation_id,
        event_type: "plan_activated",
        actor_user_id: input.actor_user_id ?? null,
        detail: { via: "supersede", initial: "active" },
      });
      therapyTimelineMirrors.push(activatedEv.therapyTimelineMirror);
    }
  } catch (e) {
    await supabase.from("fi_patient_therapy_plan_items").delete().eq("tenant_id", tid).eq("plan_id", newPlan.id);
    await supabase.from("fi_patient_therapy_events").delete().eq("tenant_id", tid).eq("plan_id", newPlan.id);
    await supabase.from("fi_patient_therapy_plans").delete().eq("tenant_id", tid).eq("id", newPlan.id);
    throw e;
  }

  const oldPrevious = oldBundle.plan.status;
  const { data: oldUpdated, error: oErr } = await supabase
    .from("fi_patient_therapy_plans")
    .update({ status: "superseded", updated_at: nowIso() })
    .eq("tenant_id", tid)
    .eq("id", oldBundle.plan.id)
    .eq("status", oldPrevious)
    .select("id");
  if (oErr) {
    /** Best-effort rollback of new plan if old plan could not be superseded. */
    await supabase.from("fi_patient_therapy_plan_items").delete().eq("tenant_id", tid).eq("plan_id", newPlan.id);
    await supabase.from("fi_patient_therapy_events").delete().eq("tenant_id", tid).eq("plan_id", newPlan.id);
    await supabase.from("fi_patient_therapy_plans").delete().eq("tenant_id", tid).eq("id", newPlan.id);
    throw new Error(oErr.message);
  }
  if (!oldUpdated?.length) {
    await supabase.from("fi_patient_therapy_plan_items").delete().eq("tenant_id", tid).eq("plan_id", newPlan.id);
    await supabase.from("fi_patient_therapy_events").delete().eq("tenant_id", tid).eq("plan_id", newPlan.id);
    await supabase.from("fi_patient_therapy_plans").delete().eq("tenant_id", tid).eq("id", newPlan.id);
    throw new Error("Could not supersede therapy plan (concurrent change or invalid state).");
  }
  try {
    const supersededEv = await appendTherapyEvent(supabase, {
      tenantId: tid,
      patientId,
      plan_id: oldBundle.plan.id,
      case_id: oldBundle.plan.case_id,
      consultation_id: oldBundle.plan.consultation_id,
      event_type: "plan_superseded",
      actor_user_id: input.actor_user_id ?? null,
      detail: { new_plan_id: newPlan.id, from_status: oldPrevious },
    });
    therapyTimelineMirrors.push(supersededEv.therapyTimelineMirror);
  } catch (e) {
    await supabase
      .from("fi_patient_therapy_plans")
      .update({ status: oldPrevious, updated_at: nowIso() })
      .eq("tenant_id", tid)
      .eq("id", oldBundle.plan.id);
    await supabase.from("fi_patient_therapy_plan_items").delete().eq("tenant_id", tid).eq("plan_id", newPlan.id);
    await supabase.from("fi_patient_therapy_events").delete().eq("tenant_id", tid).eq("plan_id", newPlan.id);
    await supabase.from("fi_patient_therapy_plans").delete().eq("tenant_id", tid).eq("id", newPlan.id);
    throw e;
  }

  const oldOut = await loadTherapyPlanById(supabase, tid, oldBundle.plan.id, { includeItems: false });
  const newOut = await loadTherapyPlanById(supabase, tid, newPlan.id, { includeItems: false });
  if (!oldOut || !newOut) throw new Error("Therapy plan reload failed after supersede.");
  return { oldPlan: oldOut.plan, newPlan: newOut.plan, therapyTimelineMirrors };
}

export type LinkTherapyPlanItemToPrescriptionInput = {
  tenantId: string;
  planItemId: string;
  prescription_id: string;
  prescription_item_id?: string | null;
  actor_user_id?: string | null;
};

export async function linkTherapyPlanItemToPrescription(
  supabase: SupabaseClient,
  input: LinkTherapyPlanItemToPrescriptionInput
): Promise<{ item: PatientTherapyPlanItemRow; therapyTimelineMirrors: TherapyTimelineMirrorOutcome[] }> {
  const tid = input.tenantId.trim();
  const itemId = input.planItemId.trim();
  const rxId = input.prescription_id.trim();
  const { data: itemRaw, error: iErr } = await supabase
    .from("fi_patient_therapy_plan_items")
    .select(PATIENT_THERAPY_PLAN_ITEM_SELECT)
    .eq("tenant_id", tid)
    .eq("id", itemId)
    .maybeSingle();
  if (iErr) throw new Error(iErr.message);
  if (!itemRaw) throw new Error("Therapy plan item not found.");
  const item = toPatientTherapyPlanItemRow(itemRaw as Record<string, unknown>);
  const bundle = await loadTherapyPlanById(supabase, tid, item.plan_id, { includeItems: false });
  if (!bundle) throw new Error("Therapy plan not found.");
  const st = bundle.plan.status;
  if (st === "cancelled" || st === "superseded" || st === "completed") {
    throw new Error("Cannot link prescription on a terminal therapy plan.");
  }
  const { data: rx, error: rErr } = await supabase
    .from("fi_patient_prescriptions")
    .select("id, tenant_id, patient_id")
    .eq("tenant_id", tid)
    .eq("id", rxId)
    .maybeSingle();
  if (rErr) throw new Error(rErr.message);
  if (!rx) throw new Error("Prescription not found for tenant.");
  const rxRow = rx as { patient_id: string };
  if (rxRow.patient_id !== bundle.plan.patient_id) {
    throw new Error("Prescription patient does not match therapy plan patient.");
  }
  const rxItemId: string | null = input.prescription_item_id?.trim() || null;
  if (rxItemId) {
    const { data: line, error: lErr } = await supabase
      .from("fi_prescription_items")
      .select("id, prescription_id")
      .eq("tenant_id", tid)
      .eq("id", rxItemId)
      .maybeSingle();
    if (lErr) throw new Error(lErr.message);
    if (!line) throw new Error("Prescription line item not found.");
    const lineRow = line as { prescription_id: string };
    if (lineRow.prescription_id !== rxId) {
      throw new Error("prescription_item_id does not belong to the given prescription_id.");
    }
  }
  const prevRx = item.prescription_id;
  const prevRxLine = item.prescription_item_id;
  const ts = nowIso();
  const { data: updated, error: uErr } = await supabase
    .from("fi_patient_therapy_plan_items")
    .update({
      prescription_id: rxId,
      prescription_item_id: rxItemId,
      updated_at: ts,
    })
    .eq("tenant_id", tid)
    .eq("id", itemId)
    .select(PATIENT_THERAPY_PLAN_ITEM_SELECT)
    .single();
  if (uErr || !updated) throw new Error(uErr?.message ?? "Failed to link prescription.");
  const outItem = toPatientTherapyPlanItemRow(updated as Record<string, unknown>);
  try {
    const appendResult = await appendTherapyEvent(supabase, {
      tenantId: tid,
      patientId: bundle.plan.patient_id,
      plan_id: bundle.plan.id,
      plan_item_id: itemId,
      prescription_id: rxId,
      prescription_item_id: rxItemId,
      event_type: "prescription_linked",
      actor_user_id: input.actor_user_id ?? null,
      detail: { prescription_id: rxId, prescription_item_id: rxItemId },
    });
    return { item: outItem, therapyTimelineMirrors: [appendResult.therapyTimelineMirror] };
  } catch (e) {
    await supabase
      .from("fi_patient_therapy_plan_items")
      .update({
        prescription_id: prevRx,
        prescription_item_id: prevRxLine,
        updated_at: nowIso(),
      })
      .eq("tenant_id", tid)
      .eq("id", itemId);
    throw e;
  }
}

export type { TherapyTimelineMirrorOutcome } from "./medicationOsTimeline.server";