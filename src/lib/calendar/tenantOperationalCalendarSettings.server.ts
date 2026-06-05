import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveTenantCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";
import {
  DEFAULT_BUSINESS_GRID,
  type BusinessGridConfig,
} from "@/src/lib/calendar/operationalCalendarLayout";

function parseGridFromTenantMetadata(metadata: unknown, timeZone: string): BusinessGridConfig {
  if (!metadata || typeof metadata !== "object") {
    return { ...DEFAULT_BUSINESS_GRID, timeZone };
  }
  const root = metadata as Record<string, unknown>;
  const raw = root.operational_calendar ?? root.calendar;
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_BUSINESS_GRID, timeZone };
  }
  const c = raw as Record<string, unknown>;
  let dayStart = Number(c.dayStartHourUtc);
  let dayEnd = Number(c.dayEndHourUtc);
  let sm = Number(c.slotMinutes);
  if (!Number.isFinite(dayStart) || dayStart < 0 || dayStart > 23) dayStart = DEFAULT_BUSINESS_GRID.dayStartHourUtc;
  if (!Number.isFinite(dayEnd) || dayEnd <= dayStart || dayEnd > 24) {
    dayEnd = Math.max(dayStart + 1, DEFAULT_BUSINESS_GRID.dayEndHourUtc);
  }
  if (sm !== 30 && sm !== 60) sm = DEFAULT_BUSINESS_GRID.slotMinutes;
  return {
    dayStartHourUtc: Math.floor(dayStart),
    dayEndHourUtc: Math.floor(dayEnd),
    slotMinutes: sm as 30 | 60,
    timeZone,
  };
}

/**
 * Loads `fi_tenant_settings.default_timezone` (and optional `metadata.operational_calendar`)
 * for scheduling grids. Canonical clinic clock: `fi_tenant_settings.default_timezone`.
 */
export async function loadTenantOperationalCalendarSettings(tenantId: string): Promise<{
  gridConfig: BusinessGridConfig;
  calendarTimezone: string;
}> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenant_settings")
    .select("default_timezone, metadata")
    .eq("tenant_id", tenantId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { default_timezone?: string | null; metadata?: unknown } | null;
  const calendarTimezone = resolveTenantCalendarTimezone(
    row ? { default_timezone: row.default_timezone, metadata: row.metadata as Record<string, unknown> } : null
  );
  const gridConfig = parseGridFromTenantMetadata(row?.metadata, calendarTimezone);
  return { gridConfig, calendarTimezone };
}
