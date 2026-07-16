import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isFiOsPlatformAdminFullSessionBypass,
  loadProxyFiUserRowForPlatformAdminTenant,
  resolveAuthUserId,
  resolveEffectiveTenantAuthUserId,
} from "@/src/lib/crm/crmGate";
import { loadFiHomeDashboardPayload } from "@/src/lib/fiOs/fiHomeDashboardLoader.server";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { loadWorkspaceProfileKeyForViewer } from "@/src/lib/fi-os/workspaceProfile.server";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";
import { logStructured } from "@/src/lib/server/structuredLog";
import { attemptStaffTenantPortalRepair } from "@/src/lib/workforce/staffTenantLinkRepair.server";
import { isFiOsCrossTenantDirectoryRole } from "@/src/lib/fiOs/fiOsRoles";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";

import {
  buildGuidedAssistResolvedPreferences,
  buildGuidedAssistSessionPayload,
  buildGuidedAssistSetupFlagsFromChecklist,
  buildSnoozeUntilIso,
  computeGuidedAssistOnboardingPhase,
  parseDismissedTipCodes,
  parseSnoozedTips,
  resolveEffectiveGuidedAssistEnabled,
  resolveGuidedAssistPageKey,
  buildGuidedAssistHealthExportCsv,
  summarizeGuidedAssistHealthMetrics,
  summarizeGuidedAssistUsageEvents,
  tipCodeMatchesHealthRole,
  validateGuidedAssistSnoozeHours,
} from "./guidedAssistCore";
import {
  applyRolloutItemToggle,
  buildGuidedAssistRolloutSnapshot,
  parseRolloutStatusFromMetadata,
  withRolloutStatusMetadata,
} from "./guidedAssistRollout";
import {
  buildWeeklyProgressSummary,
  computeEngagementStreakUpdate,
  emptyEngagementSnapshot,
  formatStreakMessage,
  resolveTeamHighlightFromCounts,
} from "./guidedAssistEngagementCore";
import {
  GUIDED_ASSIST_FORCE_SHOW_COOKIE,
  GUIDED_ASSIST_FORCE_SHOW_MAX_AGE_SEC,
  buildGuidedAssistDebugInfo,
  isGuidedAssistDebugQueryActive,
  isGuidedAssistForceShowCookieActive,
} from "./guidedAssistForceShow";
import { mapViewerToGuidedAssistTodayRole } from "./getRoleFirstTips";
import { guidedAssistDevLog } from "./guidedAssistLog";
import { buildGuidedAssistRoleModeLabel } from "./guidedAssistRoleMode";
import { inferGuidedAssistExperienceLevel } from "./getTieredAndContextualTips";
import {
  GUIDED_ASSIST_WHATS_NEW_VERSION,
  parseWhatsNewSeenFromMetadata,
  withWhatsNewSeenMetadata,
} from "./guidedAssistWhatsNew";
import { getGuidedAssistQuickActionByCode, getGuidedAssistTipByCode } from "./guidedAssistCatalog";
import type {
  GuidedAssistClinicStats,
  GuidedAssistEngagementSnapshot,
  GuidedAssistEventKind,
  GuidedAssistExperienceLevel,
  GuidedAssistHealthFilters,
  GuidedAssistHealthSnapshot,
  GuidedAssistHealthWindowDays,
  GuidedAssistRolloutSnapshot,
  GuidedAssistSessionPayload,
  GuidedAssistTenantDefaults,
  GuidedAssistTodayRoleKey,
  GuidedAssistUsageSummary,
  GuidedAssistUserPreferences,
} from "./guidedAssistTypes";
import {
  GUIDED_ASSIST_EXPERIENCE_LEVELS,
  GUIDED_ASSIST_WEEKLY_PROGRESS_GOAL,
} from "./guidedAssistTypes";
import { emptyGuidedAssistClinicStats } from "./guidedAssistCore";
import { calendarDateStringFromInstant } from "@/src/lib/calendar/calendarTimezone";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";

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
  /** Per-user Today role-first exposure count (migration 20261020120001). */
  today_home_views?: number | null;
  /** Optional experience tier override (migration 20261021120001). */
  experience_level?: string | null;
  created_at?: string | null;
  /** Engagement streak (migration 20261023120001). */
  engagement_streak_days?: number | null;
  engagement_last_active_date?: string | null;
};

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  actorAuthUserId?: string | null;
  skipAuthCheck?: boolean;
};

type AuthResult =
  | {
      ok: true;
      actorAuthUserId: string;
      fiUserId: string;
      /** How membership was resolved (dev diagnostics). */
      membershipSource:
        | "direct"
        | "impersonation"
        | "repaired"
        | "email_link"
        | "platform_ensure"
        | "platform_proxy";
    }
  | { ok: false; error: string; code?: "auth_required" | "membership_required" };

function logGuidedAssistMembershipDebug(
  message: string,
  detail: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === "production") return;
  logStructured("info", "guided_assist.membership_debug", { message, ...detail });
}

async function lookupFiUserIdForAuth(
  supabase: SupabaseClient,
  tenantId: string,
  authUserId: string
): Promise<string | null> {
  const tid = tenantId.trim();
  const aid = authUserId.trim();
  if (!tid || !aid) return null;
  const { data, error } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tid)
    .eq("auth_user_id", aid)
    .maybeSingle();
  if (error) {
    logGuidedAssistMembershipDebug("fi_users lookup error", {
      tenantId: tid,
      authUserId: aid,
      error: error.message,
    });
    return null;
  }
  return data ? String((data as { id: string }).id) : null;
}

/**
 * Link an existing tenant `fi_users` row that matches the auth user's email but has a null/mismatched auth_user_id.
 */
async function tryLinkFiUserByEmail(
  supabase: SupabaseClient,
  tenantId: string,
  authUserId: string
): Promise<string | null> {
  try {
    const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(authUserId);
    if (authErr || !authData.user?.email) return null;
    const email = authData.user.email.trim().toLowerCase();
    if (!email) return null;

    const { data: rows, error } = await supabase
      .from("fi_users")
      .select("id, auth_user_id")
      .eq("tenant_id", tenantId.trim())
      .ilike("email", email)
      .limit(3);
    if (error || !rows?.length) return null;

    for (const row of rows as { id: string; auth_user_id: string | null }[]) {
      const existingAuth = row.auth_user_id ? String(row.auth_user_id) : null;
      if (existingAuth && existingAuth !== authUserId) continue;
      if (!existingAuth) {
        const { error: updErr } = await supabase
          .from("fi_users")
          .update({ auth_user_id: authUserId, updated_at: new Date().toISOString() })
          .eq("id", row.id)
          .eq("tenant_id", tenantId.trim());
        if (updErr) {
          logGuidedAssistMembershipDebug("email link update failed", {
            tenantId,
            fiUserId: row.id,
            error: updErr.message,
          });
          continue;
        }
      }
      return String(row.id);
    }
  } catch (e) {
    logGuidedAssistMembershipDebug("email link exception", {
      tenantId,
      error: String(e),
    });
  }
  return null;
}

