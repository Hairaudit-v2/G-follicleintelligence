"use server";

import { z, ZodError } from "zod";

import {
  assertGoogleCalendarTenantAdminAccess,
  GoogleCalendarIntegrationAccessError,
} from "@/src/lib/googleCalendar/googleCalendarIntegrationAccess.server";
import { revalidateLiveDataSurfacesForTenant } from "@/src/lib/integrations/revalidateLiveDataPaths.server";
import {
  runGoogleCalendarBackfill,
  type GoogleCalendarBackfillResult,
} from "@/src/lib/integrations/googleCalendar/googleCalendarBackfill.server";
import type {
  GoogleCalendarBackfillDryRunSummary,
  GoogleCalendarBackfillWriteSummary,
} from "@/src/lib/integrations/googleCalendar/googleCalendarBackfillCore";

const backfillBodySchema = z
  .object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    calendarSourceId: z.string().optional(),
    clinicId: z.string().uuid().optional(),
    dryRun: z.boolean().optional(),
    promoteSafeBookings: z.boolean().optional(),
    preset: z.enum(["default", "next_14_days", "july_2026"]).optional(),
  })
  .strict();

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof GoogleCalendarIntegrationAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function resolvePresetDates(preset: string | undefined): {
  startDate?: string;
  endDate?: string;
} {
  if (preset === "next_14_days") {
    return {};
  }
  if (preset === "july_2026") {
    return { startDate: "2026-07-01", endDate: "2026-07-31" };
  }
  return {};
}

export type RunGoogleCalendarBackfillActionResult =
  | { ok: true; result: GoogleCalendarBackfillResult; message: string }
  | { ok: false; error: string };

export async function runGoogleCalendarBackfillAction(
  tenantId: string,
  body: unknown
): Promise<RunGoogleCalendarBackfillActionResult> {
  try {
    const parsed = backfillBodySchema.parse(body);
    await assertGoogleCalendarTenantAdminAccess(tenantId);

    const presetDates = resolvePresetDates(parsed.preset);
    let startDate = parsed.startDate?.trim() || presetDates.startDate;
    let endDate = parsed.endDate?.trim() || presetDates.endDate;

    if (parsed.preset === "next_14_days" && !startDate && !endDate) {
      const { resolveGoogleCalendarBackfillNextDaysRange } = await import(
        "@/src/lib/integrations/googleCalendar/googleCalendarBackfillCore"
      );
      const { resolveTenantCalendarTimezone } = await import(
        "@/src/lib/calendar/calendarTimezone"
      );
      const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
      const supabase = supabaseAdmin();
      const { data } = await supabase
        .from("fi_tenants")
        .select("default_timezone, metadata")
        .eq("id", tenantId.trim())
        .maybeSingle();
      const tz = resolveTenantCalendarTimezone(
        (data as { default_timezone?: string | null; metadata?: Record<string, unknown> | null } | null) ??
          null
      );
      const range = resolveGoogleCalendarBackfillNextDaysRange(14, tz);
      if ("error" in range) return { ok: false, error: range.error };
      startDate = range.rangeStart;
      endDate = range.rangeEnd;
    }

    const result = await runGoogleCalendarBackfill({
      tenantId: tenantId.trim(),
      clinicId: parsed.clinicId,
      calendarSourceId: parsed.calendarSourceId,
      startDate,
      endDate,
      dryRun: parsed.dryRun ?? false,
      promoteSafeBookings: parsed.promoteSafeBookings ?? true,
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    if (!parsed.dryRun) {
      revalidateLiveDataSurfacesForTenant(tenantId, { includeIntegrationsSettings: true });
    }

    const s = result.summary;
    const message = result.dryRun
      ? `Dry run — ${s.sourceEventsFound} source event(s): ${s.toCreate} to create, ${s.toUpdate} to update, ${s.alreadyImported} already imported, ${s.ambiguousReviewRequired} need review.`
      : `Import complete — ${(s as GoogleCalendarBackfillWriteSummary).createdCalendarEvents} calendar event(s) created, ${(s as GoogleCalendarBackfillWriteSummary).updatedCalendarEvents} updated, ${(s as GoogleCalendarBackfillWriteSummary).createdBookings} booking(s) created.`;

    return { ok: true, result, message };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export type { GoogleCalendarBackfillDryRunSummary, GoogleCalendarBackfillWriteSummary };
