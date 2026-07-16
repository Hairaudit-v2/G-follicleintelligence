"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import {
  dismissGuidedAssistTip,
  enableGuidedAssistForAllStaff,
  exportGuidedAssistHealthCsv,
  incrementGuidedAssistTodayHomeViews,
  loadGuidedAssistHealthSnapshot,
  loadGuidedAssistRolloutSnapshot,
  loadGuidedAssistSettingsState,
  loadGuidedAssistUsageSummary,
  markGuidedAssistWhatsNewSeen,
  recordGuidedAssistEvent,
  recordGuidedAssistTipFeedback,
  setGuidedAssistEnabledForUser,
  setGuidedAssistForceShow,
  setGuidedAssistRolloutItem,
  setGuidedAssistTenantDefaults,
  snoozeGuidedAssistTip,
  touchGuidedAssistEngagement,
} from "@/src/lib/onboarding-os/guidedAssist.server";
import type {
  GuidedAssistEventKind,
  GuidedAssistHealthFilters,
  GuidedAssistHealthSnapshot,
  GuidedAssistHealthWindowDays,
  GuidedAssistRolloutSnapshot,
  GuidedAssistSettingsState,
  GuidedAssistTodayRoleKey,
  GuidedAssistUsageSummary,
} from "@/src/lib/onboarding-os/guidedAssistTypes";

export type GuidedAssistActionResult = { ok: true } | { ok: false; error: string };

const tenantIdSchema = z.string().uuid();
const tipCodeSchema = z.string().min(1).max(120);

function revalidateTenantAssistPaths(tenantId: string) {
  revalidatePath(`/fi-admin/${tenantId}`);
  revalidatePath(`/fi-admin/${tenantId}/settings/clinic-guide`);
  revalidatePath(`/fi-admin/${tenantId}/configuration`);
}

async function resolveActorAuthId(): Promise<string | null> {
  return resolveAuthUserId(null);
}

export async function setGuidedAssistEnabledAction(
  tenantId: string,
  enabled: boolean
): Promise<GuidedAssistActionResult & { assistEnabled?: boolean }> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const result = await setGuidedAssistEnabledForUser(tid, enabled, {
      actorAuthUserId: authId,
      skipAuthCheck: true,
    });
    if (!result.ok) return result;
    revalidateTenantAssistPaths(tid);
    return { ok: true, assistEnabled: result.assistEnabled };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid tenant." };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update assist setting.",
    };
  }
}

export async function dismissGuidedAssistTipAction(
  tenantId: string,
  tipCode: string
): Promise<GuidedAssistActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const code = tipCodeSchema.parse(tipCode);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const result = await dismissGuidedAssistTip(tid, code, {
      actorAuthUserId: authId,
      skipAuthCheck: true,
    });
    if (!result.ok) return result;
    revalidateTenantAssistPaths(tid);
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid request." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to dismiss tip." };
  }
}

export async function snoozeGuidedAssistTipAction(
  tenantId: string,
  tipCode: string,
  snoozeHours?: number | null
): Promise<GuidedAssistActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const code = tipCodeSchema.parse(tipCode);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const result = await snoozeGuidedAssistTip(tid, code, snoozeHours, {
      actorAuthUserId: authId,
      skipAuthCheck: true,
    });
    if (!result.ok) return result;
    revalidateTenantAssistPaths(tid);
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid request." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to snooze tip." };
  }
}

/**
 * Increment Today home view counter for role-first tips (first N exposures).
 * Call once when the clinic guide shows role-first tips on Today.
 */
export async function incrementGuidedAssistViewsAction(
  tenantId: string
): Promise<GuidedAssistActionResult & { todayHomeViews?: number }> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const result = await incrementGuidedAssistTodayHomeViews(tid, {
      actorAuthUserId: authId,
      skipAuthCheck: true,
    });
    if (!result.ok) return result;
    revalidateTenantAssistPaths(tid);
    return { ok: true, todayHomeViews: result.todayHomeViews };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid tenant." };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update guide views.",
    };
  }
}

/** Alias matching the product brief name. */
export const incrementGuidedAssistViews = incrementGuidedAssistViewsAction;

