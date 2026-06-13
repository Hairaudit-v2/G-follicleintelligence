import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assessRecipient } from "../assessRecipient.server";
import type { RecipientAssessmentModelResult } from "../types";

export type AssessFiOsPatientRecipientParams = {
  tenantId: string;
  patientImageId: string;
  client?: SupabaseClient;
};

export type AssessFiOsPatientRecipientResult = {
  result: RecipientAssessmentModelResult;
  assessorVersion: string;
  usedOpenAi: boolean;
  persistedId: string;
};

/**
 * FI OS: tenant-scoped patient image; shared `assessRecipient` loads hair loss, donor, progression, therapy, pathology flag.
 */
export async function assessFiOsPatientRecipientAndPersist(
  params: AssessFiOsPatientRecipientParams
): Promise<AssessFiOsPatientRecipientResult> {
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

  const { result, assessorVersion, usedOpenAi, persisted } = await assessRecipient({
    source_system: "fi_os",
    source_record_id: iid,
    tenant_id: tid,
    patient_id: patientId,
    case_id: caseId,
    patient_image_id: iid,
    client: supabase,
  });

  return { result, assessorVersion, usedOpenAi, persistedId: persisted.id };
}
