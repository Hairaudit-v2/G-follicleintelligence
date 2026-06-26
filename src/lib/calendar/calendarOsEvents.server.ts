import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  FI_CALENDAR_EVENTS_OVERLAP_SELECT,
  type FiCalendarEventOverlapRow,
} from "@/src/lib/calendar/calendarOsEventsCore";

export type LoadFiCalendarEventsForOverlapParams = {
  tenantId: string;
  rangeStartIso: string;
  rangeEndIso: string;
  limit?: number;
};

export async function loadFiCalendarEventsForOverlap(
  params: LoadFiCalendarEventsForOverlapParams,
  supabaseClientForTests?: SupabaseClient
): Promise<FiCalendarEventOverlapRow[]> {
  const tid = params.tenantId.trim();
  const rangeStart = params.rangeStartIso.trim();
  const rangeEnd = params.rangeEndIso.trim();
  if (!tid || !rangeStart || !rangeEnd) return [];

  const limit = Math.min(Math.max(params.limit ?? 400, 1), 800);

  const { data, error } = await (supabaseClientForTests ?? supabaseAdmin())
    .from("fi_calendar_events")
    .select(FI_CALENDAR_EVENTS_OVERLAP_SELECT)
    .eq("tenant_id", tid)
    .lt("start_time", rangeEnd)
    .gt("end_time", rangeStart)
    .order("start_time", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  return ((data ?? []) as FiCalendarEventOverlapRow[]).filter((row) => {
    const meta = row.metadata ?? {};
    return meta.deleted_from_provider !== true && meta.deleted_locally !== true;
  });
}

export { mapFiCalendarEventsToOperationalCalendar } from "@/src/lib/calendar/calendarOsEventsCore";
