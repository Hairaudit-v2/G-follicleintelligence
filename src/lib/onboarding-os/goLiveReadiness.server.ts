import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import { logStructured } from "@/src/lib/server/structuredLog";

import {
  buildGoLiveApprovalEventDetail,
  buildGoLiveReadinessSnapshot,
  canPlatformAdminApproveGoLive,
} from "./goLiveReadinessCore";
import type {
  GoLiveReadinessApprovalEvent,
  GoLiveReadinessCheckCode,
  GoLiveReadinessReviewStatus,
  GoLiveReadinessSnapshot,
} from "./goLiveReadinessTypes";
import { GO_LIVE_READINESS_CHECK_CODES } from "./goLiveReadinessTypes";
import { parseSandboxSeedHistory } from "./tenantProvisioningCore";
import type {
  ClinicDeploymentPlan,
  ProvisioningStepCode,
  ProvisioningStepStatus,
} from "./tenantProvisioningTypes";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  actorAuthUserId?: string | null;
  skipAuthCheck?: boolean;
  /** When true, allow tenant members to load (read-only). Platform admin always allowed. */
  allowTenantMemberRead?: boolean;
  persistSnapshot?: boolean;
};

type SessionRow = {
  id: string;
  tenant_id: string | null;
  tenant_name: string;
  tenant_slug: string;
  deployment_snapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

type StepRow = {
  step_code: string;
  status: string;
};

type ReviewRow = {
  review_kind: string;
  check_code: string | null;
  status: string;
  reviewer_label: string | null;
  reviewed_at: string | null;
};

export type GoLiveReadinessLoadResult =
  | { ok: true; snapshot: GoLiveReadinessSnapshot }
  | { ok: false; error: string };

function parseDeploymentPlan(snapshot: Record<string, unknown>): ClinicDeploymentPlan | null {
  const plan = snapshot?.plan;
  if (!plan || typeof plan !== "object") return null;
  return plan as ClinicDeploymentPlan;
}

async function resolvePlatformAdminAuth(
  opts: ServerOpts
): Promise<
  { ok: true; actorAuthUserId: string; isPlatformAdmin: true } | { ok: false; error: string }
> {
  const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
  if (!authId) return { ok: false, error: "Authentication required." };
  if (opts.skipAuthCheck && opts.actorAuthUserId) {
    return { ok: true, actorAuthUserId: authId, isPlatformAdmin: true };
  }
  const os = await loadFiOsIdentity(authId);
  if (!isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
    return { ok: false, error: "Platform administrator access is required." };
  }
  return { ok: true, actorAuthUserId: authId, isPlatformAdmin: true };
}

async function resolveTenantAdminAuth(
  tenantId: string,
  opts: ServerOpts
): Promise<
  | { ok: true; actorAuthUserId: string; fiUserId: string; isPlatformAdmin: false }
  | { ok: false; error: string }
> {
  const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
  if (!authId) return { ok: false, error: "Authentication required." };

  const os = await loadFiOsIdentity(authId);
  if (isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
    return { ok: false, error: "Use platform admin flows for this action." };
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Tenant membership required." };

  const adminProf = await loadActiveTenantAdminProfileForSession(tenantId, authId);
  if (adminProf?.adminRole !== "clinic_admin" && adminProf?.adminRole !== "operations_admin") {
    return { ok: false, error: "Tenant admin access is required." };
  }

  return {
    ok: true,
    actorAuthUserId: authId,
    fiUserId: String((data as { id: string }).id),
    isPlatformAdmin: false,
  };
}

async function resolveReadAuth(
  tenantId: string | null,
  opts: ServerOpts
): Promise<{ ok: true } | { ok: false; error: string }> {
  const platform = await resolvePlatformAdminAuth({ ...opts, skipAuthCheck: false });
  if (platform.ok) return { ok: true };

  if (!opts.allowTenantMemberRead || !tenantId) {
    return { ok: false, error: "Platform administrator access is required." };
  }

  const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
  if (!authId) return { ok: false, error: "Authentication required." };

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Tenant membership required." };
  return { ok: true };
}

async function loadSessionById(
  supabase: SupabaseClient,
  sessionId: string
): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from("fi_tenant_provisioning_sessions")
    .select("id, tenant_id, tenant_name, tenant_slug, deployment_snapshot, metadata")
    .eq("id", sessionId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SessionRow | null) ?? null;
}

async function loadLatestSessionForTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from("fi_tenant_provisioning_sessions")
    .select("id, tenant_id, tenant_name, tenant_slug, deployment_snapshot, metadata")
    .eq("tenant_id", tenantId.trim())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SessionRow | null) ?? null;
}

