import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildHairProgressionIntelligence,
  HAIR_PROGRESSION_ENGINE_VERSION,
  type HairProgressionIntelligence,
  type HairProgressionTherapyEventInput,
  type HairProgressionTimepointInput,
} from "@/src/lib/hair-intelligence/hairProgressionIntelligence";
import { loadPatientTherapyEventsForPatient } from "@/src/lib/medicationOs/medicationOsLoaders.server";

const TIMELINE_CAP = 150;
const THERAPY_EVENTS_CAP = 400;

export function emptyPatientTwinHairProgressionIntelligence(): HairProgressionIntelligence {
  return buildHairProgressionIntelligence({
    engineVersion: HAIR_PROGRESSION_ENGINE_VERSION,
    timelineCap: TIMELINE_CAP,
    timepointsRaw: [],
  });
}

function mapClassificationRow(x: Record<string, unknown>): HairProgressionTimepointInput {
  return {
    id: String(x.id),
    created_at: String(x.created_at ?? ""),
    classification_system: String(x.classification_system ?? ""),
    pattern_type: String(x.pattern_type ?? ""),
    classification_grade: String(x.classification_grade ?? ""),
    confidence_score:
      typeof x.confidence_score === "number" ? x.confidence_score : Number(x.confidence_score ?? 0),
    review_status: String(x.review_status ?? "pending"),
    sex_classification: x.sex_classification != null ? String(x.sex_classification) : null,
    diffuse_thinning_score:
      x.diffuse_thinning_score != null ? Number(x.diffuse_thinning_score) : null,
  };
}

async function loadLatestNetworkBucketForCohort(
  supabase: SupabaseClient,
  cohortSignature: string
): Promise<{ week_bucket: string; sample_count: number; mean_velocity: number | null } | null> {
  const sig = cohortSignature.trim();
  if (!sig) return null;
  const { data, error } = await supabase
    .from("hair_intelligence_progression_network_buckets")
    .select("week_bucket, sample_count, mean_velocity")
    .eq("cohort_signature", sig)
    .order("week_bucket", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    const m = error.message ?? "";
    if (m.includes("does not exist") || m.includes("schema cache")) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    week_bucket: String(row.week_bucket ?? "").slice(0, 10),
    sample_count: Number(row.sample_count ?? 0),
    mean_velocity:
      row.mean_velocity != null && Number.isFinite(Number(row.mean_velocity))
        ? Number(row.mean_velocity)
        : null,
  };
}

/**
 * Longitudinal hair-loss progression analytics for Patient Twin (classification ledger + MedicationOS).
 */
export async function loadPatientTwinHairProgressionSection(
  tenantId: string,
  patientId: string,
  opts: { patientDateOfBirthIso?: string | null; patientSexClassification?: string | null },
  client?: SupabaseClient
): Promise<HairProgressionIntelligence> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();

  const [{ data: clsRows, error: clsErr }, therapyEvents] = await Promise.all([
    supabase
      .from("hair_intelligence_hair_loss_classifications")
      .select(
        "id, created_at, classification_system, pattern_type, classification_grade, confidence_score, review_status, sex_classification, diffuse_thinning_score"
      )
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .order("created_at", { ascending: true })
      .limit(TIMELINE_CAP),
    loadPatientTherapyEventsForPatient(supabase, tid, pid, { limit: THERAPY_EVENTS_CAP }).catch(
      () => []
    ),
  ]);

  if (clsErr) {
    const m = clsErr.message ?? "";
    if (m.includes("does not exist") || m.includes("schema cache")) {
      return buildHairProgressionIntelligence({
        engineVersion: HAIR_PROGRESSION_ENGINE_VERSION,
        timelineCap: TIMELINE_CAP,
        timepointsRaw: [],
        patientDateOfBirthIso: opts.patientDateOfBirthIso ?? null,
        patientSexClassification: opts.patientSexClassification ?? null,
      });
    }
    throw new Error(clsErr.message);
  }

  const timepointsRaw = (clsRows ?? []).map((r) =>
    mapClassificationRow(r as Record<string, unknown>)
  );
  const therapyMapped: HairProgressionTherapyEventInput[] = (therapyEvents ?? []).map((e) => ({
    occurred_at: e.occurred_at,
    event_type: e.event_type,
    canonical_code: e.canonical_code,
  }));

  const draft = buildHairProgressionIntelligence({
    engineVersion: HAIR_PROGRESSION_ENGINE_VERSION,
    timelineCap: TIMELINE_CAP,
    timepointsRaw,
    therapyEvents: therapyMapped,
    patientDateOfBirthIso: opts.patientDateOfBirthIso ?? null,
    patientSexClassification: opts.patientSexClassification ?? null,
  });

  let networkBucket: {
    week_bucket: string;
    sample_count: number;
    mean_velocity: number | null;
  } | null = null;
  try {
    networkBucket = await loadLatestNetworkBucketForCohort(
      supabase,
      draft.cohort_context.cohort_signature
    );
  } catch {
    networkBucket = null;
  }

  if (!networkBucket) return draft;

  return buildHairProgressionIntelligence({
    engineVersion: HAIR_PROGRESSION_ENGINE_VERSION,
    timelineCap: TIMELINE_CAP,
    timepointsRaw,
    therapyEvents: therapyMapped,
    patientDateOfBirthIso: opts.patientDateOfBirthIso ?? null,
    patientSexClassification: opts.patientSexClassification ?? null,
    networkBucket,
  });
}
