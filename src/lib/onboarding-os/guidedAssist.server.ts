import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiHomeDashboardPayload } from "@/src/lib/fiOs/fiHomeDashboardLoader.server";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { loadWorkspaceProfileKeyForViewer } from "@/src/lib/fi-os/workspaceProfile.server";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";
import { logStructured } from "@/src/lib/server/structuredLog";

import { getGuidedAssistTipByCode } from "./guidedAssistCatalog";
import {
  buildGuidedAssistResolvedPreferences,
  buildGuidedAssistSessionPayload,
  buildGuidedAssistSetupFlagsFromChecklist,
  buildSnoozeUntilIso,
  computeGuidedAssistOnboardingPhase,
  parseDismissedTipCodes,
  parseSnoozedTips,
  resolveGuidedAssistPageKey,
  summarizeGuidedAssistUsageEvents,
  validateGuidedAssistSnoozeHours,
} from "./guidedAssistCore";
import type {
  GuidedAssistEventKind,
  GuidedAssistSessionPayload,
  GuidedAssistTenantDefaults,
  GuidedAssistUsageSummary,
  GuidedAssistUserPreferences,
} from "./guidedAssistTypes";

export type GuidedAssistPreferencesRow = {
  id: string;
  tenant_id: string;
  fi_user_id: string | null;
  assist_enabled: boolean | null;
  default_enabled_during_onboarding: boolean;
  default_assist_enabled: boolean;
  dismissed_tip_codes: unknown;
  snoozed_tips: unknown;
  metadata: Record<string, unknown>;
};

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  actorAuthUserId?: string | null;
  skipAuthCheck?: boolean;
};

type AuthResult =
  | { ok: true; actorAuthUserId: string; fiUserId: string }
  | { ok: false; error: string };

