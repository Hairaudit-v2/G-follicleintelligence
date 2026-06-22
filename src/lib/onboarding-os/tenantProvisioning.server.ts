import "server-only";

import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";
import {
  getRequestOriginFromHeaders,
  provisionPlatformTenant,
} from "@/src/lib/fiOs/platformTenantProvision.server";
import { activateTenantModule } from "@/src/lib/platform/entitlements/activateTenantModule.server";
import { logStructured } from "@/src/lib/server/structuredLog";

import {
  buildProvisioningAuditSnapshot,
  buildProvisioningSteps,
  calculateProvisioningProgress,
  canRetryProvisioningStep,
  provisioningStepStatusAfterRetryRequest,
  resolveModuleTemplateFromInput,
  validateProvisioningInput,
} from "./tenantProvisioningCore";
import type {
  ProvisioningInput,
  ProvisioningSessionStatus,
  ProvisioningStepCode,
  ProvisioningStepStatus,
} from "./tenantProvisioningTypes";

export type TenantProvisioningSessionRow = {
  id: string;
  tenant_id: string | null;
  template_id: string | null;
  status: ProvisioningSessionStatus;
  tenant_name: string;
  tenant_slug: string;
  input_snapshot: Record<string, unknown>;
  result_snapshot: Record<string, unknown>;
  progress_percent: number;
  current_step_code: string | null;
  error_message: string | null;
  retry_count: number;
  actor_auth_user_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TenantProvisioningStepRow = {
  id: string;
  session_id: string;
  step_code: ProvisioningStepCode;
  step_order: number;
  status: ProvisioningStepStatus;
  attempt_count: number;
  max_attempts: number;
  started_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  input_snapshot: Record<string, unknown>;
  output_snapshot: Record<string, unknown>;
};

export type TenantProvisioningSessionDetail = {
  session: TenantProvisioningSessionRow;
  steps: TenantProvisioningStepRow[];
  progress: ReturnType<typeof calculateProvisioningProgress>;
};

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  actorAuthUserId?: string | null;
  skipAuthCheck?: boolean;
};

async function resolvePlatformAdminAuth(opts: ServerOpts): Promise<
  | { ok: true; actorAuthUserId: string }
  | { ok: false; error: string }
> {
  if (opts.skipAuthCheck && opts.actorAuthUserId) {
    return { ok: true, actorAuthUserId: opts.actorAuthUserId };
  }
  const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
  if (!authId) return { ok: false, error: "Authentication required." };
  const os = await loadFiOsIdentity(authId);
  if (!isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
    return { ok: false, error: "Platform administrator access is required." };
  }
  return { ok: true, actorAuthUserId: authId };
}

async function writeProvisioningAudit(
  supabase: SupabaseClient,
  opts: {
    sessionId: string;
    tenantId?: string | null;
    eventKind: string;
    actorAuthUserId: string | null;
    stepCode?: string | null;
    detail?: Record<string, unknown>;
  }
): Promise<void> {
  await supabase.from("fi_tenant_provisioning_audit_events").insert({
    session_id: opts.sessionId,
    tenant_id: opts.tenantId ?? null,
    event_kind: opts.eventKind,
    actor_auth_user_id: opts.actorAuthUserId,
    step_code: opts.stepCode ?? null,
    detail: opts.detail ?? {},
  });
}

async function loadDefaultTemplateId(supabase: SupabaseClient, templateCode?: string | null): Promise<string | null> {
  const code = templateCode?.trim();
  const query = supabase
    .from("fi_tenant_provisioning_templates")
    .select("id")
    .eq("is_active", true);

  const { data, error } = code
    ? await query.eq("code", code).maybeSingle()
    : await query.eq("is_default", true).maybeSingle();

  if (error || !data) return null;
  return String((data as { id: string }).id);
}