/**
 * Platform / cross-tenant admins: ensure a stable `fi_users` row for this tenant so preferences FKs work.
 */
async function ensurePlatformAdminFiUserForTenant(
  supabase: SupabaseClient,
  tenantId: string,
  authUserId: string
): Promise<string | null> {
  try {
    const existing = await lookupFiUserIdForAuth(supabase, tenantId, authUserId);
    if (existing) return existing;

    let email: string | null = null;
    const { data: authData } = await supabase.auth.admin.getUserById(authUserId);
    email = authData.user?.email?.trim().toLowerCase() || null;

    const { data, error } = await supabase
      .from("fi_users")
      .insert({
        tenant_id: tenantId.trim(),
        auth_user_id: authUserId.trim(),
        email,
        role: "fi_admin",
      })
      .select("id")
      .maybeSingle();

    if (error) {
      // Unique race: re-read
      const again = await lookupFiUserIdForAuth(supabase, tenantId, authUserId);
      if (again) return again;
      logGuidedAssistMembershipDebug("platform ensure insert failed", {
        tenantId,
        error: error.message,
      });
      return null;
    }
    return data ? String((data as { id: string }).id) : null;
  } catch (e) {
    logGuidedAssistMembershipDebug("platform ensure exception", {
      tenantId,
      error: String(e),
    });
    return null;
  }
}

/**
 * Resolve tenant membership for Clinic guide (and related) server ops.
 * Mirrors portal access: impersonation, staff link repair, email link, platform-admin ensure/proxy.
 */
async function resolveTenantMemberAuth(tenantId: string, opts: ServerOpts): Promise<AuthResult> {
  const sessionAuthId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
  if (!sessionAuthId) {
    return { ok: false, error: "Authentication required.", code: "auth_required" };
  }

  const tid = tenantId.trim();
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();

  // Impersonation-aware principal (platform admin acting as tenant user).
  let principalAuthId = sessionAuthId;
  try {
    principalAuthId = await resolveEffectiveTenantAuthUserId(sessionAuthId);
  } catch {
    principalAuthId = sessionAuthId;
  }

  logGuidedAssistMembershipDebug("resolve start", {
    tenantId: tid,
    sessionAuthId,
    principalAuthId,
    skipAuthCheck: Boolean(opts.skipAuthCheck),
  });

  // 1) Direct membership for principal
  let fiUserId = await lookupFiUserIdForAuth(supabase, tid, principalAuthId);
  if (fiUserId) {
    return {
      ok: true,
      actorAuthUserId: sessionAuthId,
      fiUserId,
      membershipSource: principalAuthId === sessionAuthId ? "direct" : "impersonation",
    };
  }

  // 2) Direct membership for session auth (if different)
  if (principalAuthId !== sessionAuthId) {
    fiUserId = await lookupFiUserIdForAuth(supabase, tid, sessionAuthId);
    if (fiUserId) {
      return {
        ok: true,
        actorAuthUserId: sessionAuthId,
        fiUserId,
        membershipSource: "direct",
      };
    }
  }

  // 3) Staff invitation / portal link repair (same as tenant portal gate)
  try {
    const repaired = await attemptStaffTenantPortalRepair({
      tenantId: tid,
      authUserId: principalAuthId,
      client: supabase,
    });
    if (repaired) {
      fiUserId = await lookupFiUserIdForAuth(supabase, tid, principalAuthId);
      if (fiUserId) {
        logGuidedAssistMembershipDebug("repaired membership", { tenantId: tid, fiUserId });
        return {
          ok: true,
          actorAuthUserId: sessionAuthId,
          fiUserId,
          membershipSource: "repaired",
        };
      }
    }
  } catch (e) {
    logGuidedAssistMembershipDebug("repair failed", { tenantId: tid, error: String(e) });
  }

  // 4) Link existing row by email (common for clinic admins invited before auth bind)
  fiUserId = await tryLinkFiUserByEmail(supabase, tid, principalAuthId);
  if (fiUserId) {
    logGuidedAssistMembershipDebug("email-linked membership", { tenantId: tid, fiUserId });
    return {
      ok: true,
      actorAuthUserId: sessionAuthId,
      fiUserId,
      membershipSource: "email_link",
    };
  }

  // 5) Platform / cross-tenant admin: ensure own fi_users row (preferred over proxy)
  const os = await loadFiOsIdentity(sessionAuthId);
  const isCrossTenant = Boolean(os && isFiOsCrossTenantDirectoryRole(os.osRole));
  const isPlatformBypass = await isFiOsPlatformAdminFullSessionBypass(sessionAuthId);
  if (isCrossTenant || isPlatformBypass) {
    fiUserId = await ensurePlatformAdminFiUserForTenant(supabase, tid, sessionAuthId);
    if (fiUserId) {
      logGuidedAssistMembershipDebug("platform ensure membership", { tenantId: tid, fiUserId });
      return {
        ok: true,
        actorAuthUserId: sessionAuthId,
        fiUserId,
        membershipSource: "platform_ensure",
      };
    }
    // Last resort: proxy another tenant member (read path only; still better than hard fail)
    const proxy = await loadProxyFiUserRowForPlatformAdminTenant(tid, sessionAuthId);
    if (proxy?.id) {
      logGuidedAssistMembershipDebug("platform proxy membership", {
        tenantId: tid,
        fiUserId: proxy.id,
      });
      return {
        ok: true,
        actorAuthUserId: sessionAuthId,
        fiUserId: proxy.id,
        membershipSource: "platform_proxy",
      };
    }
  }

  logGuidedAssistMembershipDebug("membership not found", {
    tenantId: tid,
    sessionAuthId,
    principalAuthId,
    isCrossTenant,
    isPlatformBypass,
  });

  return {
    ok: false,
    error:
      "Tenant membership required. Your login is not linked to this clinic in fi_users. An admin can invite you, or use Join / select tenant.",
    code: "membership_required",
  };
}

