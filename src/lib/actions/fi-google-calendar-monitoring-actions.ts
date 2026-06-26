"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import {
  assertGoogleCalendarTenantAdminAccess,
  GoogleCalendarIntegrationAccessError,
} from "@/src/lib/googleCalendar/googleCalendarIntegrationAccess.server";
import { FI_CALENDAR_SYNC_FREQUENCY_OPTIONS } from "@/src/lib/googleCalendar/googleCalendarSyncHealthCore";
import {
  pauseGoogleCalendarScheduledSync,
  resumeGoogleCalendarScheduledSync,
  setGoogleCalendarScheduledSyncEnabled,
  setGoogleCalendarSyncEnabled,
  setGoogleCalendarSyncFrequency,
  loadGoogleCalendarMonitoringPage,
  enableGoogleCalendarRealtimeSync,
  renewGoogleCalendarRealtimeSync,
} from "@/src/lib/googleCalendar/googleCalendarMonitoring.server";
import { createGoogleCalendarSyncAlertIfNeeded } from "@/src/lib/googleCalendar/googleCalendarSyncAlerts.server";

const frequencySchema = z.object({
  frequencyMinutes: z.union([
    z.literal(5),
    z.literal(15),
    z.literal(30),
    z.literal(60),
  ]),
});

const enabledSchema = z.object({ enabled: z.boolean() });

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof GoogleCalendarIntegrationAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateMonitoringSurfaces(tenantId: string): void {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/settings/integrations`);
}

export async function setGoogleCalendarScheduledSyncEnabledAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = enabledSchema.parse(body);
    await assertGoogleCalendarTenantAdminAccess(tenantId);
    const result = await setGoogleCalendarScheduledSyncEnabled({
      tenantId: tenantId.trim(),
      enabled: parsed.enabled,
    });
    if (!result.ok) return result;
    revalidateMonitoringSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function setGoogleCalendarSyncFrequencyAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = frequencySchema.parse(body);
    if (!FI_CALENDAR_SYNC_FREQUENCY_OPTIONS.includes(parsed.frequencyMinutes)) {
      return { ok: false, error: "Invalid sync frequency." };
    }
    await assertGoogleCalendarTenantAdminAccess(tenantId);
    const result = await setGoogleCalendarSyncFrequency({
      tenantId: tenantId.trim(),
      frequencyMinutes: parsed.frequencyMinutes,
    });
    if (!result.ok) return result;
    revalidateMonitoringSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function pauseGoogleCalendarScheduledSyncAction(
  tenantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { actorAuthUserId } = await assertGoogleCalendarTenantAdminAccess(tenantId);
    const result = await pauseGoogleCalendarScheduledSync({ tenantId: tenantId.trim() });
    if (!result.ok) return result;

    const integration = await loadGoogleCalendarMonitoringPage(tenantId.trim(), { canManage: true });
    if (integration.integrationId) {
      await createGoogleCalendarSyncAlertIfNeeded({
        tenantId: tenantId.trim(),
        integrationId: integration.integrationId,
        eventType: "google_calendar_sync_paused",
        title: "Scheduled Google Calendar sync paused",
        message: "An admin paused scheduled sync.",
        severity: "info",
        idempotencyKey: `gcal-manual-pause:${integration.integrationId}:${Date.now()}`,
        metadata: { actorAuthUserId },
      });
    }

    revalidateMonitoringSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function resumeGoogleCalendarScheduledSyncAction(
  tenantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertGoogleCalendarTenantAdminAccess(tenantId);
    const page = await loadGoogleCalendarMonitoringPage(tenantId.trim(), { canManage: true });
    const integrationId = page.integrationId;

    const result = await resumeGoogleCalendarScheduledSync({ tenantId: tenantId.trim() });
    if (!result.ok) return result;

    if (integrationId) {
      await createGoogleCalendarSyncAlertIfNeeded({
        tenantId: tenantId.trim(),
        integrationId,
        eventType: "google_calendar_sync_resumed",
        title: "Scheduled Google Calendar sync resumed",
        message: "Scheduled sync is active again.",
        severity: "info",
        idempotencyKey: `gcal-manual-resume:${integrationId}:${Date.now()}`,
      });
    }

    revalidateMonitoringSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function setGoogleCalendarSyncEnabledAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = enabledSchema.parse(body);
    await assertGoogleCalendarTenantAdminAccess(tenantId);
    const result = await setGoogleCalendarSyncEnabled({
      tenantId: tenantId.trim(),
      enabled: parsed.enabled,
    });
    if (!result.ok) return result;
    revalidateMonitoringSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function enableGoogleCalendarRealtimeSyncAction(
  tenantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertGoogleCalendarTenantAdminAccess(tenantId);
    const result = await enableGoogleCalendarRealtimeSync({ tenantId: tenantId.trim() });
    if (!result.ok) return result;
    revalidateMonitoringSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function renewGoogleCalendarRealtimeSyncAction(
  tenantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertGoogleCalendarTenantAdminAccess(tenantId);
    const page = await loadGoogleCalendarMonitoringPage(tenantId.trim(), { canManage: true });
    const result = await renewGoogleCalendarRealtimeSync({
      tenantId: tenantId.trim(),
      subscriptionId: page.webhook.subscriptionId ?? undefined,
    });
    if (!result.ok) return result;
    revalidateMonitoringSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