async function syncSessionProgress(
  supabase: SupabaseClient,
  sessionId: string,
  steps: TenantProvisioningStepRow[]
): Promise<void> {
  const progress = calculateProvisioningProgress(steps);
  const running = steps.find((s) => s.status === "running");
  const failed = steps.find((s) => s.status === "failed");
  const nextPending = steps.find((s) => s.status === "pending" || s.status === "retry_pending");

  let sessionStatus: ProvisioningSessionStatus = "in_progress";
  if (failed) sessionStatus = "failed";
  else if (progress.percent === 100 && steps.every((s) => s.status === "completed" || s.status === "skipped")) {
    const reviewStep = steps.find((s) => s.step_code === "ready_for_review");
    const finalizeStep = steps.find((s) => s.step_code === "finalize");
    if (finalizeStep?.status === "completed") sessionStatus = "completed";
    else if (reviewStep?.status === "completed") sessionStatus = "ready_for_review";
    else sessionStatus = "in_progress";
  }

  await supabase
    .from("fi_tenant_provisioning_sessions")
    .update({
      progress_percent: progress.percent,
      current_step_code: running?.step_code ?? nextPending?.step_code ?? null,
      status: sessionStatus,
      error_message: failed?.error_message ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
}

export async function createTenantProvisioningSession(
  rawInput: unknown,
  opts: ServerOpts = {}
): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  const auth = await resolvePlatformAdminAuth(opts);
  if (!auth.ok) return auth;

  const validated = validateProvisioningInput(rawInput);
  if (!validated.ok) return { ok: false, error: validated.errors.join(" ") };

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const input = validated.value;
  const templateId = await loadDefaultTemplateId(supabase, input.templateCode);
  const stepDefs = buildProvisioningSteps();
  const now = new Date().toISOString();

  const { data: session, error: sessionErr } = await supabase
    .from("fi_tenant_provisioning_sessions")
    .insert({
      template_id: templateId,
      status: "draft",
      tenant_name: input.tenantName,
      tenant_slug: input.tenantSlug,
      input_snapshot: input,
      actor_auth_user_id: auth.actorAuthUserId,
      metadata: { phase: "A" },
    })
    .select("id")
    .single();

  if (sessionErr || !session) {
    return { ok: false, error: sessionErr?.message ?? "Could not create provisioning session." };
  }

  const sessionId = String((session as { id: string }).id);

  const stepRows = stepDefs.map((def) => ({
    session_id: sessionId,
    step_code: def.stepCode,
    step_order: def.stepOrder,
    status: "pending" as const,
    input_snapshot: { label: def.label, description: def.description },
  }));

  const { error: stepsErr } = await supabase.from("fi_tenant_provisioning_steps").insert(stepRows);
  if (stepsErr) {
    await supabase.from("fi_tenant_provisioning_sessions").delete().eq("id", sessionId);
    return { ok: false, error: stepsErr.message };
  }

  await writeProvisioningAudit(supabase, {
    sessionId,
    eventKind: "session.created",
    actorAuthUserId: auth.actorAuthUserId,
    detail: buildProvisioningAuditSnapshot({
      sessionId,
      tenantId: null,
      tenantSlug: input.tenantSlug,
      sessionStatus: "draft",
      eventKind: "session.created",
      progressPercent: 0,
      capturedAt: now,
      detail: { tenant_name: input.tenantName },
    }),
  });

  logStructured("info", "onboarding_os_session_created", {
    session_id: sessionId,
    tenant_slug: input.tenantSlug,
    actor_auth_user_id: auth.actorAuthUserId,
  });

  return { ok: true, sessionId };
}

export async function loadTenantProvisioningSessions(
  opts: ServerOpts = {}
): Promise<{ ok: true; sessions: TenantProvisioningSessionRow[] } | { ok: false; error: string }> {
  const auth = await resolvePlatformAdminAuth(opts);
  if (!auth.ok) return auth;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenant_provisioning_sessions")
    .select(
      "id, tenant_id, template_id, status, tenant_name, tenant_slug, input_snapshot, result_snapshot, progress_percent, current_step_code, error_message, retry_count, actor_auth_user_id, started_at, completed_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return { ok: false, error: error.message };
  return { ok: true, sessions: (data ?? []) as TenantProvisioningSessionRow[] };
}

export async function loadTenantProvisioningSessionDetail(
  sessionId: string,
  opts: ServerOpts = {}
): Promise<{ ok: true; detail: TenantProvisioningSessionDetail } | { ok: false; error: string }> {
  const auth = await resolvePlatformAdminAuth(opts);
  if (!auth.ok) return auth;

  const id = sessionId.trim();
  if (!id) return { ok: false, error: "sessionId is required." };

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();

  const { data: session, error: sessionErr } = await supabase
    .from("fi_tenant_provisioning_sessions")
    .select(
      "id, tenant_id, template_id, status, tenant_name, tenant_slug, input_snapshot, result_snapshot, progress_percent, current_step_code, error_message, retry_count, actor_auth_user_id, started_at, completed_at, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (sessionErr) return { ok: false, error: sessionErr.message };
  if (!session) return { ok: false, error: "Provisioning session not found." };

  const { data: steps, error: stepsErr } = await supabase
    .from("fi_tenant_provisioning_steps")
    .select(
      "id, session_id, step_code, step_order, status, attempt_count, max_attempts, started_at, completed_at, error_code, error_message, input_snapshot, output_snapshot"
    )
    .eq("session_id", id)
    .order("step_order", { ascending: true });

  if (stepsErr) return { ok: false, error: stepsErr.message };

  const stepRows = (steps ?? []) as TenantProvisioningStepRow[];
  const progress = calculateProvisioningProgress(stepRows);

  return {
    ok: true,
    detail: {
      session: session as TenantProvisioningSessionRow,
      steps: stepRows,
      progress,
    },
  };
}

async function executeStepLogic(
  supabase: SupabaseClient,
  session: TenantProvisioningSessionRow,
  step: TenantProvisioningStepRow,
  actorAuthUserId: string
): Promise<{ ok: true; output: Record<string, unknown> } | { ok: false; errorCode: string; error: string }> {
  const input = session.input_snapshot as ProvisioningInput;
  const moduleTemplate = resolveModuleTemplateFromInput(input);

  switch (step.step_code) {
    case "validate_input": {
      const validated = validateProvisioningInput(input);
      if (!validated.ok) {
        return { ok: false, errorCode: "validation_failed", error: validated.errors.join(" ") };
      }
      return { ok: true, output: { validated: true } };
    }

    case "check_slug_availability": {
      const slug = session.tenant_slug.trim().toLowerCase();
      const { data: existing, error } = await supabase
        .from("fi_tenants")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (error) return { ok: false, errorCode: "slug_check_failed", error: error.message };
      if (existing) {
        return { ok: false, errorCode: "slug_taken", error: "A tenant with this slug already exists." };
      }
      return { ok: true, output: { slug_available: true, slug } };
    }

    case "provision_tenant_core": {
      if (session.tenant_id) {
        return { ok: true, output: { tenant_id: session.tenant_id, skipped: true } };
      }
      const h = headers();
      const getHeader = (name: string) => h.get(name);
      const result = await provisionPlatformTenant(
        {
          actorAuthUserId,
          tenantName: input.tenantName,
          tenantSlug: input.tenantSlug,
          defaultClinicDisplayName: input.defaultClinicDisplayName,
          defaultTimezone: input.defaultTimezone,
          firstTenantAdminEmail: input.firstTenantAdminEmail,
          supportEmail: input.supportEmail ?? null,
        },
        { getHeader }
      );
      if (!result.ok) {
        return { ok: false, errorCode: "provision_failed", error: result.error };
      }
      await supabase
        .from("fi_tenant_provisioning_sessions")
        .update({ tenant_id: result.tenantId, updated_at: new Date().toISOString() })
        .eq("id", session.id);
      return {
        ok: true,
        output: {
          tenant_id: result.tenantId,
          clinic_id: result.clinicId,
          fi_user_id: result.fiUserId,
          tenant_admin_user_id: result.tenantAdminUserId,
        },
      };
    }

    case "apply_module_entitlements": {
      const tenantId = session.tenant_id;
      if (!tenantId) {
        return { ok: false, errorCode: "tenant_missing", error: "Tenant must be provisioned before module entitlements." };
      }
      const activated: string[] = [];
      const failures: string[] = [];
      for (const moduleCode of moduleTemplate.enabledModules) {
        const res = await activateTenantModule({
          tenantId,
          moduleCode,
          subscriptionStatus: moduleTemplate.subscriptionStatus,
          verificationStatus: moduleTemplate.verificationStatus,
          supabaseClientForTests: supabase,
        });
        if (res.ok) activated.push(moduleCode);
        else failures.push(`${moduleCode}: ${res.message}`);
      }
      if (failures.length) {
        return {
          ok: false,
          errorCode: "module_activation_failed",
          error: failures.join("; "),
        };
      }
      return {
        ok: true,
        output: {
          activated_modules: activated,
          subscription_status: moduleTemplate.subscriptionStatus,
          billing_connector: "none",
        },
      };
    }

    case "apply_verification_status": {
      const tenantId = session.tenant_id;
      if (!tenantId) {
        return { ok: false, errorCode: "tenant_missing", error: "Tenant must be provisioned before verification." };
      }
      const { error } = await supabase
        .from("fi_tenants")
        .update({ verification_status: moduleTemplate.verificationStatus })
        .eq("id", tenantId);
      if (error) return { ok: false, errorCode: "verification_update_failed", error: error.message };
      return { ok: true, output: { verification_status: moduleTemplate.verificationStatus } };
    }

    case "ready_for_review": {
      return { ok: true, output: { ready_for_review: true, reviewed_by: actorAuthUserId } };
    }

    case "finalize": {
      const tenantId = session.tenant_id;
      if (!tenantId) {
        return { ok: false, errorCode: "tenant_missing", error: "Tenant must be provisioned before finalize." };
      }
      const completedAt = new Date().toISOString();
      await supabase
        .from("fi_tenant_provisioning_sessions")
        .update({
          status: "completed",
          completed_at: completedAt,
          result_snapshot: {
            tenant_id: tenantId,
            finalized_at: completedAt,
            origin: getRequestOriginFromHeaders((name) => headers().get(name)),
          },
          updated_at: completedAt,
        })
        .eq("id", session.id);
      return { ok: true, output: { finalized: true, tenant_id: tenantId, completed_at: completedAt } };
    }

    default:
      return { ok: false, errorCode: "unknown_step", error: `Unknown step: ${step.step_code}` };
  }
}

export async function runTenantProvisioningStep(
  sessionId: string,
  stepCode: string,
  opts: ServerOpts = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await resolvePlatformAdminAuth(opts);
  if (!auth.ok) return auth;

  const id = sessionId.trim();
  const code = stepCode.trim() as ProvisioningStepCode;
  if (!id || !code) return { ok: false, error: "sessionId and stepCode are required." };

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const loaded = await loadTenantProvisioningSessionDetail(id, { ...opts, skipAuthCheck: true, actorAuthUserId: auth.actorAuthUserId });
  if (!loaded.ok) return loaded;

  const { session, steps } = loaded.detail;
  if (session.status === "completed" || session.status === "cancelled") {
    return { ok: false, error: "Session is closed." };
  }

  const step = steps.find((s) => s.step_code === code);
  if (!step) return { ok: false, error: "Step not found." };
  if (step.status === "completed") return { ok: true };
  if (step.status === "running") return { ok: false, error: "Step is already running." };

  const now = new Date().toISOString();
  const attemptCount = step.attempt_count + 1;

  await supabase
    .from("fi_tenant_provisioning_steps")
    .update({
      status: "running",
      attempt_count: attemptCount,
      started_at: step.started_at ?? now,
      error_code: null,
      error_message: null,
      updated_at: now,
    })
    .eq("id", step.id);

  if (!session.started_at) {
    await supabase
      .from("fi_tenant_provisioning_sessions")
      .update({ status: "in_progress", started_at: now, updated_at: now })
      .eq("id", id);
  }

  const freshSession = (await loadTenantProvisioningSessionDetail(id, {
    ...opts,
    skipAuthCheck: true,
    actorAuthUserId: auth.actorAuthUserId,
  })) as { ok: true; detail: TenantProvisioningSessionDetail };

  const exec = await executeStepLogic(supabase, freshSession.detail.session, step, auth.actorAuthUserId);
  const finishedAt = new Date().toISOString();

  if (!exec.ok) {
    await supabase
      .from("fi_tenant_provisioning_steps")
      .update({
        status: "failed",
        error_code: exec.errorCode,
        error_message: exec.error,
        completed_at: finishedAt,
        updated_at: finishedAt,
      })
      .eq("id", step.id);

    const updatedSteps = steps.map((s) =>
      s.id === step.id
        ? { ...s, status: "failed" as const, error_code: exec.errorCode, error_message: exec.error }
        : s
    );
    await syncSessionProgress(supabase, id, updatedSteps);

    await writeProvisioningAudit(supabase, {
      sessionId: id,
      tenantId: session.tenant_id,
      eventKind: "step.failed",
      actorAuthUserId: auth.actorAuthUserId,
      stepCode: code,
      detail: { error_code: exec.errorCode, error: exec.error },
    });

    return { ok: false, error: exec.error };
  }

  await supabase
    .from("fi_tenant_provisioning_steps")
    .update({
      status: "completed",
      output_snapshot: exec.output,
      completed_at: finishedAt,
      updated_at: finishedAt,
    })
    .eq("id", step.id);

  const reloaded = await loadTenantProvisioningSessionDetail(id, {
    ...opts,
    skipAuthCheck: true,
    actorAuthUserId: auth.actorAuthUserId,
  });
  if (reloaded.ok) {
    await syncSessionProgress(supabase, id, reloaded.detail.steps);
  }

  await writeProvisioningAudit(supabase, {
    sessionId: id,
    tenantId: freshSession.detail.session.tenant_id,
    eventKind: "step.completed",
    actorAuthUserId: auth.actorAuthUserId,
    stepCode: code,
    detail: exec.output,
  });

  return { ok: true };
}

export async function retryTenantProvisioningStep(
  sessionId: string,
  stepCode: string,
  opts: ServerOpts = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await resolvePlatformAdminAuth(opts);
  if (!auth.ok) return auth;

  const id = sessionId.trim();
  const code = stepCode.trim();
  if (!id || !code) return { ok: false, error: "sessionId and stepCode are required." };

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const loaded = await loadTenantProvisioningSessionDetail(id, { ...opts, skipAuthCheck: true, actorAuthUserId: auth.actorAuthUserId });
  if (!loaded.ok) return loaded;

  const step = loaded.detail.steps.find((s) => s.step_code === code);
  if (!step) return { ok: false, error: "Step not found." };

  if (
    !canRetryProvisioningStep({
      status: step.status,
      attemptCount: step.attempt_count,
      maxAttempts: step.max_attempts,
    })
  ) {
    return { ok: false, error: "Step cannot be retried (not failed or max attempts reached)." };
  }

  const nextStatus = provisioningStepStatusAfterRetryRequest(step.status);
  const now = new Date().toISOString();

  await supabase
    .from("fi_tenant_provisioning_sessions")
    .update({ retry_count: loaded.detail.session.retry_count + 1, updated_at: now })
    .eq("id", id);

  await supabase
    .from("fi_tenant_provisioning_steps")
    .update({
      status: nextStatus,
      error_code: null,
      error_message: null,
      updated_at: now,
    })
    .eq("id", step.id);

  await writeProvisioningAudit(supabase, {
    sessionId: id,
    tenantId: loaded.detail.session.tenant_id,
    eventKind: "step.retry_requested",
    actorAuthUserId: auth.actorAuthUserId,
    stepCode: code,
    detail: { attempt_count: step.attempt_count },
  });

  return runTenantProvisioningStep(id, code, { ...opts, actorAuthUserId: auth.actorAuthUserId, skipAuthCheck: true });
}

export async function markProvisioningReadyForReview(
  sessionId: string,
  opts: ServerOpts = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  return runTenantProvisioningStep(sessionId, "ready_for_review", opts);
}

export async function finalizeTenantProvisioning(
  sessionId: string,
  opts: ServerOpts = {}
): Promise<{ ok: true; tenantId: string | null } | { ok: false; error: string }> {
  const auth = await resolvePlatformAdminAuth(opts);
  if (!auth.ok) return auth;

  const prereqSteps = ["validate_input", "check_slug_availability", "provision_tenant_core", "apply_module_entitlements", "apply_verification_status"];
  for (const stepCode of prereqSteps) {
    const res = await runTenantProvisioningStep(sessionId, stepCode, {
      ...opts,
      actorAuthUserId: auth.actorAuthUserId,
      skipAuthCheck: true,
    });
    if (!res.ok) return res;
  }

  const review = await runTenantProvisioningStep(sessionId, "ready_for_review", {
    ...opts,
    actorAuthUserId: auth.actorAuthUserId,
    skipAuthCheck: true,
  });
  if (!review.ok) return review;

  const fin = await runTenantProvisioningStep(sessionId, "finalize", {
    ...opts,
    actorAuthUserId: auth.actorAuthUserId,
    skipAuthCheck: true,
  });
  if (!fin.ok) return fin;

  const loaded = await loadTenantProvisioningSessionDetail(sessionId, {
    ...opts,
    actorAuthUserId: auth.actorAuthUserId,
    skipAuthCheck: true,
  });
  if (!loaded.ok) return loaded;

  return { ok: true, tenantId: loaded.detail.session.tenant_id };
}
