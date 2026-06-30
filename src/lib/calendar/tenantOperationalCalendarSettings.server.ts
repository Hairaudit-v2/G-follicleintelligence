import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCalendarTimeZone } from "@/src/lib/calendar/calendarTimezone";
import {
  calendarSettingsToGridConfig,
  DEFAULT_CALENDAR_SETTINGS,
  type FiCalendarSettingsDocument,
} from "@/src/lib/calendar/calendarSettingsCore";
import { resolveCalendarSettingsForScope } from "@/src/lib/calendar/calendarSettings.server";
import {
  DEFAULT_BUSINESS_GRID,
  type BusinessGridConfig,
} from "@/src/lib/calendar/operationalCalendarLayout";

function parseGridFromTenantMetadata(
  metadata: unknown,
  timeZone: string
): BusinessGridConfig | null {
  if (!metadata || typeof metadata !== "object") return null;
  const root = metadata as Record<string, unknown>;
  const raw = root.operational_calendar ?? root.calendar;
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  let dayStart = Number(c.dayStartHourUtc);
  let dayEnd = Number(c.dayEndHourUtc);
  let sm = Number(c.slotMinutes);
  if (!Number.isFinite(dayStart) || dayStart < 0 || dayStart > 23)
    dayStart = DEFAULT_BUSINESS_GRID.dayStartHourUtc;
  if (!Number.isFinite(dayEnd) || dayEnd <= dayStart || dayEnd > 24) {
    dayEnd = Math.max(dayStart + 1, DEFAULT_BUSINESS_GRID.dayEndHourUtc);
  }
  if (sm !== 15 && sm !== 30 && sm !== 60) sm = DEFAULT_BUSINESS_GRID.slotMinutes;
  return {
    dayStartHourUtc: Math.floor(dayStart),
    dayEndHourUtc: Math.floor(dayEnd),
    slotMinutes: sm as 15 | 30 | 60,
    timeZone,
  };
}

function settingsFromLegacyGrid(grid: BusinessGridConfig): FiCalendarSettingsDocument {
  return {
    ...DEFAULT_CALENDAR_SETTINGS,
    dayStartHour: grid.dayStartHourUtc,
    dayEndHour: grid.dayEndHourUtc,
    slotMinutes: grid.slotMinutes,
  };
}

/**
 * Loads calendar display settings from `fi_calendar_settings` (with legacy metadata fallback for grid hours),
 * plus `fi_tenant_settings.default_timezone` for IANA zone resolution.
 */
export async function loadTenantOperationalCalendarSettings(
  tenantId: string,
  clinicId?: string | null
): Promise<{
  gridConfig: BusinessGridConfig;
  calendarTimezone: string;
  /** True when `fi_tenant_settings.default_timezone` is set (not relying on fallback). */
  timezoneConfigured: boolean;
  settings: FiCalendarSettingsDocument;
}> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenant_settings")
    .select("default_timezone, metadata")
    .eq("tenant_id", tenantId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { default_timezone?: string | null; metadata?: unknown } | null;
  const calendarTimezone = getCalendarTimeZone(
    row
      ? {
          tenant: {
            default_timezone: row.default_timezone,
            metadata: row.metadata as Record<string, unknown>,
          },
        }
      : null
  );

  const stored = await resolveCalendarSettingsForScope(tenantId, clinicId);
  if (stored) {
    return {
      gridConfig: calendarSettingsToGridConfig(stored, calendarTimezone),
      calendarTimezone,
      timezoneConfigured: Boolean(row?.default_timezone?.trim()),
      settings: stored,
    };
  }

  const legacyGrid = parseGridFromTenantMetadata(row?.metadata, calendarTimezone);
  const settings = legacyGrid
    ? settingsFromLegacyGrid(legacyGrid)
    : { ...DEFAULT_CALENDAR_SETTINGS };
  const gridConfig = legacyGrid ?? calendarSettingsToGridConfig(settings, calendarTimezone);

  return {
    gridConfig,
    calendarTimezone,
    timezoneConfigured: Boolean(row?.default_timezone?.trim()),
    settings,
  };
}
