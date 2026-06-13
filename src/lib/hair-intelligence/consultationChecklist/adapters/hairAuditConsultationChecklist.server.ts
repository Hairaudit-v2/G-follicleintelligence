import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateConsultationChecklistAndPersist } from "../generateChecklist.server";
import type { GenerateConsultationChecklistOutcome } from "../types";

export type GenerateHairAuditConsultationChecklistParams = {
  tenantId: string | null;
  patientId: string | null;
  caseId?: string | null;
  sourceRecordId?: string | null;
  client?: SupabaseClient;
};

export async function generateHairAuditConsultationChecklistAndPersist(
  params: GenerateHairAuditConsultationChecklistParams
): Promise<GenerateConsultationChecklistOutcome> {
  const supabase = params.client ?? supabaseAdmin();
  return generateConsultationChecklistAndPersist({
    source_system: "hairaudit",
    source_record_id: params.sourceRecordId?.trim() ?? null,
    tenant_id: params.tenantId?.trim() ?? null,
    patient_id: params.patientId?.trim() ?? null,
    case_id: params.caseId?.trim() ?? null,
    client: supabase,
  });
}
