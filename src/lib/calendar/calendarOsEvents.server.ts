import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logOperationalCalendarServerTiming } from "@/src/lib/calendar/calendarPerfDev";
import {
  CALENDAR_OS_EVENTS_OVERLAP_CAP,
  FI_CALENDAR_EVENTS_OVERLAP_SELECT,
  FI_CALENDAR_EVENTS_OVERLAP_SELECT_BASE,
  isMissingFiCalendarIdentityColumnError,
  type FiCalendarEventOverlapRow,
} from "@/src/lib/calendar/calendarOsEventsCore";

export type LoadFiCalendarEventsForOverlapParams = {
  tenantId: string;
  rangeStartIso: string;
  rangeEndIso: string;
  limit?: number;
};

type OverlapQueryResult = {
  data: FiCalendarEventOverlapRow[] | null;
  error: { message?: string; code?: string } | null;
};

async function queryFiCalendarEventsOverlap(
  client: SupabaseClient,
  args: {
    tenantId: string;
    rangeStart: string;
    rangeEnd: string;
    limit: number;
    select: string;
  }
): Promise<OverlapQueryResult> {
  const { data, error } = await client
    .from("fi_calendar_events")
    .select(args.select)
    .eq("tenant_id", args.tenantId)
    .lt("start_time", args.rangeEnd)
    .gt("end_time", args.rangeStart)
    .order("start_time", { ascending: true })
    .limit(args.limit);

  return {
    data: (data ?? null) as FiCalendarEventOverlapRow[] | null,
    error: error
      ? { message: error.message, code: (error as { code?: string }).code }
      : null,
  };
}

export async function loadFiCalendarEventsForOverlap(
  params: LoadFiCalendarEventsForOverlapParams,
  supabaseClientForTests?: SupabaseClient
): Promise<FiCalendarEventOverlapRow[]> {
  const tid = params.tenantId.trim();
  const rangeStart = params.rangeStartIso.trim();
  const rangeEnd = params.rangeEndIso.trim();
  if (!tid || !rangeStart || !rangeEnd) return [];

  const limit = Math.min(Math.max(params.limit ?? 400, 1), CALENDAR_OS_EVENTS_OVERLAP_CAP);
  const client = supabaseClientForTests ?? supabaseAdmin();

  let result = await queryFiCalendarEventsOverlap(client, {
    tenantId: tid,
    rangeStart,
    rangeEnd,
    limit,
    select: FI_CALENDAR_EVENTS_OVERLAP_SELECT,
  });

  if (result.error && isMissingFiCalendarIdentityColumnError(result.error)) {
    logOperationalCalendarServerTiming({
      phase: "loadFiCalendarEventsForOverlap.identityColumnsMissing",
      tenantId: tid,
      rangeStartIso: rangeStart,
      rangeEndIso: rangeEnd,
      message:
        "fi_calendar_events.consultation_id/person_id missing — falling back to base overlap select (metadata identity only)",
    });
    result = await queryFiCalendarEventsOverlap(client, {
      tenantId: tid,
      rangeStart,
      rangeEnd,
      limit,
      select: FI_CALENDAR_EVENTS_OVERLAP_SELECT_BASE,
    });
  }

  if (result.error) throw new Error(result.error.message ?? "Calendar overlap query failed");

  const rows = (result.data ?? []).filter((row) => {
    const meta = row.metadata ?? {};
    return meta.deleted_from_provider !== true && meta.deleted_locally !== true;
  });

  if (rows.length >= CALENDAR_OS_EVENTS_OVERLAP_CAP) {
    logOperationalCalendarServerTiming({
      phase: "loadFiCalendarEventsForOverlap.capWarning",
      tenantId: tid,
      rangeStartIso: rangeStart,
      rangeEndIso: rangeEnd,
      returnedCount: rows.length,
      cap: CALENDAR_OS_EVENTS_OVERLAP_CAP,
      message: "CalendarOS overlap query hit safety cap — month view may be truncated",
    });
  }

  return rows;
}

export {
  mapFiCalendarEventsToOperationalCalendar,
  CALENDAR_OS_EVENTS_OVERLAP_CAP,
} from "@/src/lib/calendar/calendarOsEventsCore";