export async function recordGuidedAssistClientEventAction(
  tenantId: string,
  body: {
    eventKind: GuidedAssistEventKind;
    guidanceArea?: string | null;
    guidanceCode?: string | null;
    pageKey?: string | null;
    detail?: Record<string, unknown>;
  }
): Promise<GuidedAssistActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const supabase = await import("@/lib/supabaseAdmin").then((m) => m.supabaseAdmin());
    const { data: userRow } = await supabase
      .from("fi_users")
      .select("id")
      .eq("tenant_id", tid)
      .eq("auth_user_id", authId)
      .maybeSingle();

    return recordGuidedAssistEvent(
      tid,
      {
        fiUserId: userRow ? String((userRow as { id: string }).id) : null,
        eventKind: body.eventKind,
        guidanceArea: body.guidanceArea ?? null,
        guidanceCode: body.guidanceCode ?? null,
        pageKey: body.pageKey ?? null,
        detail: body.detail ?? {},
      },
      { actorAuthUserId: authId, skipAuthCheck: true }
    );
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid request." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to record event." };
  }
}

export async function setGuidedAssistTenantDefaultsAction(
  tenantId: string,
  defaults: {
    defaultEnabledDuringOnboarding?: boolean;
    defaultAssistEnabled?: boolean;
  }
): Promise<GuidedAssistActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const result = await setGuidedAssistTenantDefaults(tid, defaults, {
      actorAuthUserId: authId,
      skipAuthCheck: true,
    });
    if (!result.ok) return result;
    revalidateTenantAssistPaths(tid);
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid tenant." };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update tenant defaults.",
    };
  }
}

/** Admin: enable Clinic guide for all staff preference rows + tenant default on. */
export async function enableGuidedAssistForAllStaffAction(
  tenantId: string
): Promise<GuidedAssistActionResult & { updatedUserRows?: number; assistEnabled?: boolean }> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const result = await enableGuidedAssistForAllStaff(tid, {
      actorAuthUserId: authId,
      skipAuthCheck: true,
    });
    if (!result.ok) return result;
    revalidateTenantAssistPaths(tid);
    return {
      ok: true,
      updatedUserRows: result.updatedUserRows,
      assistEnabled: true,
    };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid tenant." };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to enable Clinic guide for all staff.",
    };
  }
}

export async function loadGuidedAssistSettingsStateAction(
  tenantId: string
): Promise<{ ok: true; state: GuidedAssistSettingsState } | { ok: false; error: string }> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    return loadGuidedAssistSettingsState(tid, {
      actorAuthUserId: authId,
      skipAuthCheck: true,
    });
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid tenant." };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to load Clinic guide settings.",
    };
  }
}

/** Thumbs up/down on a tip or tour step. */
export async function recordGuidedAssistTipFeedbackAction(
  tenantId: string,
  tipCode: string,
  helpful: boolean,
  pageKey?: string | null,
  comment?: string | null
): Promise<GuidedAssistActionResult & { helpful?: boolean }> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const code = tipCodeSchema.parse(tipCode);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const result = await recordGuidedAssistTipFeedback(tid, code, helpful, pageKey, {
      actorAuthUserId: authId,
      skipAuthCheck: true,
      comment: comment ?? null,
    });
    if (!result.ok) return result;
    return { ok: true, helpful: result.helpful };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid request." };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save feedback.",
    };
  }
}

/** Bump consecutive-day engagement streak (idempotent same day). */
export async function touchGuidedAssistEngagementAction(
  tenantId: string
): Promise<
  GuidedAssistActionResult & { streakDays?: number; streakMessage?: string | null }
> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const result = await touchGuidedAssistEngagement(tid, {
      actorAuthUserId: authId,
      skipAuthCheck: true,
    });
    if (!result.ok) return result;
    return {
      ok: true,
      streakDays: result.streakDays,
      streakMessage: result.streakMessage,
    };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid tenant." };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update engagement.",
    };
  }
}

