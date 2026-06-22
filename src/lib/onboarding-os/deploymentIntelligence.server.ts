import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import { logStructured } from "@/src/lib/server/structuredLog";

import {
  buildDeploymentIntelligenceSnapshot,
  inferCountryLabelFromTimezone,
} from "./deploymentIntelligenceCore";
import type {
  DeploymentIntelligenceSnapshot,
  GuidedAssistAdoptionInput,
  PlatformDeploymentDashboardRow,
} from "./deploymentIntelligenceTypes";
import { loadGoLiveReadinessSnapshot } from "./goLiveReadiness.server";
import { loadConnectorAuthReadinessInput } from "./externalConnectorAuth.server";
import { summarizeGuidedAssistUsageEvents } from "./guidedAssistCore";
import { parseSandboxSeedHistory } from "./tenantProvisioningCore";
import type { ProvisioningInput, ProvisioningSessionStatus } from "./tenantProvisioningTypes";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  actorAuthUserId?: string | null;
  skipAuthCheck?: boolean;
  allowTenantMemberRead?: boolean;
  persistSnapshot?: boolean;
};

type SessionRow = {
  id: string;
  tenant_id: string | null;
  tenant_name: string;
  tenant_slug: string;
  status: string;
  progress_percent: number;
  input_snapshot: Record<string, unknown>;
  deployment_snapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type DeploymentIntelligenceLoadResult =
  | { ok: true; snapshot: DeploymentIntelligenceSnapshot }
  | { ok: false; error: string };

const ACTIVE_PROVISIONING_STATUSES: ProvisioningSessionStatus[] = [
  "draft",
  "in_progress",
  "ready_for_review",
  "failed",
];

async function resolvePlatformAdminAuth(opts: ServerOpts): Promise<
  | { ok: true; actorAuthUserId: string }
  | { ok: false; error: string }
> {
  const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
  if (!authId) return { ok: false, error: "Authentication required." };
  if (opts.skipAuthCheck && opts.actorAuthUserId) {
    return { ok: true, actorAuthUserId: authId };
  }
  const os = await loadFiOsIdentity(authId);
  if (!isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
    return { ok: false, error: "Platform administrator access is required." };
  }
  return { ok: true, actorAuthUserId: authId };
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

  const adminProf = await loadActiveTenantAdminProfileForSession(tenantId, authId);
  if (
    adminProf?.adminRole !== "clinic_admin" &&
    adminProf?.adminRole !== "operations_admin" &&
    adminProf?.adminRole !== "data_safety_admin"
  ) {
    return { ok: false, error: "Tenant admin access is required." };
  }
  return { ok: true };
}

async function loadSessionById(supabase: SupabaseClient, sessionId: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from("fi_tenant_provisioning_sessions")
    .select(
      "id, tenant_id, tenant_name, tenant_slug, status, progress_percent, input_snapshot, deployment_snapshot, metadata"
    )
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
    .select(
      "id, tenant_id, tenant_name, tenant_slug, status, progress_percent, input_snapshot, deployment_snapshot, metadata"
    )
    .eq("tenant_id", tenantId.trim())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SessionRow | null) ?? null;
}

function parseDeploymentPlanSandboxEnabled(deploymentSnapshot: Record<string, unknown>): boolean {
  const plan = deploymentSnapshot?.plan;
  if (!plan || typeof plan !== "object") return false;
  const sandbox = (plan as { sandboxSeed?: { enabled?: boolean } }).sandboxSeed;
  return sandbox?.enabled === true;
}