function rowToTenantDefaults(row: GuidedAssistPreferencesRow | null): GuidedAssistTenantDefaults {
  return {
    defaultEnabledDuringOnboarding: row?.default_enabled_during_onboarding ?? true,
    defaultAssistEnabled: row?.default_assist_enabled ?? false,
  };
}

function parseExperienceLevelOverride(
  raw: string | null | undefined
): GuidedAssistExperienceLevel | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if ((GUIDED_ASSIST_EXPERIENCE_LEVELS as readonly string[]).includes(v)) {
    return v as GuidedAssistExperienceLevel;
  }
  return null;
}

function rowToUserPreferences(row: GuidedAssistPreferencesRow | null): GuidedAssistUserPreferences {
  const views = Number(row?.today_home_views ?? 0);
  const createdAt = row?.created_at ? String(row.created_at).trim() : "";
  const streak = Number(row?.engagement_streak_days ?? 0);
  const lastActive = row?.engagement_last_active_date
    ? String(row.engagement_last_active_date).slice(0, 10)
    : "";
  const meta =
    row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  return {
    assistEnabled: row?.assist_enabled ?? null,
    dismissedTipCodes: parseDismissedTipCodes(row?.dismissed_tip_codes),
    snoozedTips: parseSnoozedTips(row?.snoozed_tips),
    todayHomeViews: Number.isFinite(views) && views > 0 ? Math.floor(views) : 0,
    experienceLevelOverride: parseExperienceLevelOverride(row?.experience_level),
    guideStartedAtIso: createdAt && Number.isFinite(Date.parse(createdAt)) ? createdAt : null,
    engagementStreakDays: Number.isFinite(streak) && streak > 0 ? Math.floor(streak) : 0,
    engagementLastActiveDateYmd:
      lastActive && /^\d{4}-\d{2}-\d{2}$/.test(lastActive) ? lastActive : null,
    whatsNewSeenVersion: parseWhatsNewSeenFromMetadata(meta),
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
    guidedAssistDevLog("event", opts.eventKind, {
      tenantId: tenantId.trim(),
      guidanceCode: opts.guidanceCode ?? null,
      pageKey: opts.pageKey ?? null,
      ...((opts.detail ?? {}) as Record<string, unknown>),
    });
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

/**
 * Lightweight operational counts for empty-state + contextual tips (tenant-scoped).
 * Best-effort: failures return zeros so the guide still loads.
 */
export async function loadGuidedAssistClinicStats(
  tenantId: string,
  serverOpts: ServerOpts = {}
): Promise<GuidedAssistClinicStats> {
  const tid = tenantId.trim();
  const stats = emptyGuidedAssistClinicStats();
  try {
    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    let hourLocal: number | null = null;
    let todayYmd = "";
    try {
      const cal = await loadTenantOperationalCalendarSettings(tid);
      const tz = cal.calendarTimezone || "Australia/Brisbane";
      const now = new Date();
      todayYmd = calendarDateStringFromInstant(now, tz);
      const hourFmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        hour: "numeric",
        hour12: false,
      });
      const h = Number(hourFmt.format(now));
      hourLocal = Number.isFinite(h) ? h % 24 : null;
    } catch {
      todayYmd = new Date().toISOString().slice(0, 10);
      hourLocal = new Date().getUTCHours();
    }
    stats.hourLocal = hourLocal;

    const dayStart = `${todayYmd}T00:00:00.000Z`;
    const dayEnd = `${todayYmd}T23:59:59.999Z`;

    const [leads, bookings, tasks, cases, payments] = await Promise.all([
      supabase
        .from("fi_crm_leads")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .is("archived_at", null)
        .limit(1),
      supabase
        .from("fi_bookings")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .gte("start_at", dayStart)
        .lte("start_at", dayEnd)
        .not("booking_status", "eq", "cancelled")
        .limit(1),
      supabase
        .from("fi_crm_tasks")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .in("status", ["open", "pending", "todo"])
        .limit(1),
      supabase
        .from("fi_cases")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .limit(1),
      supabase
        .from("fi_payment_records")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .limit(1),
    ]);

    // open leads: best-effort count (archived_at may not exist — retry simpler)
    if (leads.error) {
      const retry = await supabase
        .from("fi_crm_leads")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .limit(1);
      stats.openLeadCount = retry.count ?? 0;
    } else {
      stats.openLeadCount = leads.count ?? 0;
    }
    stats.todayBookingCount = bookings.error ? 0 : (bookings.count ?? 0);
    if (tasks.error) {
      const retry = await supabase
        .from("fi_crm_tasks")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .limit(1);
      stats.openTaskCount = retry.count ?? 0;
    } else {
      stats.openTaskCount = tasks.count ?? 0;
    }
    stats.openSurgeryCaseCount = cases.error ? 0 : (cases.count ?? 0);
    stats.paymentRecordCount = payments.error ? 0 : (payments.count ?? 0);
  } catch (e) {
    logStructured("warn", "guided_assist.clinic_stats_error", {
      tenantId: tid,
      error: String(e),
    });
  }
  return stats;
}

