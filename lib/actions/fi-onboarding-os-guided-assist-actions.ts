"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import {
  dismissGuidedAssistTip,
  enableGuidedAssistForAllStaff,
  incrementGuidedAssistTodayHomeViews,
  loadGuidedAssistSettingsState,
  loadGuidedAssistUsageSummary,
  recordGuidedAssistEvent,
  recordGuidedAssistTipFeedback,
  setGuidedAssistEnabledForUser,
  setGuidedAssistForceShow,
  setGuidedAssistTenantDefaults,
  snoozeGuidedAssistTip,
  touchGuidedAssistEngagement,
} from "@/src/lib/onboarding-os/guidedAssist.server";
import type {
  GuidedAssistEventKind,
  GuidedAssistSettingsState,
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
  pageKey?: string | null
): Promise<GuidedAssistActionResult & { helpful?: boolean }> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const code = tipCodeSchema.parse(tipCode);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const result = await recordGuidedAssistTipFeedback(tid, code, helpful, pageKey, {
      actorAuthUserId: authId,
      skipAuthCheck: true,
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