async function loadGuidedAssistAdoptionInput(
  supabase: SupabaseClient,
  tenantId: string | null
): Promise<GuidedAssistAdoptionInput> {
  const empty: GuidedAssistAdoptionInput = {
    guidedAssistConfigured: false,
    totalEvents: 0,
    uniqueUsers: 0,
    tipsShown: 0,
    tipsDismissed: 0,
    nextActionsClicked: 0,
    modulesNeedingGuidanceReviewCount: 0,
  };
  if (!tenantId) return empty;

  const [{ data: prefs }, { data: events }] = await Promise.all([
    supabase
      .from("fi_guided_assist_preferences")
      .select("id")
      .eq("tenant_id", tenantId)
      .is("fi_user_id", null)
      .maybeSingle(),
    supabase
      .from("fi_guided_assist_events")
      .select("fi_user_id, event_kind, guidance_area, guidance_code")
      .eq("tenant_id", tenantId)
      .gte("occurred_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  if (!events?.length) {
    return { ...empty, guidedAssistConfigured: Boolean(prefs) };
  }

  const stats = summarizeGuidedAssistUsageEvents(
    tenantId,
    events as {
      fi_user_id: string | null;
      event_kind: string;
      guidance_area: string | null;
      guidance_code: string | null;
    }[],
    30
  );

  return {
    guidedAssistConfigured: Boolean(prefs),
    totalEvents: stats.totalEvents,
    uniqueUsers: stats.uniqueUsers,
    tipsShown: stats.tipsShown,
    tipsDismissed: stats.tipsDismissed,
    nextActionsClicked: stats.nextActionsClicked,
    modulesNeedingGuidanceReviewCount: stats.modulesNeedingGuidanceReview.length,
  };
}

async function buildSnapshotForSession(
  supabase: SupabaseClient,
  session: SessionRow,
  goLiveOpts: ServerOpts
): Promise<DeploymentIntelligenceSnapshot> {
  const goLiveLoaded = await loadGoLiveReadinessSnapshot(session.id, {
    ...goLiveOpts,
    persistSnapshot: false,
  });
  if (!goLiveLoaded.ok) {
    throw new Error(goLiveLoaded.error);
  }

  const input = session.input_snapshot as ProvisioningInput;
  const sandboxHistory = parseSandboxSeedHistory(session.metadata ?? {});
  const sandboxSeedEnabled = parseDeploymentPlanSandboxEnabled(session.deployment_snapshot ?? {});
  const [guidedAssistAdoption, connectorAuthReadiness] = await Promise.all([
    loadGuidedAssistAdoptionInput(supabase, session.tenant_id),
    loadConnectorAuthReadinessInput(supabase, session.tenant_id),
  ]);

  const calculatedAt = new Date().toISOString();
  const snapshot = buildDeploymentIntelligenceSnapshot({
    sessionId: session.id,
    tenantId: session.tenant_id,
    tenantName: session.tenant_name,
    tenantSlug: session.tenant_slug,
    countryLabel: inferCountryLabelFromTimezone(input.defaultTimezone),
    provisioningStatus: session.status as ProvisioningSessionStatus,
    provisioningProgressPercent: session.progress_percent ?? 0,
    sandboxSeedEnabled,
    sandboxSeedApplied: sandboxHistory.length > 0,
    goLiveReadiness: goLiveLoaded.snapshot,
    guidedAssistAdoption,
    connectorAuthReadiness,
    calculatedAt,
  });

  return snapshot;
}

export async function persistDeploymentIntelligenceSnapshot(
  snapshot: DeploymentIntelligenceSnapshot,
  opts: ServerOpts = {}
): Promise<string | null> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenant_deployment_intelligence_snapshots")
    .insert({
      tenant_id: snapshot.tenantId,
      provisioning_session_id: snapshot.sessionId,
      deployment_score: snapshot.deploymentScore,
      deployment_status: snapshot.deploymentStatus,
      domain_scores: snapshot.scoreBreakdown.domainScores,
      recommendations: snapshot.recommendations,
      source_snapshot: snapshot as unknown as Record<string, unknown>,
      calculated_at: snapshot.calculatedAt,
    })
    .select("id")
    .single();

  if (error) {
    logStructured("warn", "deployment_intelligence.snapshot_persist_failed", { error: error.message });
    return null;
  }
  return String((data as { id: string }).id);
}

export async function loadDeploymentIntelligenceSnapshot(
  sessionId: string,
  opts: ServerOpts = {}
): Promise<DeploymentIntelligenceLoadResult> {
  try {
    const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
    const session = await loadSessionById(supabase, sessionId.trim());
    if (!session) return { ok: false, error: "Provisioning session not found." };

    const auth = await resolveReadAuth(session.tenant_id, opts);
    if (!auth.ok) return auth;

    let snapshot = await buildSnapshotForSession(supabase, session, {
      ...opts,
      skipAuthCheck: true,
      actorAuthUserId: opts.actorAuthUserId,
    });

    if (opts.persistSnapshot !== false) {
      const snapshotId = await persistDeploymentIntelligenceSnapshot(snapshot, opts);
      if (snapshotId) snapshot = { ...snapshot, snapshotId };
    }

    return { ok: true, snapshot };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load deployment intelligence." };
  }
}

export async function loadDeploymentIntelligenceSnapshotForTenant(
  tenantId: string,
  opts: ServerOpts = {}
): Promise<DeploymentIntelligenceLoadResult> {
  try {
    const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
    const session = await loadLatestSessionForTenant(supabase, tenantId.trim());
    if (!session) return { ok: false, error: "No provisioning session found for this tenant." };

    return loadDeploymentIntelligenceSnapshot(session.id, {
      ...opts,
      allowTenantMemberRead: true,
      persistSnapshot: opts.persistSnapshot ?? false,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load deployment intelligence." };
  }
}

function resolveGoLiveApprovalState(
  snapshot: DeploymentIntelligenceSnapshot
): PlatformDeploymentDashboardRow["goLiveApprovalState"] {
  if (snapshot.goLiveReadiness.reviews.goLiveApproved) return "approved";
  if (snapshot.goLiveReadiness.status === "blocked") return "blocked";
  if (snapshot.goLiveReadiness.status === "ready") return "ready";
  return "pending";
}

function snapshotToDashboardRow(snapshot: DeploymentIntelligenceSnapshot): PlatformDeploymentDashboardRow {
  const criticalBlockers = snapshot.recommendations
    .filter((r) => r.severity === "blocker")
    .map((r) => r.message)
    .slice(0, 3);

  return {
    sessionId: snapshot.sessionId,
    tenantId: snapshot.tenantId,
    tenantName: snapshot.tenantName,
    tenantSlug: snapshot.tenantSlug,
    countryLabel: snapshot.countryLabel,
    provisioningStatus: (snapshot.provisioningStatus ?? "draft") as ProvisioningSessionStatus,
    provisioningProgressPercent: snapshot.provisioningProgressPercent,
    deploymentScore: snapshot.deploymentScore,
    deploymentStatus: snapshot.deploymentStatus,
    criticalBlockers,
    adoptionConfidenceScore: snapshot.adoptionConfidenceScore,
    goLiveApprovalState: resolveGoLiveApprovalState(snapshot),
  };
}

export async function loadPlatformDeploymentDashboard(
  opts: ServerOpts = {}
): Promise<{ ok: true; rows: PlatformDeploymentDashboardRow[] } | { ok: false; error: string }> {
  const auth = await resolvePlatformAdminAuth(opts);
  if (!auth.ok) return auth;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenant_provisioning_sessions")
    .select(
      "id, tenant_id, tenant_name, tenant_slug, status, progress_percent, input_snapshot, deployment_snapshot, metadata"
    )
    .in("status", ACTIVE_PROVISIONING_STATUSES)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) return { ok: false, error: error.message };

  const sessions = (data ?? []) as SessionRow[];
  const rows: PlatformDeploymentDashboardRow[] = [];

  for (const session of sessions) {
    try {
      const snapshot = await buildSnapshotForSession(supabase, session, {
        ...opts,
        skipAuthCheck: true,
        actorAuthUserId: auth.actorAuthUserId,
      });
      rows.push(snapshotToDashboardRow(snapshot));
    } catch {
      rows.push({
        sessionId: session.id,
        tenantId: session.tenant_id,
        tenantName: session.tenant_name,
        tenantSlug: session.tenant_slug,
        countryLabel: inferCountryLabelFromTimezone((session.input_snapshot as ProvisioningInput).defaultTimezone),
        provisioningStatus: session.status as ProvisioningSessionStatus,
        provisioningProgressPercent: session.progress_percent ?? 0,
        deploymentScore: 0,
        deploymentStatus: "early_setup",
        criticalBlockers: ["Could not calculate deployment intelligence."],
        adoptionConfidenceScore: 0,
        goLiveApprovalState: "pending",
      });
    }
  }

  rows.sort((a, b) => b.deploymentScore - a.deploymentScore);
  return { ok: true, rows };
}

export async function canViewTenantDeploymentIntelligence(
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
