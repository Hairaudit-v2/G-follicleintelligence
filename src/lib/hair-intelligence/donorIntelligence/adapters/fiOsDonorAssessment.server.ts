import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assessDonor } from "../assessDonor.server";
import type { DonorAssessmentModelResult } from "../types";

export type AssessFiOsPatientDonorParams = {
  tenantId: string;
  patientImageId: string;
  client?: SupabaseClient;
};

export type AssessFiOsPatientDonorResult = {
  result: DonorAssessmentModelResult;
  assessorVersion: string;
  usedOpenAi: boolean;
  persistedId: string;
};

async function latestDonorImageClassificationIdForFiPatientImage(
  supabase: SupabaseClient,
  patientImageId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("hli_image_classifications")
    .select("id")
    .eq("source_system", "fi_os")
    .eq("source_record_id", patientImageId)
    .eq("image_category", "donor")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return String((data as { id: string }).id);
}

async function latestHairLossClassificationIdForPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("hair_intelligence_hair_loss_classifications")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return String((data as { id: string }).id);
}

/**
 * FI OS: tenant-scoped patient image, signed URL resolution inside `assessDonor`, links donor HLI row + latest hair loss when present.
 */
export async function assessFiOsPatientDonorAndPersist(
  params: AssessFiOsPatientDonorParams
): Promise<AssessFiOsPatientDonorResult> {
  const supabase = params.client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  const iid = params.patientImageId.trim();

  const { data: row, error } = await supabase
    .from("fi_patient_images")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", iid)
    .eq("image_status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Patient image not found.");

  const mapped = row as Record<string, unknown>;
  const patientId = mapped.patient_id != null ? String(mapped.patient_id) : null;
  const caseId = mapped.case_id != null ? String(mapped.case_id) : null;

  const imageClassificationId = await latestDonorImageClassificationIdForFiPatientImage(supabase, iid);
  const hairLossClassificationId =
    patientId != null ? await latestHairLossClassificationIdForPatient(supabase, tid, patientId) : null;

  const { result, assessorVersion, usedOpenAi, persisted } = await assessDonor({
      source_system: "fi_os",
      source_record_id: iid,
      tenant_id: tid,
      patient_id: patientId,
      case_id: caseId,
      image_classification_id: imageClassificationId,
      hair_loss_classification_id: hairLossClassificationId,
      patient_image_id: iid,
      client: supabase,
    });

  return { result, assessorVersion, usedOpenAi, persistedId: persisted.id };
}