async function resolveClinicLocalYmd(tenantId: string): Promise<string> {
  try {
    const cal = await loadTenantOperationalCalendarSettings(tenantId);
    const tz = cal.calendarTimezone || "Australia/Brisbane";
    return calendarDateStringFromInstant(new Date(), tz);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Load streak display, weekly progress, per-tip feedback, optional admin team highlight.
 */
export async function loadGuidedAssistEngagementSnapshot(
  tenantId: string,
  fiUserId: string,
  prefs: GuidedAssistUserPreferences,
  opts: {
    includeTeamHighlight?: boolean;
    tipCodes?: readonly string[];
    isOnboardingPhase?: boolean;
  } = {},
  serverOpts: ServerOpts = {}
): Promise<GuidedAssistEngagementSnapshot> {
  const tid = tenantId.trim();
  const snapshot = emptyEngagementSnapshot();
  snapshot.streakDays = prefs.engagementStreakDays;
  snapshot.streakMessage = formatStreakMessage(prefs.engagementStreakDays);

  try {
    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const tipCodes = [...new Set((opts.tipCodes ?? []).map((c) => c.trim()).filter(Boolean))];

    const [eventsRes, feedbackRes, teamRes] = await Promise.all([
      supabase
        .from("fi_guided_assist_events")
        .select("guidance_code, event_kind")
        .eq("tenant_id", tid)
        .eq("fi_user_id", fiUserId)
        .gte("occurred_at", weekAgo)
        .in("event_kind", [
          "tip_shown",
          "tip_dismissed",
          "next_action_clicked",
          "tour_completed",
          "tip_feedback_helpful",
          "tip_feedback_unhelpful",
        ]),
      tipCodes.length
        ? supabase
            .from("fi_guided_assist_feedback")
            .select("tip_code, helpful")
            .eq("tenant_id", tid)
            .eq("fi_user_id", fiUserId)
            .in("tip_code", tipCodes)
        : Promise.resolve({ data: [] as { tip_code: string; helpful: boolean }[], error: null }),
      opts.includeTeamHighlight
        ? supabase
            .from("fi_guided_assist_events")
            .select("guidance_code")
            .eq("tenant_id", tid)
            .eq("event_kind", "tip_shown")
            .gte("occurred_at", weekAgo)
            .not("guidance_code", "is", null)
            .limit(500)
        : Promise.resolve({ data: null, error: null }),
    ]);

    const uniqueCodes = new Set<string>();
    for (const row of eventsRes.data ?? []) {
      const code = String((row as { guidance_code?: string | null }).guidance_code ?? "").trim();
      if (code) uniqueCodes.add(code);
    }
    snapshot.progress = buildWeeklyProgressSummary({
      completedCount: uniqueCodes.size,
      goal: GUIDED_ASSIST_WEEKLY_PROGRESS_GOAL,
      isOnboardingPhase: opts.isOnboardingPhase,
    });

    const feedbackByTipCode: Record<string, boolean | null> = {};
    for (const code of tipCodes) feedbackByTipCode[code] = null;
    for (const row of feedbackRes.data ?? []) {
      const code = String((row as { tip_code: string }).tip_code).trim();
      if (code) feedbackByTipCode[code] = Boolean((row as { helpful: boolean }).helpful);
    }
    snapshot.feedbackByTipCode = feedbackByTipCode;

    if (opts.includeTeamHighlight && teamRes.data) {
      const counts = new Map<string, number>();
      for (const row of teamRes.data as { guidance_code: string | null }[]) {
        const code = String(row.guidance_code ?? "").trim();
        if (!code || code === "today_role_first_window") continue;
        counts.set(code, (counts.get(code) ?? 0) + 1);
      }
      snapshot.teamHighlight = resolveTeamHighlightFromCounts(
        [...counts.entries()].map(([guidanceCode, count]) => ({ guidanceCode, count }))
      );
    }
  } catch (e) {
    logStructured("warn", "guided_assist.engagement_snapshot_error", {
      tenantId: tid,
      error: String(e),
    });
  }

  return snapshot;
}

/** Record consecutive-day engagement (idempotent for same calendar day). */
export async function touchGuidedAssistEngagement(
  tenantId: string,
  serverOpts: ServerOpts = {}
): Promise<
  | { ok: true; streakDays: number; streakMessage: string | null }
  | { ok: false; error: string }
> {
  try {
    const auth = await resolveTenantMemberAuth(tenantId, serverOpts);
    if (!auth.ok) return auth;

    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    const tid = tenantId.trim();
    const row = await ensureUserPreferenceRow(supabase, tid, auth.fiUserId);
    const prefs = rowToUserPreferences(row);
    const todayYmd = await resolveClinicLocalYmd(tid);
    const next = computeEngagementStreakUpdate({
      currentStreakDays: prefs.engagementStreakDays,
      lastActiveDateYmd: prefs.engagementLastActiveDateYmd,
      todayYmd,
    });

    if (next.updated) {
      const { error } = await supabase
        .from("fi_guided_assist_preferences")
        .update({
          engagement_streak_days: next.streakDays,
          engagement_last_active_date: next.lastActiveDateYmd,
        })
        .eq("id", row.id)
        .eq("tenant_id", tid)
        .eq("fi_user_id", auth.fiUserId);
      if (error) return { ok: false, error: error.message };

      await recordGuidedAssistEvent(
        tid,
        {
          fiUserId: auth.fiUserId,
          eventKind: "engagement_active",
          detail: {
            streakDays: next.streakDays,
            lastActiveDateYmd: next.lastActiveDateYmd,
          },
        },
        serverOpts
      );

      // Semantic product event when the streak number advances (not same-day re-touch).
      if (next.streakDays > prefs.engagementStreakDays) {
        await recordGuidedAssistEvent(
          tid,
          {
            fiUserId: auth.fiUserId,
            eventKind: "streak_advanced",
            detail: {
              streakDays: next.streakDays,
              previousStreakDays: prefs.engagementStreakDays,
              lastActiveDateYmd: next.lastActiveDateYmd,
            },
          },
          serverOpts
        );
      }
    }

    return {
      ok: true,
      streakDays: next.streakDays,
      streakMessage: next.message,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update guide engagement.",
    };
  }
}

/** Upsert tip/tour-step helpfulness (thumbs + optional short comment). Touches engagement streak. */
export async function recordGuidedAssistTipFeedback(
  tenantId: string,
  tipCode: string,
  helpful: boolean,
  pageKey?: string | null,
  serverOpts: ServerOpts & { comment?: string | null } = {}
): Promise<{ ok: true; helpful: boolean } | { ok: false; error: string }> {
  try {
    const auth = await resolveTenantMemberAuth(tenantId, serverOpts);
    if (!auth.ok) return auth;

    const code = tipCode.trim();
    if (!code || code.length > 120) return { ok: false, error: "Invalid tip code." };
    // Allow catalog tips and synthetic tour codes
    const known = getGuidedAssistTipByCode(code);
    if (!known && !code.startsWith("tour_") && !code.startsWith("nba_")) {
      // Still allow unknown operational codes (catalog grows); only reject empty.
    }

    const commentRaw = serverOpts.comment != null ? String(serverOpts.comment).trim() : "";
    const comment = commentRaw ? commentRaw.slice(0, 500) : null;

    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    const tid = tenantId.trim();

    const { error } = await supabase.from("fi_guided_assist_feedback").upsert(
      {
        tenant_id: tid,
        fi_user_id: auth.fiUserId,
        tip_code: code,
        helpful: Boolean(helpful),
        page_key: pageKey?.trim() || null,
        comment,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,fi_user_id,tip_code" }
    );
    if (error) return { ok: false, error: error.message };

    await recordGuidedAssistEvent(
      tid,
      {
        fiUserId: auth.fiUserId,
        eventKind: helpful ? "tip_feedback_helpful" : "tip_feedback_unhelpful",
        guidanceCode: code,
        guidanceArea: known?.area ?? null,
        pageKey: pageKey ?? null,
        detail: { helpful: Boolean(helpful), hasComment: Boolean(comment) },
      },
      serverOpts
    );

    // Aggregate-friendly product event (pairs with tip_feedback_* for analytics).
    await recordGuidedAssistEvent(
      tid,
      {
        fiUserId: auth.fiUserId,
        eventKind: "feedback_submitted",
        guidanceCode: code,
        guidanceArea: known?.area ?? null,
        pageKey: pageKey ?? null,
        detail: { helpful: Boolean(helpful), hasComment: Boolean(comment) },
      },
      serverOpts
    );

    // Best-effort streak bump
    await touchGuidedAssistEngagement(tid, serverOpts);

    return { ok: true, helpful: Boolean(helpful) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save tip feedback.",
    };
  }
}

function readForceShowCookieActive(tenantId: string): boolean {
  try {
    const raw = cookies().get(GUIDED_ASSIST_FORCE_SHOW_COOKIE)?.value;
    return isGuidedAssistForceShowCookieActive(raw, tenantId);
  } catch {
    return false;
  }
}

/**
 * Admin-only: set or clear session force-show cookie so the guide appears
 * with tips even when personal preference is off (this browser only).
 */
export async function setGuidedAssistForceShow(
  tenantId: string,
  forceShow: boolean,
  serverOpts: ServerOpts = {}
): Promise<{ ok: true; forceShowActive: boolean } | { ok: false; error: string }> {
  try {
    const auth = await resolveTenantMemberAuth(tenantId, serverOpts);
    if (!auth.ok) return auth;

    if (!(await canManageGuidedAssistTenantDefaults(tenantId, serverOpts))) {
      return {
        ok: false,
        error: "Clinic admin access is required to force-show the Clinic guide.",
      };
    }

    const tid = tenantId.trim();
    const store = cookies();
    if (forceShow) {
      store.set(GUIDED_ASSIST_FORCE_SHOW_COOKIE, tid, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: GUIDED_ASSIST_FORCE_SHOW_MAX_AGE_SEC,
      });
    } else {
      store.set(GUIDED_ASSIST_FORCE_SHOW_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }

    await recordGuidedAssistEvent(
      tid,
      {
        fiUserId: auth.fiUserId,
        eventKind: forceShow ? "assist_enabled" : "assist_disabled",
        detail: { source: "admin_force_show", forceShow: Boolean(forceShow) },
      },
      serverOpts
    );

    return { ok: true, forceShowActive: Boolean(forceShow) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update force-show override.",
    };
  }
}

export async function loadGuidedAssistSessionPayload(
  tenantId: string,
  pathname: string,
  serverOpts: ServerOpts & { forceShowActive?: boolean; search?: string | null } = {}
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

    const [tenantDefaultRow, userRow, workspaceProfileKey, adminProf, homePayload, clinicStats] =
      await Promise.all([
        ensureTenantDefaultRow(supabase, tid),
        ensureUserPreferenceRow(supabase, tid, auth.fiUserId),
        loadWorkspaceProfileKeyForViewer(tid),
        loadActiveTenantAdminProfileForSession(tid, auth.actorAuthUserId),
        loadFiHomeDashboardPayload(tid, { showCrmShellChecklistItems: false }),
        loadGuidedAssistClinicStats(tid, serverOpts),
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

    const canManage =
      adminProf?.adminRole === "clinic_admin" || adminProf?.adminRole === "operations_admin";
    const forceFromCookie = readForceShowCookieActive(tid);
    const debugQuery = isGuidedAssistDebugQueryActive(serverOpts.search);
    // Force-show cookie only honored for admins (or explicit serverOpts override in tests).
    const forceShowActive =
      serverOpts.forceShowActive === true ||
      (forceFromCookie && canManage) ||
      (debugQuery && canManage);

    const ctx = {
      tenantId: tid,
      pageKey,
      workspaceProfileKey: workspaceProfileKey as FiWorkspaceProfileKey,
      tenantAdminRole: (adminProf?.adminRole ?? null) as FiTenantAdminRole | null,
      setupFlags,
      isOnboardingPhase,
    };

    // Build tips first so we can load feedback for visible codes.
    const draft = buildGuidedAssistSessionPayload({
      ctx,
      resolved,
      userPreferences,
      clinicStats,
      forceShowActive,
      includeDebugInfo: canManage || forceShowActive || debugQuery,
    });

    const tipCodes = [
      ...draft.tips.map((t) => t.code),
      ...draft.nextBestActions.map((t) => t.code),
      ...(draft.emptyStateTour?.steps.map((s) => s.code) ?? []),
      draft.emptyStateTour?.rootTipCode,
    ].filter(Boolean) as string[];

    const engagement = await loadGuidedAssistEngagementSnapshot(
      tid,
      auth.fiUserId,
      userPreferences,
      {
        includeTeamHighlight: canManage,
        tipCodes,
        isOnboardingPhase,
      },
      serverOpts
    );

    const payload = buildGuidedAssistSessionPayload({
      ctx,
      resolved,
      userPreferences,
      clinicStats,
      engagement,
      forceShowActive,
      includeDebugInfo: canManage || forceShowActive || debugQuery,
    });

    guidedAssistDevLog("session", "loaded", {
      tenantId: tid,
      pageKey,
      guideVisible: payload.guideVisible,
      tipCount: payload.tips.length,
      showWhatsNew: payload.showWhatsNew,
      experienceLevel: payload.experienceLevel,
    });

    return { ok: true, payload };
  } catch (e) {
    logStructured("error", "guided_assist.load_session_error", { tenantId, error: String(e) });
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load guided assist." };
  }
}

/**
 * Persist “What’s new” dismissal for the current user (metadata.whats_new_seen_version).
 */
export async function markGuidedAssistWhatsNewSeen(
  tenantId: string,
  serverOpts: ServerOpts = {}
): Promise<{ ok: true; version: string } | { ok: false; error: string }> {
  try {
    const auth = await resolveTenantMemberAuth(tenantId, serverOpts);
    if (!auth.ok) return auth;

    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    const tid = tenantId.trim();
    const row = await ensureUserPreferenceRow(supabase, tid, auth.fiUserId);
    const existingMeta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const nextMeta = withWhatsNewSeenMetadata(existingMeta, GUIDED_ASSIST_WHATS_NEW_VERSION);

    const { error } = await supabase
      .from("fi_guided_assist_preferences")
      .update({ metadata: nextMeta })
      .eq("id", row.id)
      .eq("tenant_id", tid)
      .eq("fi_user_id", auth.fiUserId);
    if (error) return { ok: false, error: error.message };

    await recordGuidedAssistEvent(
      tid,
      {
        fiUserId: auth.fiUserId,
        eventKind: "whats_new_dismissed",
        detail: { version: GUIDED_ASSIST_WHATS_NEW_VERSION },
      },
      serverOpts
    );

    return { ok: true, version: GUIDED_ASSIST_WHATS_NEW_VERSION };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to dismiss What’s new.",
    };
  }
}

function normalizeHealthFilters(
  filters: Partial<GuidedAssistHealthFilters> | number | undefined
): GuidedAssistHealthFilters {
  // Back-compat: number was windowDays only.
  if (typeof filters === "number") {
    const d = filters === 7 ? 7 : 30;
    return { windowDays: d, role: "all" };
  }
  const windowDays: GuidedAssistHealthWindowDays =
    filters?.windowDays === 7 ? 7 : 30;
  const roleRaw = filters?.role ?? "all";
  const allowed: readonly (GuidedAssistTodayRoleKey | "all")[] = [
    "all",
    "reception",
    "consultant",
    "doctor",
    "nurse",
    "finance",
    "admin",
  ];
  const role = allowed.includes(roleRaw as GuidedAssistTodayRoleKey | "all")
    ? (roleRaw as GuidedAssistTodayRoleKey | "all")
    : "all";
  return { windowDays, role };
}

/**
 * Admin “Guide Health” snapshot — adoption, feedback, tips & quick actions (tenant-scoped).
 */
export async function loadGuidedAssistHealthSnapshot(
  tenantId: string,
  filters: Partial<GuidedAssistHealthFilters> | number = { windowDays: 30, role: "all" },
  serverOpts: ServerOpts = {}
): Promise<{ ok: true; health: GuidedAssistHealthSnapshot } | { ok: false; error: string }> {
  try {
    const auth = await resolveTenantMemberAuth(tenantId, serverOpts);
    if (!auth.ok) return auth;

    if (!(await canViewGuidedAssistUsageSummary(tenantId, serverOpts))) {
      return { ok: false, error: "Admin access is required to view Guide Health." };
    }

    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    const tid = tenantId.trim();
    const { windowDays: days, role: roleFilter } = normalizeHealthFilters(filters);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [prefsRes, eventsRes, feedbackRes] = await Promise.all([
      supabase
        .from("fi_guided_assist_preferences")
        .select("fi_user_id, assist_enabled")
        .eq("tenant_id", tid)
        .not("fi_user_id", "is", null),
      supabase
        .from("fi_guided_assist_events")
        .select("event_kind, guidance_code, detail")
        .eq("tenant_id", tid)
        .gte("occurred_at", since),
      supabase
        .from("fi_guided_assist_feedback")
        .select("tip_code, helpful")
        .eq("tenant_id", tid)
        .gte("updated_at", since),
    ]);

    if (prefsRes.error) return { ok: false, error: prefsRes.error.message };
    if (eventsRes.error) return { ok: false, error: eventsRes.error.message };
    if (feedbackRes.error) return { ok: false, error: feedbackRes.error.message };

    const prefRows = (prefsRes.data ?? []) as {
      fi_user_id: string | null;
      assist_enabled: boolean | null;
    }[];
    const usersWithPreferenceRow = prefRows.length;
    const usersWithGuideOn = prefRows.filter((r) => r.assist_enabled === true).length;

    const health = summarizeGuidedAssistHealthMetrics({
      tenantId: tid,
      windowDays: days,
      roleFilter,
      usersWithGuideOn,
      usersWithPreferenceRow,
      events: (eventsRes.data ?? []) as {
        event_kind: string;
        guidance_code: string | null;
        detail?: Record<string, unknown> | null;
      }[],
      feedback: (feedbackRes.data ?? []) as { tip_code: string; helpful: boolean }[],
      tipTitle: (code) => getGuidedAssistTipByCode(code)?.title ?? code,
      tipPreview: (code) => getGuidedAssistTipByCode(code)?.body ?? "",
      quickActionTitle: (code) => getGuidedAssistQuickActionByCode(code)?.label ?? code,
      quickActionPreview: (code) => getGuidedAssistQuickActionByCode(code)?.description ?? "",
      topLimit: 5,
    });

    guidedAssistDevLog("health", "snapshot", {
      tenantId: tid,
      windowDays: days,
      role: roleFilter,
      adoptionRate: health.adoptionRate,
      tipsShown: health.tipsShown,
      thumbsUpRate: health.thumbsUpRate,
    });

    return { ok: true, health };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to load Guide Health.",
    };
  }
}

/**
 * Admin CSV export of events + feedback for the health window (tenant-scoped).
 */
export async function exportGuidedAssistHealthCsv(
  tenantId: string,
  filters: Partial<GuidedAssistHealthFilters> | number = { windowDays: 30, role: "all" },
  serverOpts: ServerOpts = {}
): Promise<{ ok: true; csv: string; filename: string } | { ok: false; error: string }> {
  try {
    const auth = await resolveTenantMemberAuth(tenantId, serverOpts);
    if (!auth.ok) return auth;

    if (!(await canViewGuidedAssistUsageSummary(tenantId, serverOpts))) {
      return { ok: false, error: "Admin access is required to export Guide Health." };
    }

    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    const tid = tenantId.trim();
    const { windowDays: days, role: roleFilter } = normalizeHealthFilters(filters);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [eventsRes, feedbackRes] = await Promise.all([
      supabase
        .from("fi_guided_assist_events")
        .select("occurred_at, event_kind, guidance_code, guidance_area, page_key, detail")
        .eq("tenant_id", tid)
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(5000),
      supabase
        .from("fi_guided_assist_feedback")
        .select("tip_code, helpful, comment, page_key, updated_at")
        .eq("tenant_id", tid)
        .gte("updated_at", since)
        .order("updated_at", { ascending: false })
        .limit(2000),
    ]);

    if (eventsRes.error) return { ok: false, error: eventsRes.error.message };
    if (feedbackRes.error) return { ok: false, error: feedbackRes.error.message };

    let events = (eventsRes.data ?? []) as {
      occurred_at?: string | null;
      event_kind: string;
      guidance_code: string | null;
      guidance_area?: string | null;
      page_key?: string | null;
      detail?: Record<string, unknown> | null;
    }[];

    if (roleFilter !== "all") {
      events = events.filter((ev) => {
        const detail = ev.detail && typeof ev.detail === "object" ? ev.detail : null;
        const detailRole =
          detail && detail.todayRole != null ? String(detail.todayRole).trim() : "";
        if (detailRole) return detailRole === roleFilter || detailRole === "all";
        const code = ev.guidance_code ? String(ev.guidance_code).trim() : "";
        if (!code) return true;
        return tipCodeMatchesHealthRole(code, roleFilter);
      });
    }

    let feedback = (feedbackRes.data ?? []) as {
      tip_code: string;
      helpful: boolean;
      comment?: string | null;
      page_key?: string | null;
      updated_at?: string | null;
    }[];
    if (roleFilter !== "all") {
      feedback = feedback.filter((fb) => tipCodeMatchesHealthRole(fb.tip_code, roleFilter));
    }

    const csv = buildGuidedAssistHealthExportCsv({ events, feedback });
    const filename = `clinic-guide-health-${tid.slice(0, 8)}-${days}d${
      roleFilter !== "all" ? `-${roleFilter}` : ""
    }.csv`;

    return { ok: true, csv, filename };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to export Guide Health CSV.",
    };
  }
}

/** Load tenant rollout checklist (admin). Status on tenant default prefs metadata. */
export async function loadGuidedAssistRolloutSnapshot(
  tenantId: string,
  serverOpts: ServerOpts = {}
): Promise<{ ok: true; rollout: GuidedAssistRolloutSnapshot } | { ok: false; error: string }> {
  try {
    const auth = await resolveTenantMemberAuth(tenantId, serverOpts);
    if (!auth.ok) return auth;

    if (!(await canViewGuidedAssistUsageSummary(tenantId, serverOpts))) {
      return { ok: false, error: "Admin access is required to view the rollout checklist." };
    }

    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    const tid = tenantId.trim();
    const row = await ensureTenantDefaultRow(supabase, tid);
    const meta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const status = parseRolloutStatusFromMetadata(meta);
    return { ok: true, rollout: buildGuidedAssistRolloutSnapshot(tid, status) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to load rollout checklist.",
    };
  }
}

/** Toggle a rollout checklist item for the tenant (admin). */
export async function setGuidedAssistRolloutItem(
  tenantId: string,
  itemId: string,
  completed: boolean,
  serverOpts: ServerOpts = {}
): Promise<{ ok: true; rollout: GuidedAssistRolloutSnapshot } | { ok: false; error: string }> {
  try {
    const auth = await resolveTenantMemberAuth(tenantId, serverOpts);
    if (!auth.ok) return auth;

    if (!(await canManageGuidedAssistTenantDefaults(tenantId, serverOpts))) {
      return { ok: false, error: "Clinic admin access is required to update rollout status." };
    }

    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    const tid = tenantId.trim();
    const row = await ensureTenantDefaultRow(supabase, tid);
    const meta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const current = parseRolloutStatusFromMetadata(meta);
    const next = applyRolloutItemToggle(current, itemId, completed);
    if (next === current && !completed && !current.completed[itemId]) {
      // invalid id or no-op
    }
    const nextMeta = withRolloutStatusMetadata(meta, next);

    const { error } = await supabase
      .from("fi_guided_assist_preferences")
      .update({ metadata: nextMeta })
      .eq("id", row.id)
      .eq("tenant_id", tid)
      .is("fi_user_id", null);
    if (error) return { ok: false, error: error.message };

    guidedAssistDevLog("rollout", completed ? "item_done" : "item_cleared", {
      tenantId: tid,
      itemId,
    });

    return { ok: true, rollout: buildGuidedAssistRolloutSnapshot(tid, next) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update rollout checklist.",
    };
  }
}

/**
 * Increment per-user Today home view counter (role-first window).
 * Safe to call once per exposure from the client when `shouldIncrementTodayHomeViews` is true.
 */
export async function incrementGuidedAssistTodayHomeViews(
  tenantId: string,
  serverOpts: ServerOpts = {}
): Promise<{ ok: true; todayHomeViews: number } | { ok: false; error: string }> {
  try {
    const auth = await resolveTenantMemberAuth(tenantId, serverOpts);
    if (!auth.ok) return auth;

    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    const tid = tenantId.trim();
    const row = await ensureUserPreferenceRow(supabase, tid, auth.fiUserId);
    const current = Math.max(0, Math.floor(Number(row.today_home_views ?? 0) || 0));
    const next = current + 1;

    const { error } = await supabase
      .from("fi_guided_assist_preferences")
      .update({ today_home_views: next })
      .eq("id", row.id)
      .eq("tenant_id", tid)
      .eq("fi_user_id", auth.fiUserId);
    if (error) return { ok: false, error: error.message };

    await recordGuidedAssistEvent(
      tid,
      {
        fiUserId: auth.fiUserId,
        eventKind: "tip_shown",
        guidanceCode: "today_role_first_window",
        pageKey: "",
        detail: { today_home_views: next, kind: "role_first_increment" },
      },
      serverOpts
    );

    return { ok: true, todayHomeViews: next };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to increment Today guide views.",
    };
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
      .eq("id", row.id)
      .eq("tenant_id", tid)
      .eq("fi_user_id", auth.fiUserId);
    if (error) return { ok: false, error: error.message };

    await recordGuidedAssistEvent(
      tid,
      {
        fiUserId: auth.fiUserId,
        eventKind: enabled ? "assist_enabled" : "assist_disabled",
        detail: { source: "user_toggle", assist_enabled: enabled },
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

export async function canManageGuidedAssistTenantDefaults(
  tenantId: string,
  serverOpts: ServerOpts = {}
): Promise<boolean> {
  const auth = await resolveTenantMemberAuth(tenantId, serverOpts);
  if (!auth.ok) return false;
  const adminProf = await loadActiveTenantAdminProfileForSession(tenantId, auth.actorAuthUserId);
  return (
    adminProf?.adminRole === "clinic_admin" || adminProf?.adminRole === "operations_admin"
  );
}

/**
 * Admin: turn Clinic guide on for every staff preference row in this tenant,
 * and set post-setup tenant default to on so new staff inherit it.
 */
export async function enableGuidedAssistForAllStaff(
  tenantId: string,
  serverOpts: ServerOpts = {}
): Promise<
  | { ok: true; updatedUserRows: number; assistEnabled: true }
  | { ok: false; error: string }
> {
  try {
    const auth = await resolveTenantMemberAuth(tenantId, serverOpts);
    if (!auth.ok) return auth;

    if (!(await canManageGuidedAssistTenantDefaults(tenantId, serverOpts))) {
      return {
        ok: false,
        error: "Clinic admin access is required to enable Clinic guide for all staff.",
      };
    }

    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    const tid = tenantId.trim();
    const tenantRow = await ensureTenantDefaultRow(supabase, tid);

    const { error: tenantErr } = await supabase
      .from("fi_guided_assist_preferences")
      .update({
        default_assist_enabled: true,
        default_enabled_during_onboarding: true,
      })
      .eq("id", tenantRow.id)
      .eq("tenant_id", tid)
      .is("fi_user_id", null);
    if (tenantErr) return { ok: false, error: tenantErr.message };

    // Explicit on for every existing per-user row in this tenant.
    const { data: userRows, error: listErr } = await supabase
      .from("fi_guided_assist_preferences")
      .select("id")
      .eq("tenant_id", tid)
      .not("fi_user_id", "is", null);
    if (listErr) return { ok: false, error: listErr.message };

    const ids = (userRows ?? []).map((r) => String((r as { id: string }).id));
    let updatedUserRows = 0;
    if (ids.length > 0) {
      const { error: bulkErr, count } = await supabase
        .from("fi_guided_assist_preferences")
        .update({ assist_enabled: true }, { count: "exact" })
        .eq("tenant_id", tid)
        .not("fi_user_id", "is", null);
      if (bulkErr) return { ok: false, error: bulkErr.message };
      updatedUserRows = count ?? ids.length;
    }

    // Ensure the acting admin is on immediately.
    await ensureUserPreferenceRow(supabase, tid, auth.fiUserId);
    await supabase
      .from("fi_guided_assist_preferences")
      .update({ assist_enabled: true })
      .eq("tenant_id", tid)
      .eq("fi_user_id", auth.fiUserId);

    await recordGuidedAssistEvent(
      tid,
      {
        fiUserId: auth.fiUserId,
        eventKind: "assist_enabled",
        detail: {
          source: "enable_for_all_staff",
          updatedUserRows,
          default_assist_enabled: true,
        },
      },
      serverOpts
    );

    return { ok: true, updatedUserRows, assistEnabled: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to enable Clinic guide for all staff.",
    };
  }
}

/** Load Settings → Clinic Guide panel state (any tenant member for personal toggle). */
export async function loadGuidedAssistSettingsState(
  tenantId: string,
  serverOpts: ServerOpts = {}
): Promise<
  | { ok: true; state: import("./guidedAssistTypes").GuidedAssistSettingsState }
  | { ok: false; error: string }
> {
  try {
    const auth = await resolveTenantMemberAuth(tenantId, serverOpts);
    if (!auth.ok) return auth;

    const supabase = serverOpts.supabaseClientForTests ?? supabaseAdmin();
    const tid = tenantId.trim();

    const [tenantDefaultRow, userRow, homePayload, canManage, workspaceProfileKey, adminProf] =
      await Promise.all([
        ensureTenantDefaultRow(supabase, tid),
        ensureUserPreferenceRow(supabase, tid, auth.fiUserId),
        loadFiHomeDashboardPayload(tid, { showCrmShellChecklistItems: false }),
        canManageGuidedAssistTenantDefaults(tid, serverOpts),
        loadWorkspaceProfileKeyForViewer(tid),
        loadActiveTenantAdminProfileForSession(tid, auth.actorAuthUserId),
      ]);

    const setupFlags = buildGuidedAssistSetupFlagsFromChecklist(homePayload.checklist);
    const isOnboardingPhase = computeGuidedAssistOnboardingPhase(setupFlags);
    const tenantDefaults = rowToTenantDefaults(tenantDefaultRow);
    const userPreferences = rowToUserPreferences(userRow);
    const assistEnabled = resolveEffectiveGuidedAssistEnabled({
      tenantDefaults,
      userPreferences,
      isOnboardingPhase,
    });

    const forceShowActive = canManage && readForceShowCookieActive(tid);
    const todayRole = mapViewerToGuidedAssistTodayRole({
      workspaceProfileKey: workspaceProfileKey as FiWorkspaceProfileKey,
      tenantAdminRole: (adminProf?.adminRole ?? null) as FiTenantAdminRole | null,
    });
    const experienceLevel = inferGuidedAssistExperienceLevel({
      todayHomeViews: userPreferences.todayHomeViews,
      guideStartedAtIso: userPreferences.guideStartedAtIso,
      experienceLevelOverride: userPreferences.experienceLevelOverride,
    });
    const roleModeLabel = buildGuidedAssistRoleModeLabel({
      todayRole,
      workspaceProfileKey: workspaceProfileKey as FiWorkspaceProfileKey,
      tenantAdminRole: (adminProf?.adminRole ?? null) as FiTenantAdminRole | null,
      assistEnabled: assistEnabled || forceShowActive,
    });

    const debugInfo = buildGuidedAssistDebugInfo({
      assistEnabled,
      userAssistOverride: userPreferences.assistEnabled,
      forceShowActive,
      todayHomeViews: userPreferences.todayHomeViews,
      todayRole,
      roleModeLabel,
      experienceLevel,
      isOnboardingPhase,
      pageKey: "settings/clinic-guide",
      workspaceProfileKey: String(workspaceProfileKey ?? ""),
      tenantAdminRole: adminProf?.adminRole ?? null,
      roleFirstActive: false,
      tipCount: 0,
      nextBestActionCount: 0,
    });

    let staffWithExplicitOff = 0;
    let staffWithExplicitOn = 0;
    if (canManage) {
      const { data: staffRows } = await supabase
        .from("fi_guided_assist_preferences")
        .select("assist_enabled")
        .eq("tenant_id", tid)
        .not("fi_user_id", "is", null);
      for (const row of staffRows ?? []) {
        const v = (row as { assist_enabled: boolean | null }).assist_enabled;
        if (v === true) staffWithExplicitOn += 1;
        if (v === false) staffWithExplicitOff += 1;
      }
    }

    return {
      ok: true,
      state: {
        assistEnabled,
        userAssistOverride: userPreferences.assistEnabled,
        isOnboardingPhase,
        tenantDefaults,
        canManageTenantDefaults: canManage,
        settingsHref: `/fi-admin/${tid}/settings/clinic-guide`,
        staffWithExplicitOff,
        staffWithExplicitOn,
        forceShowActive,
        debugInfo,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to load Clinic guide settings.",
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
