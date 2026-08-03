import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getTenantConfigResolvedById } from "@/lib/fi/tenantConfig";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { patientHasSignedConsentFormKey } from "@/src/lib/consents/consentAccessToken.server";
import { photographyConsentGateSatisfied } from "./patientConsentGateCore";
import { isGlobalTrialConsentGateEnabled } from "./patientTrialConsentShared";

export { isGlobalTrialConsentGateEnabled };

export class PatientTrialConsentRequiredError extends Error {
  constructor(message = "Record patient photography and treatment consent before continuing.") {
    super(message);
    this.name = "PatientTrialConsentRequiredError";
  }
}

export async function isTrialConsentGateEnabledForTenant(
  tenantId: string,
  _client?: SupabaseClient
): Promise<boolean> {
  if (isGlobalTrialConsentGateEnabled()) return true;
  const config = await getTenantConfigResolvedById(tenantId);
  return config.feature_flags?.trial_require_consent_before_capture === true;
}

export async function patientHasRecordedConsentDocument(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  if (!tid || !pid) return false;

  const supabase = client ?? supabaseAdmin();
  const { count, error } = await supabase
    .from("fi_patient_documents")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("document_type", "consent");

  if (error) {
    if (error.message?.includes("does not exist") || error.message?.includes("schema cache")) {
      return false;
    }
    throw new Error(error.message);
  }
  return (count ?? 0) > 0;
}

/**
 * Photo/trial gate satisfaction: prefer signed photo_clinical instance when framework
 * tables exist; fall back to vault document_type=consent (Sprint A vault path).
 */
export async function patientHasPhotographyConsentSatisfied(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  if (!tid || !pid) return false;

  let photoClinicalSigned = false;
  try {
    photoClinicalSigned = await patientHasSignedConsentFormKey(
      tid,
      pid,
      "photo_clinical",
      client
    );
  } catch {
    photoClinicalSigned = false;
  }

  const vaultConsentDocumentPresent = await patientHasRecordedConsentDocument(
    tid,
    pid,
    client
  );

  return photographyConsentGateSatisfied({
    photoClinicalSigned,
    vaultConsentDocumentPresent,
  });
}

export type TrialConsentGateStatus = {
  required: boolean;
  satisfied: boolean;
  patientId: string | null;
};

export async function loadTrialConsentGateStatus(
  tenantId: string,
  patientId: string | null | undefined,
  client?: SupabaseClient
): Promise<TrialConsentGateStatus> {
  const pid = patientId?.trim() || null;
  const required = await isTrialConsentGateEnabledForTenant(tenantId, client);
  if (!required || !pid) {
    return { required, satisfied: !required || Boolean(pid), patientId: pid };
  }
  const satisfied = await patientHasPhotographyConsentSatisfied(tenantId, pid, client);
  return { required, satisfied, patientId: pid };
}

export async function assertPatientTrialConsentRecorded(
  tenantId: string,
  patientId: string | null | undefined,
  client?: SupabaseClient
): Promise<void> {
  const status = await loadTrialConsentGateStatus(tenantId, patientId, client);
  if (!status.required) return;
  if (!status.patientId) {
    throw new PatientTrialConsentRequiredError(
      "Link a patient to this consultation before completing or capturing clinical photography."
    );
  }
  if (!status.satisfied) {
    throw new PatientTrialConsentRequiredError(
      "Record photography consent on the patient profile (Required consents or Documents tab) before clinical photography or consultation completion."
    );
  }
}
