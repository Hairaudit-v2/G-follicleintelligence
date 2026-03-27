import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  validateIntakeRequirements,
  type MissingRequirement,
} from "@/src/lib/fi/requirements";

export type FiCaseSubmissionState =
  | {
      ok: false;
      reason: "case_not_found";
      fiCaseId: string;
    }
  | {
      ok: true;
      fiCaseId: string;
      status: string;
      ready: boolean;
      error?: string;
      missing?: MissingRequirement[];
      uploadTypes: string[];
    };

export type FiCaseSubmitResult =
  | {
      ok: false;
      reason: "case_not_found";
      fiCaseId: string;
    }
  | {
      ok: true;
      fiCaseId: string;
      statusBefore: string;
      statusAfter: string;
      submitted: boolean;
      reason: "submitted" | "already_not_draft" | "requirements_not_met";
      error?: string;
      missing?: MissingRequirement[];
    };

export async function getCaseSubmissionState(
  tenantId: string,
  fiCaseId: string
): Promise<FiCaseSubmissionState> {
  const supabase = supabaseAdmin();

  const { data: caseRow } = await supabase
    .from("fi_cases")
    .select("id, status")
    .eq("id", fiCaseId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!caseRow) {
    return { ok: false, reason: "case_not_found", fiCaseId };
  }

  const { data: uploads } = await supabase
    .from("fi_uploads")
    .select("type")
    .eq("case_id", fiCaseId)
    .eq("tenant_id", tenantId);

  const uploadTypes = (uploads ?? []).map((upload) => upload.type);
  const validated = validateIntakeRequirements(uploadTypes);

  if (!validated.ok) {
    return {
      ok: true,
      fiCaseId,
      status: caseRow.status,
      ready: false,
      error: validated.error,
      missing: validated.missing,
      uploadTypes,
    };
  }

  return {
    ok: true,
    fiCaseId,
    status: caseRow.status,
    ready: true,
    uploadTypes,
  };
}

export async function submitCaseIfReady(
  tenantId: string,
  fiCaseId: string
): Promise<FiCaseSubmitResult> {
  const state = await getCaseSubmissionState(tenantId, fiCaseId);
  if (!state.ok) return state;

  if (state.status !== "draft") {
    return {
      ok: true,
      fiCaseId,
      statusBefore: state.status,
      statusAfter: state.status,
      submitted: false,
      reason: "already_not_draft",
    };
  }

  if (!state.ready) {
    return {
      ok: true,
      fiCaseId,
      statusBefore: state.status,
      statusAfter: state.status,
      submitted: false,
      reason: "requirements_not_met",
      error: state.error,
      missing: state.missing,
    };
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin()
    .from("fi_cases")
    .update({
      status: "submitted",
      updated_at: now,
    })
    .eq("id", fiCaseId)
    .eq("tenant_id", tenantId)
    .eq("status", "draft");

  if (error) {
    throw new Error(error.message);
  }

  const { data: updated } = await supabaseAdmin()
    .from("fi_cases")
    .select("status")
    .eq("id", fiCaseId)
    .eq("tenant_id", tenantId)
    .single();

  return {
    ok: true,
    fiCaseId,
    statusBefore: state.status,
    statusAfter: updated?.status ?? "submitted",
    submitted: true,
    reason: "submitted",
  };
}
