import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createDraftTherapyPlan,
  validateTherapyCanonicalCodes,
} from "./medicationOsMutations.server";
import type { TherapyTimelineMirrorOutcome } from "./medicationOsTimeline.server";
import { toPatientTherapyEventRow, toPatientTherapyPlanRow } from "./medicationOsMappers";
import { loadTherapyPlanById } from "./medicationOsLoaders.server";
import {
  DEFAULT_SURGERY_POSTOP_MEDICATION_BUNDLE_V1,
  SURGERY_POSTOP_BUNDLE_PLAN_METADATA,
  SURGERY_POSTOP_BUNDLE_PLAN_TITLE,
  buildSurgeryPostopMedicationDryRunModel,
  postopBundleTemplateLinesToDraftItems,
} from "./postopMedicationBundles";
import type {
  PatientTherapyEventRow,
  PatientTherapyPlanItemRow,
  PatientTherapyPlanRow,
} from "./medicationOsTypes";
import { PATIENT_THERAPY_EVENT_SELECT, PATIENT_THERAPY_PLAN_SELECT } from "./medicationOsTypes";

export type InstantiateSurgeryPostopMedicationBundleOptions = {
  supabase: SupabaseClient;
  tenantId: string;
  patientId: string;
  caseId: string;
  surgeryPlanId?: string | null;
  consultationId?: string | null;
  actorUserId?: string | null;
  surgeryAnchorDate: string;
  dryRun?: boolean;
};

export type InstantiateSurgeryPostopMedicationBundleResult =
  | {
      status: "existing";
      plan: PatientTherapyPlanRow;
      items: PatientTherapyPlanItemRow[];
      event: null;
      therapyTimelineMirror: null;
    }
  | {
      status: "created";
      plan: PatientTherapyPlanRow;
      items: PatientTherapyPlanItemRow[];
      event: PatientTherapyEventRow;
      therapyTimelineMirror: TherapyTimelineMirrorOutcome;
    }
  | ReturnType<typeof buildSurgeryPostopMedicationDryRunModel>;

async function findExistingNonCancelledPostopBundlePlan(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    patientId: string;
    caseId: string;
    surgeryPlanId: string | null;
  }
): Promise<PatientTherapyPlanRow | null> {
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();
  const cid = params.caseId.trim();
  let q = supabase
    .from("fi_patient_therapy_plans")
    .select(PATIENT_THERAPY_PLAN_SELECT)
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("case_id", cid)
    .eq("plan_type", "post_operative")
    .eq("source", "surgery_postop_bundle")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1);
  if (params.surgeryPlanId) {
    q = q.eq("surgery_plan_id", params.surgeryPlanId);
  } else {
    q = q.is("surgery_plan_id", null);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return toPatientTherapyPlanRow(row as Record<string, unknown>);
}

async function loadLatestPlanCreatedEvent(
  supabase: SupabaseClient,
  tenantId: string,
  planId: string
): Promise<PatientTherapyEventRow> {
  const tid = tenantId.trim();
  const plan = planId.trim();
  const { data, error } = await supabase
    .from("fi_patient_therapy_events")
    .select(PATIENT_THERAPY_EVENT_SELECT)
    .eq("tenant_id", tid)
    .eq("plan_id", plan)
    .eq("event_type", "plan_created")
    .order("occurred_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const raw = data?.[0];
  if (!raw) throw new Error("Expected plan_created therapy event after draft plan insert.");
  return toPatientTherapyEventRow(raw as Record<string, unknown>);
}

/**
 * Creates a draft post-operative MedicationOS therapy plan from the default in-code bundle,
 * or returns an existing non-cancelled plan for the same idempotency key. No prescribing side effects.
 */
export async function instantiateSurgeryPostopMedicationBundle(
  options: InstantiateSurgeryPostopMedicationBundleOptions
): Promise<InstantiateSurgeryPostopMedicationBundleResult> {
  const tid = options.tenantId.trim();
  const pid = options.patientId.trim();
  const cid = options.caseId.trim();
  const surgeryPlanKey = options.surgeryPlanId?.trim() || null;

  await validateTherapyCanonicalCodes(
    options.supabase,
    tid,
    DEFAULT_SURGERY_POSTOP_MEDICATION_BUNDLE_V1.map((l) => l.canonical_code)
  );

  if (options.dryRun) {
    return buildSurgeryPostopMedicationDryRunModel({
      tenantId: tid,
      patientId: pid,
      caseId: cid,
      surgeryPlanId: surgeryPlanKey,
      consultationId: options.consultationId,
      surgeryAnchorDate: options.surgeryAnchorDate,
    });
  }

  const existingHeader = await findExistingNonCancelledPostopBundlePlan(options.supabase, {
    tenantId: tid,
    patientId: pid,
    caseId: cid,
    surgeryPlanId: surgeryPlanKey,
  });
  if (existingHeader) {
    const bundle = await loadTherapyPlanById(options.supabase, tid, existingHeader.id, {
      includeItems: true,
    });
    if (!bundle) throw new Error("Existing post-op bundle plan not found after header match.");
    return {
      status: "existing",
      plan: bundle.plan,
      items: bundle.items,
      event: null,
      therapyTimelineMirror: null,
    };
  }

  const items = postopBundleTemplateLinesToDraftItems();

  const { plan, therapyTimelineMirrors } = await createDraftTherapyPlan(options.supabase, {
    tenantId: tid,
    patientId: pid,
    actor_user_id: options.actorUserId ?? null,
    plan_type: "post_operative",
    title: SURGERY_POSTOP_BUNDLE_PLAN_TITLE,
    source: "surgery_postop_bundle",
    case_id: cid,
    consultation_id: options.consultationId?.trim() || null,
    surgery_plan_id: surgeryPlanKey,
    surgery_anchor_date: options.surgeryAnchorDate.trim(),
    metadata: { ...SURGERY_POSTOP_BUNDLE_PLAN_METADATA },
    items,
  });

  const full = await loadTherapyPlanById(options.supabase, tid, plan.id, { includeItems: true });
  if (!full) throw new Error("Therapy plan not found immediately after create.");
  const event = await loadLatestPlanCreatedEvent(options.supabase, tid, plan.id);
  const therapyTimelineMirror = therapyTimelineMirrors[0];
  if (!therapyTimelineMirror) {
    throw new Error("Expected therapy timeline mirror outcome from createDraftTherapyPlan.");
  }

  return {
    status: "created",
    plan: full.plan,
    items: full.items,
    event,
    therapyTimelineMirror,
  };
}
