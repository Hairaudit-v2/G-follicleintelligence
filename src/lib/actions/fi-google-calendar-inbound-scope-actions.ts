"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import {
  assertGoogleCalendarTenantAdminAccess,
  GoogleCalendarIntegrationAccessError,
} from "@/src/lib/googleCalendar/googleCalendarIntegrationAccess.server";
import type { InboundSyncCalendarClientRow } from "@/src/lib/googleCalendar/googleCalendarInboundScopeCore";
import {
  refreshGoogleInboundCalendarScopes,
  runGoogleCalendarInboundSyncNow,
  setGoogleInboundSyncCalendarEnabled,
} from "@/src/lib/googleCalendar/googleCalendarInboundScope.server";
import type { GoogleCalendarInboundSyncNowSummary } from "@/src/lib/googleCalendar/googleCalendarInboundScopeCore";

const toggleBodySchema = z
  .object({
    calendarRowId: z.string().uuid(),
    isEnabled: z.boolean(),
  })
  .strict();

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof GoogleCalendarIntegrationAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateInboundScopeSurfaces(tenantId: string): void {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/settings/integrations`);
  revalidatePath(`/fi-admin/${tid}/calendar`);
}

export async function toggleGoogleInboundSyncCalendarAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; calendar: InboundSyncCalendarClientRow } | { ok: false; error: string }> {
  try {
    const parsed = toggleBodySchema.parse(body);
    const { actorAuthUserId } = await assertGoogleCalendarTenantAdminAccess(tenantId);
    const result = await setGoogleInboundSyncCalendarEnabled({
      tenantId: tenantId.trim(),
      calendarRowId: parsed.calendarRowId,
      isEnabled: parsed.isEnabled,
      actorAuthUserId,
    });
    if (!result.ok) return result;
    revalidateInboundScopeSurfaces(tenantId);
    return result;
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export type RefreshGoogleInboundScopesActionResult =
  | {
      ok: true;
      calendarsDiscovered: number;
      inserted: number;
      updated: number;
      preservedEnabledState: number;
      message: string;
    }
  | { ok: false; error: string };

export async function refreshGoogleInboundCalendarScopesAction(
  tenantId: string
): Promise<RefreshGoogleInboundScopesActionResult> {
  try {
    await assertGoogleCalendarTenantAdminAccess(tenantId);
    const result = await refreshGoogleInboundCalendarScopes(tenantId.trim());
    if (!result.ok) return { ok: false, error: result.error };
    revalidateInboundScopeSurfaces(tenantId);
    return {
      ok: true,
      calendarsDiscovered: result.calendarsDiscovered,
      inserted: result.inserted,
      updated: result.updated,
      preservedEnabledState: result.preservedEnabledState,
      message: `Discovered ${result.calendarsDiscovered} calendar${result.calendarsDiscovered === 1 ? "" : "s"} (${result.inserted} new, ${result.updated} updated). Existing enable/disable choices preserved.`,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export type RunGoogleCalendarInboundSyncNowActionResult =
  | { ok: true; summary: GoogleCalendarInboundSyncNowSummary; message: string }
  | { ok: false; error: string; summary?: GoogleCalendarInboundSyncNowSummary };

export async function runGoogleCalendarInboundSyncNowAction(
  tenantId: string
): Promise<RunGoogleCalendarInboundSyncNowActionResult> {
  try {
    await assertGoogleCalendarTenantAdminAccess(tenantId);
    const result = await runGoogleCalendarInboundSyncNow(tenantId.trim());
    revalidateInboundScopeSurfaces(tenantId);

    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        summary: result.summary,
      };
    }

    const s = result.summary;
    const message = `Sync complete — ${s.calendarsScanned} calendar${s.calendarsScanned === 1 ? "" : "s"} scanned, ${s.fetched} fetched, ${s.inserted} inserted, ${s.updated} updated, ${s.skipped} skipped${s.failed ? `, ${s.failed} failed` : ""}.`;

    return { ok: true, summary: s, message };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
