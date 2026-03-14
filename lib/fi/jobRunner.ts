/**
 * Job runner contract for Follicle Intelligence.
 * Locking via optimistic update; tenant-scoped.
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type JobRow = {
  id: string;
  status: string;
  stage: string | null;
  attempts: number;
};

const FI_MODEL_RUNS_TABLE = "fi_model_runs";

export async function acquireJob(
  tenantId: string,
  caseId: string,
  existingJobId?: string
): Promise<{ ok: true; jobId: string; job: JobRow } | { ok: false; error: string }> {
  const supabase = supabaseAdmin();
  let job: JobRow | null = null;
  let jobId = existingJobId;

  if (jobId) {
    const { data } = await supabase
      .from(FI_MODEL_RUNS_TABLE)
      .select("id, status, stage, attempts")
      .eq("id", jobId)
      .eq("tenant_id", tenantId)
      .single();
    job = data;
    if (!job) return { ok: false, error: "Job not found." };
  } else {
    const { data, error } = await supabase
      .from(FI_MODEL_RUNS_TABLE)
      .insert({ tenant_id: tenantId, case_id: caseId, status: "queued" })
      .select("id, status, stage, attempts")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Failed to create job." };
    jobId = data.id;
    job = data;
  }

  if (job!.status === "complete") return { ok: true, jobId: jobId!, job: job! };

  const { data: updated, error } = await supabase
    .from(FI_MODEL_RUNS_TABLE)
    .update({
      status: "running",
      stage: "load",
      locked_at: new Date().toISOString(),
      attempts: job!.attempts + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId!)
    .eq("status", job!.status)
    .eq("tenant_id", tenantId)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: "Job already locked by another worker." };
  return {
    ok: true,
    jobId: jobId!,
    job: {
      ...job!,
      status: "running",
      stage: "load",
      attempts: job!.attempts + 1,
    },
  };
}

export async function failJob(jobId: string, tenantId: string, err: string): Promise<void> {
  await supabaseAdmin()
    .from(FI_MODEL_RUNS_TABLE)
    .update({
      status: "failed",
      last_error: err,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("tenant_id", tenantId);
}

export async function completeJob(jobId: string, tenantId: string): Promise<void> {
  await supabaseAdmin()
    .from(FI_MODEL_RUNS_TABLE)
    .update({
      status: "complete",
      stage: "complete",
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("tenant_id", tenantId);
}

export async function updateJobStage(
  jobId: string,
  tenantId: string,
  stage: string
): Promise<void> {
  await supabaseAdmin()
    .from(FI_MODEL_RUNS_TABLE)
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("tenant_id", tenantId);
}

export async function getQueuedJobs(
  tenantId: string,
  limit = 10
): Promise<{ id: string; case_id: string }[]> {
  const { data } = await supabaseAdmin()
    .from(FI_MODEL_RUNS_TABLE)
    .select("id, case_id")
    .eq("tenant_id", tenantId)
    .eq("status", "queued")
    .limit(limit);
  return (data ?? []) as { id: string; case_id: string }[];
}
