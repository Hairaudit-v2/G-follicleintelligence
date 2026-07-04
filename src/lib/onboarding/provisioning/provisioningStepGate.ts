import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  ProvisioningStepCode,
  ProvisioningStepStatus,
} from "@/src/lib/onboarding-os/tenantProvisioningTypes";

import {
  buildProvisioningStepReclaimMetadata,
  isProvisioningStepLeaseStale,
} from "./provisioningStepLeaseCore";

export type ProvisioningStepLeaseRow = {
  id: string;
  session_id: string;
  step_code: ProvisioningStepCode;
  status: ProvisioningStepStatus;
  attempt_count: number;
  max_attempts: number;
  started_at: string | null;
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  updated_at: string;
};

export type ProvisioningStepRunGate =
  | { kind: "already_completed" }
  | { kind: "already_running" }
  | { kind: "already_running_or_reclaimed_by_other_worker" }
  | { kind: "reclaimed_stale"; step: ProvisioningStepLeaseRow }
  | { kind: "should_run"; step: ProvisioningStepLeaseRow };

function stepLeaseColumns() {
  return "id, session_id, step_code, status, attempt_count, max_attempts, started_at, error_code, error_message, metadata, updated_at";
}

async function loadProvisioningStepById(
  stepId: string,
  client?: SupabaseClient
): Promise<ProvisioningStepLeaseRow | null> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenant_provisioning_steps")
    .select(stepLeaseColumns())
    .eq("id", stepId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return parseProvisioningStepLeaseRow(data as unknown as Record<string, unknown>);
}

function parseProvisioningStepLeaseRow(row: Record<string, unknown>): ProvisioningStepLeaseRow {
  return {
    id: String(row.id),
    session_id: String(row.session_id),
    step_code: String(row.step_code) as ProvisioningStepCode,
    status: String(row.status) as ProvisioningStepStatus,
    attempt_count: Number(row.attempt_count ?? 0),
    max_attempts: Number(row.max_attempts ?? 3),
    started_at: row.started_at != null ? String(row.started_at) : null,
    error_code: row.error_code != null ? String(row.error_code) : null,
    error_message: row.error_message != null ? String(row.error_message) : null,
    metadata:
      row.metadata != null && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function tryReclaimStaleProvisioningStep(input: {
  stepId: string;
  expectedUpdatedAt: string;
  existingMetadata: Record<string, unknown>;
  attemptCount: number;
  client?: SupabaseClient;
  nowMs?: number;
}): Promise<
  | { reclaimed: true; step: ProvisioningStepLeaseRow }
  | { reclaimed: false; reason: "not_stale" | "already_running_or_reclaimed_by_other_worker" }
> {
  const supabase = input.client ?? supabaseAdmin();
  const nowMs = input.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();

  if (!isProvisioningStepLeaseStale(input.expectedUpdatedAt, nowMs)) {
    return { reclaimed: false, reason: "not_stale" };
  }

  const nextAttemptCount = input.attemptCount + 1;
  const nextMetadata = buildProvisioningStepReclaimMetadata({
    existingMetadata: input.existingMetadata,
    previousRunningAt: input.expectedUpdatedAt,
    reclaimedAt: nowIso,
    attemptCountAtReclaim: nextAttemptCount,
  });

  const { data, error } = await supabase
    .from("fi_tenant_provisioning_steps")
    .update({
      status: "running",
      attempt_count: nextAttemptCount,
      error_code: null,
      error_message: null,
      metadata: nextMetadata,
      updated_at: nowIso,
    })
    .eq("id", input.stepId)
    .eq("status", "running")
    .eq("updated_at", input.expectedUpdatedAt)
    .select(stepLeaseColumns())
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return { reclaimed: false, reason: "already_running_or_reclaimed_by_other_worker" };
  }

  return {
    reclaimed: true,
    step: parseProvisioningStepLeaseRow(data as unknown as Record<string, unknown>),
  };
}

/**
 * Gate for runTenantProvisioningStep: completed stays idempotent; fresh running
 * short-circuits; stale running is atomically reclaimed for safe retry.
 */
export async function resolveProvisioningStepRunGate(
  step: ProvisioningStepLeaseRow,
  opts?: { nowMs?: number; client?: SupabaseClient }
): Promise<ProvisioningStepRunGate> {
  const nowMs = opts?.nowMs ?? Date.now();

  if (step.status === "completed") {
    return { kind: "already_completed" };
  }

  if (step.status === "running") {
    if (!isProvisioningStepLeaseStale(step.updated_at, nowMs)) {
      return { kind: "already_running" };
    }

    const reclaim = await tryReclaimStaleProvisioningStep({
      stepId: step.id,
      expectedUpdatedAt: step.updated_at,
      existingMetadata: step.metadata ?? {},
      attemptCount: step.attempt_count,
      client: opts?.client,
      nowMs,
    });

    if (reclaim.reclaimed) {
      return { kind: "reclaimed_stale", step: reclaim.step };
    }

    const reloaded = await loadProvisioningStepById(step.id, opts?.client);
    if (!reloaded) {
      return { kind: "already_running_or_reclaimed_by_other_worker" };
    }

    if (reloaded.status === "completed") {
      return { kind: "already_completed" };
    }
    if (reloaded.status === "running") {
      if (!isProvisioningStepLeaseStale(reloaded.updated_at, nowMs)) {
        return { kind: "already_running_or_reclaimed_by_other_worker" };
      }
      return { kind: "already_running_or_reclaimed_by_other_worker" };
    }

    return { kind: "should_run", step: reloaded };
  }

  return { kind: "should_run", step };
}