async function loadStepStatuses(
  supabase: SupabaseClient,
  sessionId: string
): Promise<Partial<Record<ProvisioningStepCode, ProvisioningStepStatus>>> {
  const { data, error } = await supabase
    .from("fi_tenant_provisioning_steps")
    .select("step_code, status")
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);

  const map: Partial<Record<ProvisioningStepCode, ProvisioningStepStatus>> = {};
  for (const row of (data ?? []) as StepRow[]) {
    map[row.step_code as ProvisioningStepCode] = row.status as ProvisioningStepStatus;
  }
  return map;
}

async function loadReviewState(
  supabase: SupabaseClient,
  sessionId: string,
  tenantId: string | null
): Promise<{ reviews: GoLiveReadinessReviewStatus; checklistReviewedCodes: string[] }> {
  const { data, error } = await supabase
    .from("fi_tenant_go_live_readiness_reviews")
    .select("review_kind, check_code, status, reviewer_label, reviewed_at")
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ReviewRow[];
  const owner = rows.find((r) => r.review_kind === "owner_review" && r.status === "complete");
  const platform = rows.find((r) => r.review_kind === "platform_review" && r.status === "complete");
  const checklistReviewedCodes = rows
    .filter((r) => r.review_kind === "checklist_item" && r.status === "complete" && r.check_code)
    .map((r) => String(r.check_code));

  let goLiveApproved = false;
  let goLiveApprovedAt: string | null = null;
  if (tenantId) {
    const { data: approvalRows } = await supabase
      .from("fi_tenant_go_live_approval_events")
      .select("occurred_at")
      .eq("session_id", sessionId)
      .eq("event_kind", "go_live_approved")
      .order("occurred_at", { ascending: false })
      .limit(1);
    const latest = (approvalRows ?? [])[0] as { occurred_at: string } | undefined;
    if (latest) {
      goLiveApproved = true;
      goLiveApprovedAt = latest.occurred_at;
    }
  }

  return {
    reviews: {
      ownerReviewComplete: Boolean(owner),
      ownerReviewedAt: owner?.reviewed_at ?? null,
      ownerReviewerLabel: owner?.reviewer_label ?? null,
      platformReviewComplete: Boolean(platform),
      platformReviewedAt: platform?.reviewed_at ?? null,
      platformReviewerLabel: platform?.reviewer_label ?? null,
      goLiveApproved,
      goLiveApprovedAt,
    },
    checklistReviewedCodes,
  };
}

