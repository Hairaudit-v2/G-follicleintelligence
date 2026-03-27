import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { type MissingRequirement } from "@/src/lib/fi/requirements";
import {
  getCaseSubmissionState,
  submitCaseIfReady,
} from "@/lib/fi/services/caseSubmission";
import { runPipeline } from "../pipeline";

export type FiSubmitDecision = {
  attempted: boolean;
  submitted: boolean;
  fiCaseId: string;
  statusBefore?: string;
  statusAfter?: string;
  reason:
    | "submitted"
    | "case_not_found"
    | "requirements_not_met"
    | "already_submitted_or_beyond";
  missing?: MissingRequirement[];
};

export type FiTriggerDecision = {
  attempted: boolean;
  triggered: boolean;
  fiCaseId: string;
  mode: "direct" | "queued" | "skipped";
  reason:
    | "pipeline_triggered"
    | "case_not_found"
    | "requirements_not_met"
    | "case_not_submitted"
    | "already_running"
    | "already_queued"
    | "already_complete";
  modelRunId?: string;
  reportId?: string;
  storagePath?: string;
  missing?: MissingRequirement[];
};

export type EventPipelineResult =
  | {
      attempted: false;
      reason:
        | "requirements_not_met"
        | "case_not_found"
        | "already_running"
        | "already_queued"
        | "already_complete"
        | "case_not_submitted";
      missing?: MissingRequirement[];
      modelRunId?: string;
    }
  | {
      attempted: true;
      ok: boolean;
      jobId?: string;
      reportId?: string;
      storagePath?: string;
      error?: string;
    };

export async function maybeSubmitCaseFromEvent(params: {
  tenantId: string;
  fiCaseId: string;
  reason?: string;
  sourceSystem?: string;
  eventType?: string;
}): Promise<FiSubmitDecision> {
  const result = await submitCaseIfReady(params.tenantId, params.fiCaseId);

  if (!result.ok) {
    return {
      attempted: false,
      submitted: false,
      fiCaseId: params.fiCaseId,
      reason: "case_not_found",
    };
  }

  if (result.reason === "requirements_not_met") {
    return {
      attempted: false,
      submitted: false,
      fiCaseId: params.fiCaseId,
      statusBefore: result.statusBefore,
      statusAfter: result.statusAfter,
      reason: "requirements_not_met",
      missing: result.missing,
    };
  }

  if (result.reason === "already_not_draft") {
    return {
      attempted: false,
      submitted: false,
      fiCaseId: params.fiCaseId,
      statusBefore: result.statusBefore,
      statusAfter: result.statusAfter,
      reason: "already_submitted_or_beyond",
    };
  }

  return {
    attempted: true,
    submitted: true,
    fiCaseId: params.fiCaseId,
    statusBefore: result.statusBefore,
    statusAfter: result.statusAfter,
    reason: "submitted",
  };
}

export async function maybeTriggerPipelineFromEvent(params: {
  tenantId: string;
  fiCaseId: string;
  reason?: string;
  sourceSystem?: string;
  eventType?: string;
}): Promise<FiTriggerDecision> {
  const submissionState = await getCaseSubmissionState(params.tenantId, params.fiCaseId);
  if (!submissionState.ok) {
    return {
      attempted: false,
      triggered: false,
      fiCaseId: params.fiCaseId,
      mode: "skipped",
      reason: "case_not_found",
    };
  }

  if (!submissionState.ready) {
    return {
      attempted: false,
      triggered: false,
      fiCaseId: params.fiCaseId,
      mode: "skipped",
      reason: "requirements_not_met",
      missing: submissionState.missing,
      reportId: undefined,
      storagePath: undefined,
    };
  }

  if (submissionState.status === "draft") {
    return {
      attempted: false,
      triggered: false,
      fiCaseId: params.fiCaseId,
      mode: "skipped",
      reason: "case_not_submitted",
    };
  }

  const supabase = supabaseAdmin();
  const { data: activeOrComplete } = await supabase
    .from("fi_model_runs")
    .select("id, status")
    .eq("tenant_id", params.tenantId)
    .eq("case_id", params.fiCaseId)
    .in("status", ["complete", "queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeOrComplete?.status === "running") {
    return {
      attempted: false,
      triggered: false,
      fiCaseId: params.fiCaseId,
      mode: "skipped",
      reason: "already_running",
      modelRunId: activeOrComplete.id,
    };
  }

  if (activeOrComplete?.status === "queued") {
    return {
      attempted: false,
      triggered: false,
      fiCaseId: params.fiCaseId,
      mode: "skipped",
      reason: "already_queued",
      modelRunId: activeOrComplete.id,
    };
  }

  if (activeOrComplete?.status === "complete") {
    return {
      attempted: false,
      triggered: false,
      fiCaseId: params.fiCaseId,
      mode: "skipped",
      reason: "already_complete",
      modelRunId: activeOrComplete.id,
    };
  }

  const result = await runPipeline({ tenantId: params.tenantId, caseId: params.fiCaseId });
  if (!result.ok) {
    throw new Error(result.error ?? "Failed to trigger pipeline.");
  }

  return {
    attempted: true,
    triggered: true,
    fiCaseId: params.fiCaseId,
    mode: "direct",
    reason: "pipeline_triggered",
    modelRunId: result.jobId,
    reportId: result.reportId,
    storagePath: result.storagePath,
  };
}

export async function maybeSubmitAndRunCase(
  tenantId: string,
  caseId: string
): Promise<EventPipelineResult> {
  const submitDecision = await maybeSubmitCaseFromEvent({
    tenantId,
    fiCaseId: caseId,
  });

  if (submitDecision.reason === "case_not_found") {
    return { attempted: false, reason: "case_not_found" };
  }

  if (submitDecision.reason === "requirements_not_met") {
    return {
      attempted: false,
      reason: "requirements_not_met",
      missing: submitDecision.missing,
    };
  }

  const triggerDecision = await maybeTriggerPipelineFromEvent({
    tenantId,
    fiCaseId: caseId,
  });

  if (!triggerDecision.triggered) {
    return {
      attempted: false,
      reason: triggerDecision.reason,
      missing: triggerDecision.missing,
      modelRunId: triggerDecision.modelRunId,
    };
  }
  return {
    attempted: true,
    ok: true,
    jobId: triggerDecision.modelRunId,
    reportId: triggerDecision.reportId,
    storagePath: triggerDecision.storagePath,
  };
}
