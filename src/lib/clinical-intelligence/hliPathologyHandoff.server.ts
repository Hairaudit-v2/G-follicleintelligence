import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { derivePatientIdentityContact } from "@/src/lib/patients/patientIdentityContact";
import { computeAgeYearsFromDobString } from "@/src/lib/patients/patientIdentityContact";
import type { PathologyResultItemRow, PathologyResultRow } from "@/src/lib/pathology/pathologyResultTypes";
import {
  buildHliPathologyHandoffPayload,
  type HliPathologyHandoffPayload,
} from "@/src/lib/clinical-intelligence/hliPathologyHandoffCore";

export type { HliPathologyHandoffPayload } from "@/src/lib/clinical-intelligence/hliPathologyHandoffCore";

export async function buildHliPathologyHandoffForResult(
  tenantId: string,
  patientId: string,
  result: PathologyResultRow,
  items: PathologyResultItemRow[],
  client?: SupabaseClient
): Promise<HliPathologyHandoffPayload> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();

  const { data: patientRow } = await supabase
    .from("fi_patients")
    .select("id, metadata, person_id")
    .eq("tenant_id", tid)
    .eq("id", pid)
    .maybeSingle();

  let personMeta: Record<string, unknown> = {};
  if (patientRow?.person_id) {
    const { data: personRow } = await supabase
      .from("fi_persons")
      .select("metadata")
      .eq("tenant_id", tid)
      .eq("id", patientRow.person_id)
      .maybeSingle();
    if (personRow?.metadata && typeof personRow.metadata === "object") {
      personMeta = personRow.metadata as Record<string, unknown>;
    }
  }

  const patientMeta =
    patientRow?.metadata && typeof patientRow.metadata === "object"
      ? (patientRow.metadata as Record<string, unknown>)
      : {};

  const identity = derivePatientIdentityContact({
    personMetadata: personMeta,
    patientMetadata: patientMeta,
  });

  const meta = result.metadata ?? {};
  const consultationId =
    typeof meta.consultation_id === "string" ? meta.consultation_id : null;
  const surgeryCaseId = typeof meta.surgery_case_id === "string" ? meta.surgery_case_id : null;

  return buildHliPathologyHandoffPayload({
    result,
    items,
    clinicalContext: {
      sex:
        typeof meta.patient_sex === "string"
          ? meta.patient_sex
          : typeof patientMeta.sex === "string"
            ? String(patientMeta.sex)
            : null,
      age: identity.ageYears ?? computeAgeYearsFromDobString(identity.dateOfBirth),
      diagnosisContext:
        typeof meta.diagnosis_context === "string" ? meta.diagnosis_context : null,
      consultationId,
      surgeryCaseId,
      medicationContext:
        typeof meta.medication_context === "string" ? meta.medication_context : null,
    },
  });
}

/** Persist handoff snapshot on result metadata for downstream HLI scoring (best-effort). */
export async function persistHliPathologyHandoffSnapshot(
  tenantId: string,
  resultId: string,
  payload: HliPathologyHandoffPayload,
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const { data: cur } = await supabase
    .from("fi_pathology_results")
    .select("metadata")
    .eq("tenant_id", tenantId.trim())
    .eq("id", resultId.trim())
    .maybeSingle();
  const prev =
    cur?.metadata && typeof cur.metadata === "object" && !Array.isArray(cur.metadata)
      ? (cur.metadata as Record<string, unknown>)
      : {};
  await supabase
    .from("fi_pathology_results")
    .update({
      metadata: {
        ...prev,
        hli_pathology_handoff: payload,
        hli_pathology_handoff_at: new Date().toISOString(),
      },
    })
    .eq("tenant_id", tenantId.trim())
    .eq("id", resultId.trim());
}