async function resolveTenantMemberAuth(tenantId: string, opts: ServerOpts): Promise<AuthResult> {
  const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
  if (!authId) return { ok: false, error: "Authentication required." };
  if (opts.skipAuthCheck && opts.actorAuthUserId) {
    const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
    const { data } = await supabase
      .from("fi_users")
      .select("id")
      .eq("tenant_id", tenantId.trim())
      .eq("auth_user_id", authId)
      .maybeSingle();
    if (!data) return { ok: false, error: "Tenant membership required." };
    return { ok: true, actorAuthUserId: authId, fiUserId: String((data as { id: string }).id) };
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Tenant membership required." };
  return { ok: true, actorAuthUserId: authId, fiUserId: String((data as { id: string }).id) };
}

function rowToTenantDefaults(row: GuidedAssistPreferencesRow | null): GuidedAssistTenantDefaults {
  return {
    defaultEnabledDuringOnboarding: row?.default_enabled_during_onboarding ?? true,
    defaultAssistEnabled: row?.default_assist_enabled ?? false,
  };
}

function rowToUserPreferences(row: GuidedAssistPreferencesRow | null): GuidedAssistUserPreferences {
  return {
    assistEnabled: row?.assist_enabled ?? null,
    dismissedTipCodes: parseDismissedTipCodes(row?.dismissed_tip_codes),
    snoozedTips: parseSnoozedTips(row?.snoozed_tips),
  };
}

async function loadTenantDefaultRow(
  supabase: SupabaseClient,
  tenantId: string
): Promise<GuidedAssistPreferencesRow | null> {
  const { data, error } = await supabase
    .from("fi_guided_assist_preferences")
    .select("*")
    .eq("tenant_id", tenantId)
    .is("fi_user_id", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GuidedAssistPreferencesRow | null) ?? null;
}

async function loadUserPreferenceRow(
  supabase: SupabaseClient,
  tenantId: string,
  fiUserId: string
): Promise<GuidedAssistPreferencesRow | null> {
  const { data, error } = await supabase
    .from("fi_guided_assist_preferences")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("fi_user_id", fiUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GuidedAssistPreferencesRow | null) ?? null;
}

async function ensureTenantDefaultRow(
  supabase: SupabaseClient,
  tenantId: string
): Promise<GuidedAssistPreferencesRow> {
  const existing = await loadTenantDefaultRow(supabase, tenantId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("fi_guided_assist_preferences")
    .insert({
      tenant_id: tenantId,
      fi_user_id: null,
      default_enabled_during_onboarding: true,
      default_assist_enabled: false,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as GuidedAssistPreferencesRow;
}

async function ensureUserPreferenceRow(
  supabase: SupabaseClient,
  tenantId: string,
  fiUserId: string
): Promise<GuidedAssistPreferencesRow> {
  const existing = await loadUserPreferenceRow(supabase, tenantId, fiUserId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("fi_guided_assist_preferences")
    .insert({
      tenant_id: tenantId,
      fi_user_id: fiUserId,
      assist_enabled: null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as GuidedAssistPreferencesRow;
}

export async function recordGuidedAssistEvent(
  tenantId: string,
  opts: {
    fiUserId?: string | null;
    eventKind: GuidedAssistEventKind;
    guidanceArea?: string | null;
    guidanceCode?: string | null;
    pageKey?: string | null;
    detail?: Record<string, unknown>;
  },
  serverOpts: ServerOpts = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    const { error } = await supabase.from("fi_guided_assist_events").insert({
      tenant_id: tenantId.trim(),
      fi_user_id: opts.fiUserId ?? null,
      event_kind: opts.eventKind,
      guidance_area: opts.guidanceArea ?? null,
      guidance_code: opts.guidanceCode ?? null,
      page_key: opts.pageKey ?? null,
      detail: opts.detail ?? {},
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to record assist event." };
  }
}

export async function loadGuidedAssistSessionPayload(
  tenantId: string,
  pathname: string,
  serverOpts: ServerOpts = {}
): Promise<
  { ok: true; payload: GuidedAssistSessionPayload | null } | { ok: false; error: string }
> {
  try {
    const auth = await resolveTenantMemberAuth(tenantId, serverOpts);
    if (!auth.ok) return auth;

    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    const tid = tenantId.trim();
    const tenantBase = `/fi-admin/${tid}`;
    const pageKey = resolveGuidedAssistPageKey(pathname, tenantBase);

    const [tenantDefaultRow, userRow, workspaceProfileKey, adminProf, homePayload] =
      await Promise.all([
        ensureTenantDefaultRow(supabase, tid),
        ensureUserPreferenceRow(supabase, tid, auth.fiUserId),
        loadWorkspaceProfileKeyForViewer(tid),
        loadActiveTenantAdminProfileForSession(tid, auth.actorAuthUserId),
        loadFiHomeDashboardPayload(tid, { showCrmShellChecklistItems: false }),
      ]);

    const setupFlags = buildGuidedAssistSetupFlagsFromChecklist(homePayload.checklist);
    const isOnboardingPhase = computeGuidedAssistOnboardingPhase(setupFlags);
    const tenantDefaults = rowToTenantDefaults(tenantDefaultRow);
    const userPreferences = rowToUserPreferences(userRow);
    const resolved = buildGuidedAssistResolvedPreferences({
      tenantDefaults,
      userPreferences,
      isOnboardingPhase,
    });

    const ctx = {
      tenantId: tid,
      pageKey,
      workspaceProfileKey: workspaceProfileKey as FiWorkspaceProfileKey,
      tenantAdminRole: (adminProf?.adminRole ?? null) as FiTenantAdminRole | null,
      setupFlags,
      isOnboardingPhase,
    };

    const payload = buildGuidedAssistSessionPayload({
      ctx,
      resolved,
      userPreferences,
    });

    return { ok: true, payload };
  } catch (e) {
    logStructured("error", "guided_assist.load_session_error", { tenantId, error: String(e) });
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load guided assist." };
  }
}

export async function setGuidedAssistEnabledForUser(
  tenantId: string,
  enabled: boolean,
  serverOpts: ServerOpts = {}
): Promise<{ ok: true; assistEnabled: boolean } | { ok: false; error: string }> {
  try {
    const auth = await resolveTenantMemberAuth(tenantId, serverOpts);
    if (!auth.ok) return auth;

    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    const tid = tenantId.trim();
    await ensureTenantDefaultRow(supabase, tid);
    const row = await ensureUserPreferenceRow(supabase, tid, auth.fiUserId);

    const { error } = await supabase
      .from("fi_guided_assist_preferences")
      .update({ assist_enabled: enabled })
      .eq("id", row.id);
    if (error) return { ok: false, error: error.message };

    await recordGuidedAssistEvent(
      tid,
      {
        fiUserId: auth.fiUserId,
        eventKind: enabled ? "assist_enabled" : "assist_disabled",
      },
      serverOpts
    );

    return { ok: true, assistEnabled: enabled };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update assist preference.",
    };
  }
}

export async function setGuidedAssistTenantDefaults(
  tenantId: string,
  defaults: Partial<GuidedAssistTenantDefaults>,
  serverOpts: ServerOpts = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const auth = await resolveTenantMemberAuth(tenantId, serverOpts);
    if (!auth.ok) return auth;

    const adminProf = await loadActiveTenantAdminProfileForSession(tenantId, auth.actorAuthUserId);
    if (adminProf?.adminRole !== "clinic_admin" && adminProf?.adminRole !== "operations_admin") {
      return {
        ok: false,
        error: "Clinic admin access is required to change tenant assist defaults.",
      };
    }

    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    const row = await ensureTenantDefaultRow(supabase, tenantId.trim());

    const patch: Record<string, boolean> = {};
    if (defaults.defaultEnabledDuringOnboarding !== undefined) {
      patch.default_enabled_during_onboarding = defaults.defaultEnabledDuringOnboarding;
    }
    if (defaults.defaultAssistEnabled !== undefined) {
      patch.default_assist_enabled = defaults.defaultAssistEnabled;
    }

    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabase
      .from("fi_guided_assist_preferences")
      .update(patch)
      .eq("id", row.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update tenant defaults.",
    };
  }
}

export async function dismissGuidedAssistTip(
  tenantId: string,
  tipCode: string,
  serverOpts: ServerOpts = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const auth = await resolveTenantMemberAuth(tenantId, serverOpts);
    if (!auth.ok) return auth;

    const tip = getGuidedAssistTipByCode(tipCode);
    if (!tip) return { ok: false, error: "Unknown guidance tip." };
    if (!tip.dismissible) return { ok: false, error: "This tip cannot be dismissed." };

    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    const tid = tenantId.trim();
    const row = await ensureUserPreferenceRow(supabase, tid, auth.fiUserId);
    const dismissed = new Set(parseDismissedTipCodes(row.dismissed_tip_codes));
    dismissed.add(tip.code);

    const { error } = await supabase
      .from("fi_guided_assist_preferences")
      .update({ dismissed_tip_codes: [...dismissed] })
      .eq("id", row.id);
    if (error) return { ok: false, error: error.message };

    await recordGuidedAssistEvent(
      tid,
      {
        fiUserId: auth.fiUserId,
        eventKind: "tip_dismissed",
        guidanceArea: tip.area,
        guidanceCode: tip.code,
      },
      serverOpts
    );

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to dismiss tip." };
  }
}

export async function snoozeGuidedAssistTip(
  tenantId: string,
  tipCode: string,
  snoozeHours?: number | null,
  serverOpts: ServerOpts = {}
): Promise<{ ok: true; snoozeUntil: string } | { ok: false; error: string }> {
  try {
    const auth = await resolveTenantMemberAuth(tenantId, serverOpts);
    if (!auth.ok) return auth;

    const tip = getGuidedAssistTipByCode(tipCode);
    if (!tip) return { ok: false, error: "Unknown guidance tip." };

    const hours = validateGuidedAssistSnoozeHours(snoozeHours ?? tip.snoozeHours ?? 24);
    const snoozeUntil = buildSnoozeUntilIso(hours);

    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    const tid = tenantId.trim();
    const row = await ensureUserPreferenceRow(supabase, tid, auth.fiUserId);
    const snoozed = parseSnoozedTips(row.snoozed_tips);
    snoozed[tip.code] = snoozeUntil;

    const { error } = await supabase
      .from("fi_guided_assist_preferences")
      .update({ snoozed_tips: snoozed })
      .eq("id", row.id);
    if (error) return { ok: false, error: error.message };

    await recordGuidedAssistEvent(
      tid,
      {
        fiUserId: auth.fiUserId,
        eventKind: "tip_snoozed",
        guidanceArea: tip.area,
        guidanceCode: tip.code,
        detail: { snoozeUntil, snoozeHours: hours },
      },
      serverOpts
    );

    return { ok: true, snoozeUntil };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to snooze tip." };
  }
}

export async function canViewGuidedAssistUsageSummary(
  tenantId: string,
  serverOpts: ServerOpts = {}
): Promise<boolean> {
  const auth = await resolveTenantMemberAuth(tenantId, serverOpts);
  if (!auth.ok) return false;

  const adminProf = await loadActiveTenantAdminProfileForSession(tenantId, auth.actorAuthUserId);
  return (
    adminProf?.adminRole === "clinic_admin" ||
    adminProf?.adminRole === "operations_admin" ||
    adminProf?.adminRole === "data_safety_admin"
  );
}

async function enrichReliantUsersWithEmail(
  supabase: SupabaseClient,
  rows: { fiUserId: string; tipsShown: number }[]
): Promise<{ fiUserId: string; email: string | null; tipsShown: number }[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.fiUserId);
  const { data } = await supabase.from("fi_users").select("id, email").in("id", ids);
  const emailById = new Map<string, string | null>();
  for (const row of (data ?? []) as { id: string; email: string | null }[]) {
    emailById.set(String(row.id), row.email ? String(row.email) : null);
  }
  return rows.map((row) => ({
    fiUserId: row.fiUserId,
    email: emailById.get(row.fiUserId) ?? null,
    tipsShown: row.tipsShown,
  }));
}

export async function loadGuidedAssistUsageSummary(
  tenantId: string,
  windowDays = 30,
  serverOpts: ServerOpts = {}
): Promise<{ ok: true; summary: GuidedAssistUsageSummary } | { ok: false; error: string }> {
  try {
    const auth = await resolveTenantMemberAuth(tenantId, serverOpts);
    if (!auth.ok) return auth;

    if (!(await canViewGuidedAssistUsageSummary(tenantId, serverOpts))) {
      return { ok: false, error: "Admin access is required to view assist usage." };
    }

    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("fi_guided_assist_events")
      .select("fi_user_id, event_kind, guidance_area, guidance_code")
      .eq("tenant_id", tenantId.trim())
      .gte("occurred_at", since);
    if (error) return { ok: false, error: error.message };

    const stats = summarizeGuidedAssistUsageEvents(
      tenantId.trim(),
      (data ?? []) as {
        fi_user_id: string | null;
        event_kind: string;
        guidance_area: string | null;
        guidance_code: string | null;
      }[],
      windowDays
    );

    const reliantUsers = await enrichReliantUsersWithEmail(supabase, stats.reliantUsers);

    return {
      ok: true,
      summary: {
        tenantId: tenantId.trim(),
        windowDays,
        ...stats,
        reliantUsers,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load assist usage." };
  }
}