/** Admin: force-show Clinic guide in this browser session (cookie). */
export async function setGuidedAssistForceShowAction(
  tenantId: string,
  forceShow: boolean
): Promise<GuidedAssistActionResult & { forceShowActive?: boolean }> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const result = await setGuidedAssistForceShow(tid, forceShow, {
      actorAuthUserId: authId,
      skipAuthCheck: true,
    });
    if (!result.ok) return result;
    revalidateTenantAssistPaths(tid);
    return { ok: true, forceShowActive: result.forceShowActive };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid tenant." };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update force-show override.",
    };
  }
}

export async function loadGuidedAssistUsageSummaryAction(
  tenantId: string,
  windowDays = 30
): Promise<{ ok: true; summary: GuidedAssistUsageSummary } | { ok: false; error: string }> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const result = await loadGuidedAssistUsageSummary(tid, windowDays, {
      actorAuthUserId: authId,
      skipAuthCheck: true,
    });
    return result;
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid tenant." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load usage summary." };
  }
}

const healthFiltersSchema = z.object({
  windowDays: z.union([z.literal(7), z.literal(30)]).optional(),
  role: z
    .enum(["all", "reception", "consultant", "doctor", "nurse", "finance", "admin"])
    .optional(),
});

/** Admin: Guide Health adoption + feedback snapshot (tenant-scoped, filterable). */
export async function loadGuidedAssistHealthSnapshotAction(
  tenantId: string,
  filters: Partial<GuidedAssistHealthFilters> | GuidedAssistHealthWindowDays = 30
): Promise<{ ok: true; health: GuidedAssistHealthSnapshot } | { ok: false; error: string }> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const normalized: Partial<GuidedAssistHealthFilters> =
      typeof filters === "number"
        ? { windowDays: filters === 7 ? 7 : 30, role: "all" }
        : healthFiltersSchema.parse(filters ?? {});

    return loadGuidedAssistHealthSnapshot(tid, normalized, {
      actorAuthUserId: authId,
      skipAuthCheck: true,
    });
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid request." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load Guide Health." };
  }
}

/** Admin: CSV export of guide events + feedback for the selected window/role. */
export async function exportGuidedAssistHealthCsvAction(
  tenantId: string,
  filters: Partial<GuidedAssistHealthFilters> = { windowDays: 30, role: "all" }
): Promise<
  { ok: true; csv: string; filename: string } | { ok: false; error: string }
> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const normalized = healthFiltersSchema.parse(filters ?? {});
    return exportGuidedAssistHealthCsv(tid, normalized, {
      actorAuthUserId: authId,
      skipAuthCheck: true,
    });
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid request." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to export CSV." };
  }
}

/** Admin: load Clinic guide rollout checklist for this tenant. */
export async function loadGuidedAssistRolloutSnapshotAction(
  tenantId: string
): Promise<{ ok: true; rollout: GuidedAssistRolloutSnapshot } | { ok: false; error: string }> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    return loadGuidedAssistRolloutSnapshot(tid, {
      actorAuthUserId: authId,
      skipAuthCheck: true,
    });
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid tenant." };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to load rollout checklist.",
    };
  }
}

/** Admin: toggle a rollout checklist item. */
export async function setGuidedAssistRolloutItemAction(
  tenantId: string,
  itemId: string,
  completed: boolean
): Promise<{ ok: true; rollout: GuidedAssistRolloutSnapshot } | { ok: false; error: string }> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const id = z.string().min(1).max(80).parse(itemId);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const result = await setGuidedAssistRolloutItem(tid, id, Boolean(completed), {
      actorAuthUserId: authId,
      skipAuthCheck: true,
    });
    if (result.ok) revalidateTenantAssistPaths(tid);
    return result;
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid request." };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update rollout checklist.",
    };
  }
}

/** Dismiss one-time “What’s new” highlight after a major guide release. */
export async function markGuidedAssistWhatsNewSeenAction(
  tenantId: string
): Promise<GuidedAssistActionResult & { version?: string }> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const result = await markGuidedAssistWhatsNewSeen(tid, {
      actorAuthUserId: authId,
      skipAuthCheck: true,
    });
    if (!result.ok) return result;
    return { ok: true, version: result.version };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid tenant." };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to dismiss What’s new.",
    };
  }
}
