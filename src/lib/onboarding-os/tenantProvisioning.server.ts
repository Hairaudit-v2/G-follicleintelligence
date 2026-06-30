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
  buildAcademyAssignmentPlan,
  buildClinicDeploymentPlan,
  buildClinicDeploymentTemplate,
  buildProvisioningAuditSnapshot,
  buildProvisioningSteps,
  buildSandboxSeedPlan,
  buildSandboxSeedPreview,
  calculateProvisioningProgress,
  calculateTemplateReadiness,
  canRetryProvisioningStep,
  parseSandboxSeedHistory,
  prepareSandboxSeedPlan as buildSandboxSeedStepPlan,
  provisioningStepStatusAfterRetryRequest,
  resolveDeploymentTemplateCode,
  resolveModuleTemplateFromInput,
  resolveServiceWorkflowPack,
  validateProvisioningInput,
  validateSandboxSeedRequest,
} from "./tenantProvisioningCore";
import {
  buildHistoryEntryFromApply,
  executeSandboxSeedApply,
  resolvePackForApply,
} from "./sandboxSeedApply.server";
import type {
  AcademyAssignmentPlan,
  ClinicDeploymentPlan,
  ProvisioningInput,
  ProvisioningSessionStatus,
  ProvisioningStepCode,
  ProvisioningStepStatus,
  SandboxSeedHistoryEntry,
  SandboxSeedPackCode,
  SandboxSeedPlan,
  SandboxSeedPreview,
  SandboxSeedRequest,
  SandboxSeedResult,
  SandboxSeedStepPlan,
  TemplateReadinessResult,
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
  deployment_snapshot: Record<string, unknown>;
  progress_percent: number;
  current_step_code: string | null;
  error_message: string | null;
  retry_count: number;
  actor_auth_user_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export type TenantProvisioningTemplateRow = {
  id: string;
  code: string;
  display_name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  role_template: Record<string, unknown>;
  module_template: Record<string, unknown>;
  deployment_template: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type TenantProvisioningSessionDetail = {
  session: TenantProvisioningSessionRow;
  steps: TenantProvisioningStepRow[];
  progress: ReturnType<typeof calculateProvisioningProgress>;
  deploymentPlan: ClinicDeploymentPlan | null;
  templateReadiness: TemplateReadinessResult | null;
  sandboxSeedPreview: SandboxSeedPreview | null;
  sandboxSeedHistory: SandboxSeedHistoryEntry[];
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

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  actorAuthUserId?: string | null;
  skipAuthCheck?: boolean;
};

async function resolvePlatformAdminAuth(
  opts: ServerOpts
): Promise<{ ok: true; actorAuthUserId: string } | { ok: false; error: string }> {
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

async function loadDefaultTemplateId(
  supabase: SupabaseClient,
  templateCode?: string | null
): Promise<string | null> {
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

function parseDeploymentPlanFromSnapshot(
  snapshot: Record<string, unknown>
): ClinicDeploymentPlan | null {
  const plan = snapshot?.plan;
  if (!plan || typeof plan !== "object") return null;
  return plan as ClinicDeploymentPlan;
}

function parseTemplateReadinessFromSnapshot(
  snapshot: Record<string, unknown>
): TemplateReadinessResult | null {
  const readiness = snapshot?.readiness;
  if (!readiness || typeof readiness !== "object") return null;
  return readiness as TemplateReadinessResult;
}

const SANDBOX_SEED_GENERATED_AT = "2026-06-01T00:00:00.000Z";

async function loadTenantBillingStatus(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("fi_tenant_billing_status")
    .select("subscription_status")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data ? String((data as { subscription_status: string }).subscription_status) : null;
}

async function loadTenantSettingsMetadata(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("fi_tenant_settings")
    .select("metadata")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const raw = (data as { metadata?: unknown } | null)?.metadata;
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function buildSandboxContextFromSession(
  session: TenantProvisioningSessionRow,
  deploymentPlan: ClinicDeploymentPlan | null
) {
  const input = session.input_snapshot as ProvisioningInput;
  const plan = deploymentPlan ?? buildClinicDeploymentPlan(input);
  const templateCode = plan.templateCode;
  const history = parseSandboxSeedHistory(session.metadata ?? {});
  return { input, plan, templateCode, history };
}

/** Resolve Phase C sandbox seed plan for a provisioning session. */
export async function prepareSandboxSeedPlan(
  sessionId: string,
  opts: ServerOpts & { packCode?: SandboxSeedPackCode | null } = {}
): Promise<
  { ok: true; plan: SandboxSeedPlan; preview: SandboxSeedPreview } | { ok: false; error: string }
> {
  const auth = await resolvePlatformAdminAuth(opts);
  if (!auth.ok) return auth;

  const loaded = await loadTenantProvisioningSessionDetail(sessionId, {
    ...opts,
    skipAuthCheck: true,
    actorAuthUserId: auth.actorAuthUserId,
  });
  if (!loaded.ok) return loaded;

  const { session, deploymentPlan } = loaded.detail;
  const { plan, templateCode, history } = buildSandboxContextFromSession(session, deploymentPlan);
  const seedPlan = buildSandboxSeedPlan({
    sessionId: session.id,
    tenantId: session.tenant_id,
    tenantSlug: session.tenant_slug,
    templateCode,
    deploymentPlan: plan,
    packCode: opts.packCode,
    generatedAt: SANDBOX_SEED_GENERATED_AT,
  });

  if (!seedPlan) return { ok: false, error: "Could not resolve sandbox seed plan." };

  const preview = buildSandboxSeedPreview({ plan: seedPlan, history });
  return { ok: true, plan: seedPlan, preview };
}

/** Load sandbox seed preview for admin UI. */
export async function loadSandboxSeedPreview(
  sessionId: string,
  opts: ServerOpts & { packCode?: SandboxSeedPackCode | null } = {}
): Promise<
  | { ok: true; preview: SandboxSeedPreview; history: SandboxSeedHistoryEntry[] }
  | { ok: false; error: string }
> {
  const prepared = await prepareSandboxSeedPlan(sessionId, opts);
  if (!prepared.ok) return prepared;
  const loaded = await loadTenantProvisioningSessionDetail(sessionId, {
    ...opts,
    skipAuthCheck: true,
    actorAuthUserId: opts.actorAuthUserId ?? undefined,
  });
  const history = loaded.ok ? loaded.detail.sandboxSeedHistory : [];
  return { ok: true, preview: prepared.preview, history };
}

/** Apply sandbox demo data pack to a provisioned tenant (Phase C). */
export async function applySandboxSeedToTenant(
  request: SandboxSeedRequest,
  opts: ServerOpts = {}
): Promise<
  { ok: true; result: SandboxSeedResult } | { ok: false; error: string; errorCode?: string }
> {
  const auth = await resolvePlatformAdminAuth(opts);
  if (!auth.ok) return auth;

  const sessionId = request.sessionId.trim();
  if (!sessionId)
    return { ok: false, error: "sessionId is required.", errorCode: "invalid_request" };

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const loaded = await loadTenantProvisioningSessionDetail(sessionId, {
    ...opts,
    skipAuthCheck: true,
    actorAuthUserId: auth.actorAuthUserId,
  });
  if (!loaded.ok) return loaded;

  const { session, deploymentPlan } = loaded.detail;
  const { plan, templateCode, history } = buildSandboxContextFromSession(session, deploymentPlan);
  const tenantId = session.tenant_id;
  const billingStatus = tenantId ? await loadTenantBillingStatus(supabase, tenantId) : null;
  const tenantSettingsMetadata = tenantId
    ? await loadTenantSettingsMetadata(supabase, tenantId)
    : null;

  const validation = validateSandboxSeedRequest({
    request: { sessionId, packCode: request.packCode, force: request.force },
    sessionStatus: session.status,
    sandboxEnabled: plan.sandboxSeed.enabled,
    tenantId,
    tenantBillingStatus: billingStatus,
    tenantSettingsMetadata,
    history,
    templateCode,
  });

  if (!validation.ok) {
    return { ok: false, error: validation.error, errorCode: validation.errorCode };
  }

  const packCode = resolvePackForApply(templateCode, validation.packCode);
  const seedPlan = buildSandboxSeedPlan({
    sessionId: session.id,
    tenantId,
    tenantSlug: session.tenant_slug,
    templateCode,
    deploymentPlan: plan,
    packCode,
    generatedAt: SANDBOX_SEED_GENERATED_AT,
  });

  if (!seedPlan)
    return { ok: false, error: "Could not build sandbox seed plan.", errorCode: "plan_failed" };

  try {
    const applied = await executeSandboxSeedApply({
      supabase,
      tenantId: tenantId!,
      sessionId: session.id,
      timezone: (session.input_snapshot as ProvisioningInput).defaultTimezone,
      plan: seedPlan,
      deploymentPlan: plan,
      packCode,
      generatedAt: SANDBOX_SEED_GENERATED_AT,
    });

    const appliedAt = new Date().toISOString();
    const { entry } = buildHistoryEntryFromApply({
      plan: seedPlan,
      appliedAt,
      entityCounts: applied.entityCounts,
      actorAuthUserId: auth.actorAuthUserId,
    });

    const nextHistory = [...history, entry];
    await supabase
      .from("fi_tenant_provisioning_sessions")
      .update({
        metadata: {
          ...(session.metadata ?? {}),
          phase: "C",
          sandbox_seed_history: nextHistory,
          last_sandbox_seed_pack: packCode,
        },
        updated_at: appliedAt,
      })
      .eq("id", session.id);

    await writeProvisioningAudit(supabase, {
      sessionId: session.id,
      tenantId,
      eventKind: "sandbox_seed.applied",
      actorAuthUserId: auth.actorAuthUserId,
      stepCode: "prepare_sandbox_seed",
      detail: { pack_code: packCode, entity_counts: entry.entityCounts },
    });

    return {
      ok: true,
      result: {
        ok: true,
        plan: seedPlan,
        appliedAt,
        entityCounts: applied.entityCounts,
        warnings: applied.warnings,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      errorCode: "apply_failed",
    };
  }
}

/** Apply resolved deployment template to a provisioning session (Phase B). */
export async function applyDeploymentTemplateToSession(
  supabase: SupabaseClient,
  sessionId: string,
  input: ProvisioningInput
): Promise<
  | { ok: true; plan: ClinicDeploymentPlan; readiness: TemplateReadinessResult }
  | { ok: false; error: string }
> {
  const templateCode = resolveDeploymentTemplateCode(input);
  const template = buildClinicDeploymentTemplate(templateCode);
  if (!template) {
    return { ok: false, error: `Deployment template "${templateCode}" is not available.` };
  }

  const plan = buildClinicDeploymentPlan(input);
  const readiness = calculateTemplateReadiness(template, input);

  const { error } = await supabase
    .from("fi_tenant_provisioning_sessions")
    .update({
      deployment_snapshot: { plan, readiness, applied_at: new Date().toISOString() },
      metadata: { phase: "B", deployment_template_code: templateCode },
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, plan, readiness };
}

/** Deploy service catalog from deployment template (workflows remain template-only). */
export async function deployDefaultClinicConfiguration(
  supabase: SupabaseClient,
  tenantId: string,
  plan: ClinicDeploymentPlan
): Promise<
  | {
      ok: true;
      deployedServices: string[];
      workflowPlan: ReturnType<typeof resolveServiceWorkflowPack>;
    }
  | { ok: false; error: string }
> {
  const pack = resolveServiceWorkflowPack({
    code: plan.templateCode,
    displayName: plan.templateDisplayName,
    description: "",
    rolePackCode: plan.rolePack.code,
    moduleBundleCode: plan.moduleBundle.code,
    serviceTemplates: plan.serviceTemplates,
    workflowTemplates: plan.workflowTemplates,
    academyAssignments: plan.academyAssignments,
    sandboxSeed: plan.sandboxSeed,
  });

  const deployedServices: string[] = [];
  const failures: string[] = [];

  for (const svc of pack.serviceTemplates) {
    const bookingType = svc.bookingType.trim();
    const { data: existing } = await supabase
      .from("fi_services")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("booking_type", bookingType)
      .maybeSingle();

    const row = {
      tenant_id: tenantId,
      name: svc.name,
      duration_minutes: svc.durationMinutes,
      base_price: svc.basePrice ?? 0,
      color: svc.color ?? "#0ea5e9",
      category: svc.category,
      booking_type: bookingType,
      is_active: true,
    };

    if (existing) {
      const { error } = await supabase
        .from("fi_services")
        .update(row)
        .eq("id", (existing as { id: string }).id);
      if (error) failures.push(`${svc.code}: ${error.message}`);
      else deployedServices.push(svc.code);
    } else {
      const { error } = await supabase.from("fi_services").insert(row);
      if (error) failures.push(`${svc.code}: ${error.message}`);
      else deployedServices.push(svc.code);
    }
  }

  if (failures.length) {
    return { ok: false, error: failures.join("; ") };
  }

  return {
    ok: true,
    deployedServices,
    workflowPlan: pack,
  };
}

/** Build AcademyOS training assignment plan for a session (template-only — no academy DB writes). */
export function assignAcademyTrainingTracks(plan: ClinicDeploymentPlan): AcademyAssignmentPlan {
  return buildAcademyAssignmentPlan(
    {
      code: plan.templateCode,
      displayName: plan.templateDisplayName,
      description: "",
      rolePackCode: plan.rolePack.code,
      moduleBundleCode: plan.moduleBundle.code,
      serviceTemplates: plan.serviceTemplates,
      workflowTemplates: plan.workflowTemplates,
      academyAssignments: plan.academyAssignments,
      sandboxSeed: plan.sandboxSeed,
    },
    plan.moduleBundle
  );
}

export async function loadTenantProvisioningTemplates(
  opts: ServerOpts = {}
): Promise<
  { ok: true; templates: TenantProvisioningTemplateRow[] } | { ok: false; error: string }
> {
  const auth = await resolvePlatformAdminAuth(opts);
  if (!auth.ok) return auth;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenant_provisioning_templates")
    .select(
      "id, code, display_name, description, is_default, is_active, role_template, module_template, deployment_template, metadata"
    )
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true, templates: (data ?? []) as TenantProvisioningTemplateRow[] };
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
  else if (
    progress.percent === 100 &&
    steps.every((s) => s.status === "completed" || s.status === "skipped")
  ) {
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
  const deploymentCode = resolveDeploymentTemplateCode(input);
  const templateId = await loadDefaultTemplateId(
    supabase,
    input.deploymentTemplateCode ?? input.templateCode ?? deploymentCode
  );
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
      metadata: { phase: "B", deployment_template_code: deploymentCode },
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

  const applied = await applyDeploymentTemplateToSession(supabase, sessionId, input);
  if (!applied.ok) {
    await supabase.from("fi_tenant_provisioning_sessions").delete().eq("id", sessionId);
    return applied;
  }

  await writeProvisioningAudit(supabase, {
    sessionId,
    eventKind: "deployment_template.applied",
    actorAuthUserId: auth.actorAuthUserId,
    detail: {
      template_code: applied.plan.templateCode,
      readiness_score: applied.readiness.score,
      readiness_ready: applied.readiness.ready,
    },
  });

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
      detail: {
        tenant_name: input.tenantName,
        deployment_template_code: applied.plan.templateCode,
      },
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
      "id, tenant_id, template_id, status, tenant_name, tenant_slug, input_snapshot, result_snapshot, deployment_snapshot, progress_percent, current_step_code, error_message, retry_count, actor_auth_user_id, started_at, completed_at, created_at, updated_at"
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
      "id, tenant_id, template_id, status, tenant_name, tenant_slug, input_snapshot, result_snapshot, deployment_snapshot, progress_percent, current_step_code, error_message, retry_count, actor_auth_user_id, started_at, completed_at, created_at, updated_at, metadata"
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
  const sessionRow = session as TenantProvisioningSessionRow;
  const deploymentPlan = parseDeploymentPlanFromSnapshot(sessionRow.deployment_snapshot ?? {});
  const templateReadiness = parseTemplateReadinessFromSnapshot(
    sessionRow.deployment_snapshot ?? {}
  );
  const sandboxSeedHistory = parseSandboxSeedHistory(sessionRow.metadata ?? {});
  const { plan: resolvedPlan, templateCode } = buildSandboxContextFromSession(
    sessionRow,
    deploymentPlan
  );
  const seedPlan = buildSandboxSeedPlan({
    sessionId: sessionRow.id,
    tenantId: sessionRow.tenant_id,
    tenantSlug: sessionRow.tenant_slug,
    templateCode,
    deploymentPlan: resolvedPlan,
    generatedAt: SANDBOX_SEED_GENERATED_AT,
  });
  const sandboxSeedPreview = seedPlan
    ? buildSandboxSeedPreview({ plan: seedPlan, history: sandboxSeedHistory })
    : null;

  return {
    ok: true,
    detail: {
      session: sessionRow,
      steps: stepRows,
      progress,
      deploymentPlan,
      templateReadiness,
      sandboxSeedPreview,
      sandboxSeedHistory,
    },
  };
}

async function executeStepLogic(
  supabase: SupabaseClient,
  session: TenantProvisioningSessionRow,
  step: TenantProvisioningStepRow,
  actorAuthUserId: string
): Promise<
  { ok: true; output: Record<string, unknown> } | { ok: false; errorCode: string; error: string }
> {
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
        return {
          ok: false,
          errorCode: "slug_taken",
          error: "A tenant with this slug already exists.",
        };
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
        return {
          ok: false,
          errorCode: "tenant_missing",
          error: "Tenant must be provisioned before module entitlements.",
        };
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
        return {
          ok: false,
          errorCode: "tenant_missing",
          error: "Tenant must be provisioned before verification.",
        };
      }
      const { error } = await supabase
        .from("fi_tenants")
        .update({ verification_status: moduleTemplate.verificationStatus })
        .eq("id", tenantId);
      if (error)
        return { ok: false, errorCode: "verification_update_failed", error: error.message };
      return { ok: true, output: { verification_status: moduleTemplate.verificationStatus } };
    }

    case "deploy_clinic_configuration": {
      const tenantId = session.tenant_id;
      if (!tenantId) {
        return {
          ok: false,
          errorCode: "tenant_missing",
          error: "Tenant must be provisioned before clinic configuration.",
        };
      }
      const plan =
        parseDeploymentPlanFromSnapshot(session.deployment_snapshot ?? {}) ??
        buildClinicDeploymentPlan(input);
      const deployed = await deployDefaultClinicConfiguration(supabase, tenantId, plan);
      if (!deployed.ok) {
        return { ok: false, errorCode: "clinic_config_failed", error: deployed.error };
      }
      return {
        ok: true,
        output: {
          deployed_services: deployed.deployedServices,
          workflow_plan: deployed.workflowPlan.workflowTemplates.map((w) => ({
            code: w.code,
            name: w.name,
            type: w.type,
          })),
          crm_import_deferred: true,
        },
      };
    }

    case "assign_academy_training": {
      const plan =
        parseDeploymentPlanFromSnapshot(session.deployment_snapshot ?? {}) ??
        buildClinicDeploymentPlan(input);
      const academyPlan = assignAcademyTrainingTracks(plan);
      return {
        ok: true,
        output: {
          academy_plan: academyPlan,
          template_only: true,
        },
      };
    }

    case "prepare_sandbox_seed": {
      const plan =
        parseDeploymentPlanFromSnapshot(session.deployment_snapshot ?? {}) ??
        buildClinicDeploymentPlan(input);
      const template = buildClinicDeploymentTemplate(plan.templateCode);
      if (!template) {
        return {
          ok: false,
          errorCode: "template_missing",
          error: "Deployment template not found for sandbox seed.",
        };
      }
      const stepPlan: SandboxSeedStepPlan = buildSandboxSeedStepPlan(template, input);
      if (!stepPlan.enabled) {
        return {
          ok: true,
          output: { skipped: true, reason: "sandbox_disabled", seed_plan: stepPlan },
        };
      }
      const phaseCPlan = buildSandboxSeedPlan({
        sessionId: session.id,
        tenantId: session.tenant_id,
        tenantSlug: session.tenant_slug,
        templateCode: plan.templateCode,
        deploymentPlan: plan,
        generatedAt: SANDBOX_SEED_GENERATED_AT,
      });
      return {
        ok: true,
        output: {
          step_plan: stepPlan,
          sandbox_seed_plan: phaseCPlan,
          preview_total_records: phaseCPlan?.totalRecords ?? 0,
          apply_via_admin_ui: true,
        },
      };
    }

    case "ready_for_review": {
      return { ok: true, output: { ready_for_review: true, reviewed_by: actorAuthUserId } };
    }

    case "finalize": {
      const tenantId = session.tenant_id;
      if (!tenantId) {
        return {
          ok: false,
          errorCode: "tenant_missing",
          error: "Tenant must be provisioned before finalize.",
        };
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
      return {
        ok: true,
        output: { finalized: true, tenant_id: tenantId, completed_at: completedAt },
      };
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
  const loaded = await loadTenantProvisioningSessionDetail(id, {
    ...opts,
    skipAuthCheck: true,
    actorAuthUserId: auth.actorAuthUserId,
  });
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

  const exec = await executeStepLogic(
    supabase,
    freshSession.detail.session,
    step,
    auth.actorAuthUserId
  );
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
  const loaded = await loadTenantProvisioningSessionDetail(id, {
    ...opts,
    skipAuthCheck: true,
    actorAuthUserId: auth.actorAuthUserId,
  });
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

  return runTenantProvisioningStep(id, code, {
    ...opts,
    actorAuthUserId: auth.actorAuthUserId,
    skipAuthCheck: true,
  });
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

  const prereqSteps = [
    "validate_input",
    "check_slug_availability",
    "provision_tenant_core",
    "apply_module_entitlements",
    "apply_verification_status",
    "deploy_clinic_configuration",
    "assign_academy_training",
    "prepare_sandbox_seed",
  ];
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