async function gatherSignals(
  supabase: SupabaseClient,
  session: SessionRow
): Promise<Parameters<typeof buildGoLiveReadinessSnapshot>[0]> {
  const tenantId = session.tenant_id;
  const deploymentPlan = parseDeploymentPlan(session.deployment_snapshot ?? {});
  const sandboxSeedHistory = parseSandboxSeedHistory(session.metadata ?? {});
  const stepStatuses = await loadStepStatuses(supabase, session.id);
  const { reviews, checklistReviewedCodes } = await loadReviewState(supabase, session.id, tenantId);

  let clinicCount = 0;
  let serviceCount = 0;
  let enabledModuleCount = 0;
  let staffUserCount = 0;
  let adminRoleAssignedCount = 0;
  let guidedAssistConfigured = false;

  if (tenantId) {
    const [clinics, services, modules, users, admins, assist] = await Promise.all([
      supabase
        .from("fi_clinics")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      supabase
        .from("fi_services")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      supabase
        .from("fi_tenant_modules")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("enabled", true),
      supabase
        .from("fi_users")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      supabase
        .from("fi_tenant_admin_users")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "active"),
      supabase
        .from("fi_guided_assist_preferences")
        .select("id")
        .eq("tenant_id", tenantId)
        .is("fi_user_id", null)
        .maybeSingle(),
    ]);

    clinicCount = clinics.count ?? 0;
    serviceCount = services.count ?? 0;
    enabledModuleCount = modules.count ?? 0;
    staffUserCount = users.count ?? 0;
    adminRoleAssignedCount = admins.count ?? 0;
    guidedAssistConfigured = Boolean(assist.data);
  }

  return {
    sessionId: session.id,
    tenantId,
    tenantName: session.tenant_name,
    tenantSlug: session.tenant_slug,
    stepStatuses,
    deploymentPlan,
    sandboxSeedEnabled: deploymentPlan?.sandboxSeed.enabled ?? false,
    sandboxSeedHistoryLength: sandboxSeedHistory.length,
    clinicCount,
    enabledModuleCount,
    expectedModuleCount: deploymentPlan?.moduleBundle.enabledModules.length ?? 0,
    serviceCount,
    expectedServiceCount: deploymentPlan?.serviceTemplates.length ?? 0,
    staffUserCount,
    adminRoleAssignedCount,
    guidedAssistConfigured,
    reviews,
    checklistReviewedCodes,
    generatedAt: new Date().toISOString(),
  };
}

async function persistSnapshot(
  supabase: SupabaseClient,
  snapshot: GoLiveReadinessSnapshot
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fi_tenant_go_live_readiness_snapshots")
    .insert({
      tenant_id: snapshot.tenantId,
      session_id: snapshot.sessionId,
      status: snapshot.status,
      score_percent: snapshot.score.percent,
      snapshot: snapshot as unknown as Record<string, unknown>,
      generated_at: snapshot.generatedAt,
    })
    .select("id")
    .single();
  if (error) {
    logStructured("warn", "go_live_readiness.snapshot_persist_failed", { error: error.message });
    return null;
  }
  return String((data as { id: string }).id);
}

async function appendApprovalEvent(
  supabase: SupabaseClient,
  opts: {
    tenantId: string;
    sessionId: string;
    eventKind: GoLiveReadinessApprovalEvent["eventKind"];
    checkCode?: string | null;
    actorAuthUserId: string | null;
    actorFiUserId?: string | null;
    actorLabel?: string | null;
    actorRole: "tenant_admin" | "platform_admin" | null;
    detail?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.from("fi_tenant_go_live_approval_events").insert({
    tenant_id: opts.tenantId,
    session_id: opts.sessionId,
    event_kind: opts.eventKind,
    check_code: opts.checkCode ?? null,
    actor_auth_user_id: opts.actorAuthUserId,
    actor_fi_user_id: opts.actorFiUserId ?? null,
    actor_label: opts.actorLabel ?? null,
    actor_role: opts.actorRole,
    detail: opts.detail ?? {},
  });
  if (error) throw new Error(error.message);
}

async function upsertReviewRow(
  supabase: SupabaseClient,
  opts: {
    tenantId: string;
    sessionId: string;
    reviewKind: "checklist_item" | "owner_review" | "platform_review";
    checkCode?: string | null;
    status: "complete";
    reviewerFiUserId?: string | null;
    reviewerAuthUserId: string;
    reviewerLabel: string | null;
    reviewerRole: "tenant_admin" | "platform_admin";
    notes?: string | null;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const payload = {
    tenant_id: opts.tenantId,
    session_id: opts.sessionId,
    review_kind: opts.reviewKind,
    check_code: opts.checkCode ?? null,
    status: opts.status,
    reviewer_fi_user_id: opts.reviewerFiUserId ?? null,
    reviewer_auth_user_id: opts.reviewerAuthUserId,
    reviewer_label: opts.reviewerLabel,
    reviewer_role: opts.reviewerRole,
    notes: opts.notes ?? null,
    reviewed_at: now,
    updated_at: now,
  };

  if (opts.reviewKind === "checklist_item" && opts.checkCode) {
    const { data: existing } = await supabase
      .from("fi_tenant_go_live_readiness_reviews")
      .select("id")
      .eq("session_id", opts.sessionId)
      .eq("review_kind", "checklist_item")
      .eq("check_code", opts.checkCode)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("fi_tenant_go_live_readiness_reviews")
        .update(payload)
        .eq("id", (existing as { id: string }).id);
      if (error) throw new Error(error.message);
      return;
    }
  }

  if (opts.reviewKind === "owner_review" || opts.reviewKind === "platform_review") {
    const { data: existing } = await supabase
      .from("fi_tenant_go_live_readiness_reviews")
      .select("id")
      .eq("session_id", opts.sessionId)
      .eq("review_kind", opts.reviewKind)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("fi_tenant_go_live_readiness_reviews")
        .update(payload)
        .eq("id", (existing as { id: string }).id);
      if (error) throw new Error(error.message);
      return;
    }
  }

  const { error } = await supabase.from("fi_tenant_go_live_readiness_reviews").insert(payload);
  if (error) throw new Error(error.message);
}

