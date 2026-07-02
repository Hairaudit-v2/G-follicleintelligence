/**
 * CalendarOS V2 feature flag resolution (pure + env helpers).
 */

import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";

export const CALENDAR_V2_FEATURE_KEY: FiFeatureKey = "calendar_v2";

export type CalendarV2EnableInput = {
  featureAccess?: Partial<Record<FiFeatureKey, boolean>> | null;
  searchParams?: Record<string, string | string[] | undefined>;
  envCalendarV2?: boolean;
};

function parseBoolParam(v: string | string[] | undefined): boolean {
  if (v == null) return false;
  const s = (Array.isArray(v) ? v[0] : v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

/** Whether CalendarOS V2 resource-first grid should render instead of legacy WeekView. */
export function isCalendarOsV2Enabled(input: CalendarV2EnableInput): boolean {
  if (input.envCalendarV2 === true) return true;
  if (parseBoolParam(input.searchParams?.calendarV2)) return true;
  if (input.featureAccess?.[CALENDAR_V2_FEATURE_KEY] === true) return true;
  return false;
}
