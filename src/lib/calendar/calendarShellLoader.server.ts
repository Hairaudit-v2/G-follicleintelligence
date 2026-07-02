import "server-only";

import { formatCalendarRangeTitle } from "@/src/lib/bookings/calendarLabels";
import { buildCalendarLanesForView } from "@/src/lib/bookings/calendarView";
import {
  calendarRangeIsoForQuery,
  parseCalendarSearchParams,
  type CalendarRoute,
  type ParsedCalendarQuery,
} from "@/src/lib/bookings/calendarQuery";
import { buildCalendarHref, mergeCalendarHrefQuery } from "@/src/lib/bookings/calendarQuery";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { resolveShellCalendarSettingsFromTenantRow } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import {
  beginFiPerfCollection,
  finishFiPerfCollection,
  recordFiPerfPayloadBytes,
  recordFiPerfSpan,
  withFiPerfSpan,
} from "@/src/lib/performance/fiPerfCollector.server";
import { loadCalendarShellBootstrapCached } from "@/src/lib/performance/referenceDataCache.server";
import {
  applyCalendarSettingsToQuery,
  calendarSettingsRedirectNeeded,
  filterCalendarLanesForWeekends,
} from "@/src/lib/calendar/calendarSettingsCore";
import type {
  OperationalCalendarPageData,
  OperationalCalendarResourceColumn,
} from "@/src/lib/calendar/operationalCalendarTypes";
import { logOperationalCalendarServerTiming } from "@/src/lib/calendar/calendarPerfDev";

function clinicIdFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): string | null {
  const raw = searchParams.clinicId;
  const s = (Array.isArray(raw) ? String(raw[0] ?? "") : String(raw ?? "")).trim();
  return /^[0-9a-f-]{36}$/i.test(s) ? s : null;
}

function resolveCalendarQueryFromShellSettings(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>,
  route: CalendarRoute,
  calendarSettings: ReturnType<typeof resolveShellCalendarSettingsFromTenantRow>
): {
  query: ParsedCalendarQuery;
  lanes: ReturnType<typeof buildCalendarLanesForView>;
  settingsRedirectHref: string | null;
} {
  const parsed = parseCalendarSearchParams(searchParams, new Date(), {
    calendarTimezone: calendarSettings.calendarTimezone,
  });
  const withSettings = applyCalendarSettingsToQuery(
    parsed,
    calendarSettings.settings,
    searchParams
  );
  const lanes = filterCalendarLanesForWeekends(
    buildCalendarLanesForView(
      withSettings.view,
      withSettings.dateAnchor,
      withSettings.calendarTimezone
    ),
    withSettings.view,
    calendarSettings.settings.showWeekends
  );

  const settingsRedirectHref = calendarSettingsRedirectNeeded(parsed, withSettings)
    ? buildCalendarHref(tenantId.trim(), mergeCalendarHrefQuery(withSettings, {}), { route })
    : null;

  return { query: withSettings, lanes, settingsRedirectHref };
}

function buildShellResourceColumns(
  resourceView: ParsedCalendarQuery["resourceView"]
): OperationalCalendarResourceColumn[] {
  if (resourceView === "room") {
    return [{ id: "unassigned", kind: "unassigned", label: "Unassigned", subtitle: "No room" }];
  }
  if (resourceView === "clinic") {
    return [{ id: "unassigned", kind: "unassigned", label: "Unassigned", subtitle: "No clinic" }];
  }
  return [{ id: "unassigned", kind: "unassigned", label: "Unassigned", subtitle: "No staff column" }];
}

/**
 * Fast calendar shell — toolbar, lanes, and empty grid only (~2 queries).
 * Directory, services, mutation gate, and intelligence hydrate via grid patch.
 */
export async function loadOperationalCalendarShellData(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>,
  opts?: { route?: CalendarRoute }
): Promise<OperationalCalendarPageData> {
  const route = opts?.route ?? "fi-admin";
  const tid = tenantId.trim();
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  beginFiPerfCollection("calendar_shell", tid);

  try {
    const bootstrap = await withFiPerfSpan("tenant.bootstrap", () =>
      loadCalendarShellBootstrapCached(tid)
    );

    const layoutT0 = performance.now();
    const calendarSettings = resolveShellCalendarSettingsFromTenantRow({
      defaultTimezone: bootstrap.defaultTimezone,
      metadata: bootstrap.settingsMetadata,
    });

    const {
      query: resolvedQuery,
      lanes,
      settingsRedirectHref,
    } = resolveCalendarQueryFromShellSettings(tid, searchParams, route, calendarSettings);
    const query = resolvedQuery;
    const { rangeStartIso, rangeEndIso } = calendarRangeIsoForQuery(query);

    const resourceColumns = buildShellResourceColumns(query.resourceView);

    const buckets: Record<string, FiBookingRow[]> = {};
    for (const lane of lanes) {
      buckets[lane.dayKey] = [];
    }

    const rangeTitle = formatCalendarRangeTitle(query.view, lanes, query.calendarTimezone);
    recordFiPerfSpan("resolve.layout", performance.now() - layoutT0);

    const payload: OperationalCalendarPageData = {
      tenantId: tid,
      tenantMetadata: bootstrap.tenantMetadata,
      query,
      calendarTimezone: query.calendarTimezone,
      rangeStartIso,
      rangeEndIso,
      rangeTitle,
      lanes,
      buckets,
      bookings: [],
      bookingDisplay: {},
      assignees: [],
      staffDirectory: [],
      clinics: [],
      rooms: [],
      roomDisplayById: {},
      resourceColumns,
      gridConfig: calendarSettings.gridConfig,
      calendarSettings: calendarSettings.settings,
      listTruncated: false,
      canMutateBookings: false,
      bookingMutationBlockedReason: null,
      reminderJobsByBookingId: {},
      services: [],
      setupRecommendations: [],
      canonicalRedirectHref: settingsRedirectHref,
      calendarOperatorPrimaryClinicId: null,
      calendarV2Enabled: false,
      loadTier: "shell",
    };

    recordFiPerfPayloadBytes(JSON.stringify(payload).length);

    const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
    logOperationalCalendarServerTiming({
      phase: "loadOperationalCalendarShellData",
      durationMs: Math.round(t1 - t0),
      view: query.view,
      dateAnchor: query.dateAnchor,
      rangeStartIso,
      rangeEndIso,
    });

    return payload;
  } finally {
    finishFiPerfCollection();
  }
}