async function resolveActorLabel(
  supabase: SupabaseClient,
  authUserId: string,
  fiUserId?: string | null
): Promise<string | null> {
  if (fiUserId) {
    const { data } = await supabase
      .from("fi_users")
      .select("email")
      .eq("id", fiUserId)
      .maybeSingle();
    if (data?.email) return String((data as { email: string }).email);
  }
  const { data } = await supabase
    .from("fi_users")
    .select("email")
    .eq("auth_user_id", authUserId)
    .limit(1)
    .maybeSingle();
  if (data?.email) return String((data as { email: string }).email);
  return authUserId.slice(0, 8);
}

/** Load go-live readiness snapshot for a provisioning session (platform admin or tenant read-only). */
export async function loadGoLiveReadinessSnapshot(
  sessionId: string,
  opts: ServerOpts = {}
): Promise<GoLiveReadinessLoadResult> {
  try {
    const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
    const session = await loadSessionById(supabase, sessionId.trim());
    if (!session) return { ok: false, error: "Provisioning session not found." };

    const auth = await resolveReadAuth(session.tenant_id, opts);
    if (!auth.ok) return auth;

    const signals = await gatherSignals(supabase, session);
    let snapshot = buildGoLiveReadinessSnapshot(signals);

    if (opts.persistSnapshot !== false) {
      const snapshotId = await persistSnapshot(supabase, snapshot);
      if (snapshotId) snapshot = { ...snapshot, snapshotId };
    }

    return { ok: true, snapshot };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to load go-live readiness.",
    };
  }
}

