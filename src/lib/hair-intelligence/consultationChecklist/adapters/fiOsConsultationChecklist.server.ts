import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateConsultationChecklistAndPersist } from "../generateChecklist.server";
import type { GenerateConsultationChecklistOutcome } from "../types";

export type GenerateFiOsConsultationChecklistParams = {
  tenantId: string;
  patientId: string;
  caseId?: string | null;
  /** Optional linkage id (e.g. consultation id) stored as `source_record_id`. */
  sourceRecordId?: string | null;
  client?: SupabaseClient;
};

export async function generateFiOsPatientConsultationChecklistAndPersist(
  params: GenerateFiOsConsultationChecklistParams
): Promise<GenerateConsultationChecklistOutcome> {
  const supabase = params.client ?? supabaseAdmin();
  return generateConsultationChecklistAndPersist({
    source_system: "fi_os",
    source_record_id: params.sourceRecordId?.trim() ?? null,
    tenant_id: params.tenantId.trim(),
    patient_id: params.patientId.trim(),
    case_id: params.caseId?.trim() ?? null,
    client: supabase,
  });
}