/** Load go-live readiness for a tenant (tenant admin read-only). */
export async function loadGoLiveReadinessSnapshotForTenant(
  tenantId: string,
  opts: ServerOpts = {}
): Promise<GoLiveReadinessLoadResult> {
  try {
    const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
    const session = await loadLatestSessionForTenant(supabase, tenantId.trim());
    if (!session) return { ok: false, error: "No provisioning session found for this tenant." };

    const auth = await resolveReadAuth(tenantId, { ...opts, allowTenantMemberRead: true });
    if (!auth.ok) return auth;

    return loadGoLiveReadinessSnapshot(session.id, {
      ...opts,
      allowTenantMemberRead: true,
      persistSnapshot: opts.persistSnapshot ?? false,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to load go-live readiness.",
    };
  }
}

/** Tenant or platform admin acknowledges a checklist item. */
export async function markGoLiveChecklistItemReviewed(
  sessionId: string,
  checkCode: string,
  opts: ServerOpts = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const code = checkCode.trim() as GoLiveReadinessCheckCode;
  if (!(GO_LIVE_READINESS_CHECK_CODES as readonly string[]).includes(code)) {
    return { ok: false, error: "Invalid checklist item code." };
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const session = await loadSessionById(supabase, sessionId.trim());
  if (!session?.tenant_id)
    return { ok: false, error: "Tenant must be provisioned before checklist review." };

  const platformAuth = await resolvePlatformAdminAuth(opts);
  let actorAuthUserId: string;
  let fiUserId: string | null = null;
  let reviewerRole: "tenant_admin" | "platform_admin";

  if (platformAuth.ok) {
    actorAuthUserId = platformAuth.actorAuthUserId;
    reviewerRole = "platform_admin";
  } else {
    const tenantAuth = await resolveTenantAdminAuth(session.tenant_id, opts);
    if (!tenantAuth.ok) return tenantAuth;
    actorAuthUserId = tenantAuth.actorAuthUserId;
    fiUserId = tenantAuth.fiUserId;
    reviewerRole = "tenant_admin";
  }

  const label = await resolveActorLabel(supabase, actorAuthUserId, fiUserId);

  await upsertReviewRow(supabase, {
    tenantId: session.tenant_id,
    sessionId: session.id,
    reviewKind: "checklist_item",
    checkCode: code,
    status: "complete",
    reviewerFiUserId: fiUserId,
    reviewerAuthUserId: actorAuthUserId,
    reviewerLabel: label,
    reviewerRole,
  });

  await appendApprovalEvent(supabase, {
    tenantId: session.tenant_id,
    sessionId: session.id,
    eventKind: "checklist_item",
    checkCode: code,
    actorAuthUserId,
    actorFiUserId: fiUserId,
    actorLabel: label,
    actorRole: reviewerRole,
    detail: { check_code: code },
  });

  return { ok: true };
}

/** Tenant admin marks owner review complete (cannot approve go-live). */
export async function markOwnerReviewComplete(
  sessionId: string,
  opts: ServerOpts = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const session = await loadSessionById(supabase, sessionId.trim());
  if (!session?.tenant_id)
    return { ok: false, error: "Tenant must be provisioned before owner review." };

  const platformAuth = await resolvePlatformAdminAuth(opts);
  let actorAuthUserId: string;
  let fiUserId: string | null = null;
  let reviewerRole: "tenant_admin" | "platform_admin";

  if (platformAuth.ok) {
    actorAuthUserId = platformAuth.actorAuthUserId;
    reviewerRole = "platform_admin";
  } else {
    const tenantAuth = await resolveTenantAdminAuth(session.tenant_id, opts);
    if (!tenantAuth.ok) return tenantAuth;
    actorAuthUserId = tenantAuth.actorAuthUserId;
    fiUserId = tenantAuth.fiUserId;
    reviewerRole = "tenant_admin";
  }

  const label = await resolveActorLabel(supabase, actorAuthUserId, fiUserId);

  await upsertReviewRow(supabase, {
    tenantId: session.tenant_id,
    sessionId: session.id,
    reviewKind: "owner_review",
    status: "complete",
    reviewerFiUserId: fiUserId,
    reviewerAuthUserId: actorAuthUserId,
    reviewerLabel: label,
    reviewerRole,
  });

  await appendApprovalEvent(supabase, {
    tenantId: session.tenant_id,
    sessionId: session.id,
    eventKind: "owner_review",
    actorAuthUserId,
    actorFiUserId: fiUserId,
    actorLabel: label,
    actorRole: reviewerRole,
    detail: {},
  });

  return { ok: true };
}

/** Platform admin marks platform review complete. */
export async function markPlatformReviewComplete(
  sessionId: string,
  opts: ServerOpts = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await resolvePlatformAdminAuth(opts);
  if (!auth.ok) return auth;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const session = await loadSessionById(supabase, sessionId.trim());
  if (!session?.tenant_id)
    return { ok: false, error: "Tenant must be provisioned before platform review." };

  const label = await resolveActorLabel(supabase, auth.actorAuthUserId);

  await upsertReviewRow(supabase, {
    tenantId: session.tenant_id,
    sessionId: session.id,
    reviewKind: "platform_review",
    status: "complete",
    reviewerAuthUserId: auth.actorAuthUserId,
    reviewerLabel: label,
    reviewerRole: "platform_admin",
  });

  await appendApprovalEvent(supabase, {
    tenantId: session.tenant_id,
    sessionId: session.id,
    eventKind: "platform_review",
    actorAuthUserId: auth.actorAuthUserId,
    actorLabel: label,
    actorRole: "platform_admin",
    detail: {},
  });

  return { ok: true };
}

/**
 * Platform admin approves production go-live.
 * Does NOT activate billing, import CRM data, or clean sandbox data.
 */
export async function approveTenantGoLive(
  sessionId: string,
  opts: ServerOpts = {}
): Promise<{ ok: true; snapshot: GoLiveReadinessSnapshot } | { ok: false; error: string }> {
  const auth = await resolvePlatformAdminAuth(opts);
  if (!auth.ok) return auth;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const session = await loadSessionById(supabase, sessionId.trim());
  if (!session?.tenant_id)
    return { ok: false, error: "Tenant must be provisioned before go-live approval." };

  const loaded = await loadGoLiveReadinessSnapshot(sessionId, {
    ...opts,
    skipAuthCheck: true,
    actorAuthUserId: auth.actorAuthUserId,
    persistSnapshot: false,
  });
  if (!loaded.ok) return loaded;

  const gate = canPlatformAdminApproveGoLive({
    isPlatformAdmin: true,
    snapshot: loaded.snapshot,
  });
  if (!gate.allowed) return { ok: false, error: gate.reason ?? "Go-live approval not allowed." };

  const now = new Date().toISOString();
  const eventDetail = buildGoLiveApprovalEventDetail(loaded.snapshot);

  await appendApprovalEvent(supabase, {
    tenantId: session.tenant_id,
    sessionId: session.id,
    eventKind: "go_live_approved",
    actorAuthUserId: auth.actorAuthUserId,
    actorLabel: await resolveActorLabel(supabase, auth.actorAuthUserId),
    actorRole: "platform_admin",
    detail: eventDetail,
  });

  const { data: settingsRow } = await supabase
    .from("fi_tenant_settings")
    .select("metadata")
    .eq("tenant_id", session.tenant_id)
    .maybeSingle();
  const existingMeta =
    settingsRow?.metadata &&
    typeof settingsRow.metadata === "object" &&
    !Array.isArray(settingsRow.metadata)
      ? (settingsRow.metadata as Record<string, unknown>)
      : {};

  await supabase
    .from("fi_tenant_settings")
    .update({
      metadata: {
        ...existingMeta,
        is_live: true,
        go_live_at: now,
        go_live_session_id: session.id,
        go_live_approved_by: auth.actorAuthUserId,
      },
      updated_at: now,
    })
    .eq("tenant_id", session.tenant_id);

  const approvedSnapshot: GoLiveReadinessSnapshot = {
    ...loaded.snapshot,
    status: "approved",
    reviews: {
      ...loaded.snapshot.reviews,
      goLiveApproved: true,
      goLiveApprovedAt: now,
    },
    generatedAt: now,
  };

  const snapshotId = await persistSnapshot(supabase, approvedSnapshot);

  logStructured("info", "go_live_readiness.approved", {
    tenantId: session.tenant_id,
    sessionId: session.id,
    actorAuthUserId: auth.actorAuthUserId,
  });

  return {
    ok: true,
    snapshot: { ...approvedSnapshot, snapshotId },
  };
}

/** Whether tenant admin may view read-only go-live readiness. */
export async function canViewTenantGoLiveReadiness(
  tenantId: string,
  serverOpts: ServerOpts = {}
): Promise<boolean> {
  const authId = serverOpts.actorAuthUserId ?? (await resolveAuthUserId(null));
  if (!authId) return false;

  const os = await loadFiOsIdentity(authId);
  if (isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) return true;

  const adminProf = await loadActiveTenantAdminProfileForSession(tenantId, authId);
  return (
    adminProf?.adminRole === "clinic_admin" ||
    adminProf?.adminRole === "operations_admin" ||
    adminProf?.adminRole === "data_safety_admin"
  );
}

/** Returns false for tenant admins — only platform admins may approve. */
export async function canApproveTenantGoLive(
  sessionId: string,
  serverOpts: ServerOpts = {}
): Promise<boolean> {
  const authId = serverOpts.actorAuthUserId ?? (await resolveAuthUserId(null));
  if (!authId) return false;
  const os = await loadFiOsIdentity(authId);
  return isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);
}

export { buildGoLiveApprovalEventDetail };
