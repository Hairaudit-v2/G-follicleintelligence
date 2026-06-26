import "server-only";

import { cache } from "react";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadBookingsForCalendarOverlap } from "@/src/lib/bookings/bookings";
import { CALENDAR_VIEW_BOOKINGS_LIMIT } from "@/src/lib/bookings/operatorBookingConstants";
import { formatCalendarRangeTitle } from "@/src/lib/bookings/calendarLabels";
import {
  bucketBookingsIntoCalendar,
  buildCalendarLanesForView,
} from "@/src/lib/bookings/calendarView";
import { calendarRangeIsoForQuery, parseCalendarSearchParams, type CalendarRoute, type ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import { buildCalendarHref, mergeCalendarHrefQuery } from "@/src/lib/bookings/calendarQuery";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";

import type {
  OperationalCalendarBookingDisplay,
  OperationalCalendarGridPatch,
  OperationalCalendarPageData,
  OperationalCalendarResourceColumn,
} from "@/src/lib/calendar/operationalCalendarTypes";
import { mergeOperationalCalendarShellAndGrid } from "@/src/lib/calendar/operationalCalendarMerge";
import { loadClinicalStaffingSummariesForBookings } from "@/src/lib/workforce-os/workforceEventAssignmentBridge.server";

export type {
  OperationalCalendarBookingDisplay,
  OperationalCalendarGridPatch,
  OperationalCalendarPageData,
  OperationalCalendarResourceColumn,
} from "@/src/lib/calendar/operationalCalendarTypes";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { resolveDevelopmentClinicAccessForTenant } from "@/src/lib/fiOs/developmentClinicAccess.server";
import { formatStaffWeeklyHoursSummary, parseStaffWeeklyHours } from "@/src/lib/staff/staffWeeklyHours";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import { loadCrmShellUserPickerOptions } from "@/src/lib/crm/crmShellLoaders";
import { loadClinicalStaffPickerOptions } from "@/src/lib/staff/clinicalStaffPickerLoader.server";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import { parseStaffProfileExtras } from "@/src/lib/staff/staffProfileExtras";
import {
  buildLegacyUserResourceColumns,
  buildStaffResourceColumns,
  buildStaffUserLinkIndex,
  normalizeCalendarStaffFilter,
} from "@/src/lib/calendar/operationalCalendarColumns";
import { formatClinicalScalesSummary } from "@/src/lib/patients/hairLossScales";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";
import { serviceForBookingType } from "@/src/lib/bookings/servicesCatalog";
import { loadClinicRoomsForTenant } from "@/src/lib/rooms/fiClinicRooms.server";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import { isCalendarVisibleClinicalStaff } from "@/src/lib/staff/calendarVisibleStaff";
import {
  anchorLabelForBookingRow,
  patientContactForBookingRow,
  type BookingDisplayContextMaps,
} from "@/src/lib/bookings/bookingDisplayContext";
import { optimisticBookingAnchorLabel } from "@/src/lib/bookings/bookingDisplayName";
import { loadBookingDisplayContextMaps } from "@/src/lib/bookings/bookingDisplayContext.server";
import {
  buildBookingResourceSummaryLines,
  loadBookingResourceAssignmentsForBookings,
  type FiBookingResourceAssignmentRow,
} from "@/src/lib/calendar/bookingResourceRequirements.server";
import { logOperationalCalendarServerTiming } from "@/src/lib/calendar/calendarPerfDev";
import { operationalCalendarSkipsHeavyEnrichment } from "@/src/lib/calendar/operationalCalendarEnrichmentPolicy";
import {
  loadFiCalendarEventsForOverlap,
  mapFiCalendarEventsToOperationalCalendar,
} from "@/src/lib/calendar/calendarOsEvents.server";
import {
  calendarOsOverlapRowsForDisplayContext,
} from "@/src/lib/calendar/calendarOsEventsCore";
import { loadActiveStaffCalendarLinkIndex } from "@/src/lib/googleCalendar/googleCalendarProviderLinks.server";

type ClinicalLite = {
  norwood_scale: string | null;
  ludwig_scale: string | null;
  hairline_pattern: string | null;
  primary_concern: string | null;
};

const loadTenantCalendarSettingsCached = cache((tenantId: string) => loadTenantOperationalCalendarSettings(tenantId.trim()));

const loadTenantStaffAndResourcesCached = cache(
  (tenantId: string, resourceView: ParsedCalendarQuery["resourceView"], clinicId: string | null) =>
    loadTenantStaffAndClinics(tenantId.trim(), {
      resourceView,
      clinicId: clinicId?.trim() || null,
    })
);

const resolveBookingMutationGateCached = cache((tenantId: string) => resolveBookingMutationGate(tenantId.trim()));

const loadFiServicesForTenantCached = cache((tenantId: string) => loadFiServicesForTenant(tenantId.trim()));

const loadTenantConfigRowCached = cache(async (tenantId: string) => {
  const { data, error } = await supabaseAdmin()
    .from("fi_tenants")
    .select("config_json")
    .eq("id", tenantId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { config_json?: unknown } | null;
});

async function loadClinicalDetailsMap(tenantId: string, patientIds: string[]): Promise<Map<string, ClinicalLite>> {
  const out = new Map<string, ClinicalLite>();
  const ids = Array.from(new Set(patientIds.map((x) => x.trim()).filter(Boolean)));
  if (!ids.length) return out;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patient_clinical_details")
    .select("patient_id, norwood_scale, ludwig_scale, hairline_pattern, primary_concern")
    .eq("tenant_id", tenantId.trim())
    .in("patient_id", ids);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const r = raw as {
      patient_id: string;
      norwood_scale: string | null;
      ludwig_scale: string | null;
      hairline_pattern: string | null;
      primary_concern: string | null;
    };
    out.set(String(r.patient_id), {
      norwood_scale: r.norwood_scale,
      ludwig_scale: r.ludwig_scale,
      hairline_pattern: r.hairline_pattern,
      primary_concern: r.primary_concern,
    });
  }
  return out;
}

async function loadTenantStaffAndClinics(
  tenantId: string,
  opts?: { resourceView?: ParsedCalendarQuery["resourceView"]; clinicId?: string | null }
): Promise<{
  assignees: CrmShellUserPickerOption[];
  staffDirectory: ClinicalStaffPickerOption[];
  clinics: CrmShellClinicOption[];
  rooms: FiClinicRoomRow[];
  resourceColumns: OperationalCalendarResourceColumn[];
  staffUserByStaffId: Map<string, string | null>;
  staffIdByUserId: Map<string, string>;
  roomDisplayById: Record<string, string>;
}> {
  const tid = tenantId.trim();
  const resourceView = opts?.resourceView ?? "staff";
  const clinicFilter = opts?.clinicId?.trim() || null;

  const [userAssignees, staffDirectory, clinicsRes, allRooms] = await Promise.all([
    loadCrmShellUserPickerOptions(tid),
    loadClinicalStaffPickerOptions(tid),
    supabaseAdmin()
      .from("fi_clinics")
      .select("id, display_name, organisation_id, metadata")
      .eq("tenant_id", tid)
      .order("display_name", { ascending: true }),
    loadClinicRoomsForTenant(tid, { clinicId: clinicFilter }),
  ]);
  if (clinicsRes.error) throw new Error(clinicsRes.error.message);

  const rooms =
    resourceView === "room" ? allRooms.filter((r) => r.is_active) : allRooms;

  const calendarStaff = staffDirectory.filter((s) =>
    isCalendarVisibleClinicalStaff({
      is_active: s.is_active ?? true,
      staff_role: s.staff_role,
      calendar_visible: s.calendar_visible,
    })
  );

  const staffUserByStaffId = new Map<string, string | null>();
  const { staffIdByUserId } = buildStaffUserLinkIndex(calendarStaff);
  for (const s of calendarStaff) {
    staffUserByStaffId.set(s.id, s.fi_user_id?.trim() || null);
  }

  const clinics: CrmShellClinicOption[] = (clinicsRes.data ?? []).map((c) => {
    const r = c as {
      id: string;
      display_name: string;
      organisation_id: string | null;
      metadata?: unknown;
    };
    return {
      id: String(r.id),
      display_name: String(r.display_name),
      organisation_id: r.organisation_id != null ? String(r.organisation_id) : null,
      metadata: r.metadata != null && typeof r.metadata === "object" && !Array.isArray(r.metadata) ? (r.metadata as Record<string, unknown>) : null,
    };
  });

  const roomDisplayById: Record<string, string> = {};
  for (const room of allRooms) {
    roomDisplayById[room.id] = room.display_name;
  }

  const staffColumns = buildStaffResourceColumns(calendarStaff);

  const roomColumns: OperationalCalendarResourceColumn[] = rooms.map((room) => ({
    id: `r:${room.id}`,
    kind: "room" as const,
    label: room.display_name,
    subtitle: room.room_type.replace(/_/g, " "),
  }));

  const clinicColumns: OperationalCalendarResourceColumn[] = clinics.map((c) => ({
    id: `c:${c.id}`,
    kind: "clinic" as const,
    label: c.display_name,
    subtitle: "Clinic site",
  }));

  let resourceColumns: OperationalCalendarResourceColumn[];
  if (resourceView === "room") {
    resourceColumns = [...roomColumns, { id: "unassigned", kind: "unassigned", label: "Unassigned", subtitle: "No room" }];
  } else if (resourceView === "clinic") {
    resourceColumns = [
      ...clinicColumns,
      { id: "unassigned", kind: "unassigned", label: "Unassigned", subtitle: "No clinic" },
    ];
  } else {
    resourceColumns = [
      ...staffColumns,
      { id: "unassigned", kind: "unassigned", label: "Unassigned", subtitle: "No staff column" },
    ];
  }

  return {
    assignees: userAssignees,
    staffDirectory: calendarStaff,
    clinics,
    rooms,
    resourceColumns,
    staffUserByStaffId,
    staffIdByUserId,
    roomDisplayById,
  };
}

function appendLegacyUserColumns(
  columns: OperationalCalendarResourceColumn[],
  input: {
    userAssignees: CrmShellUserPickerOption[];
    staffIdByUserId: Map<string, string>;
    bookings: FiBookingRow[];
    filterUserId?: string | null;
  }
): OperationalCalendarResourceColumn[] {
  const legacy = buildLegacyUserResourceColumns(input);
  if (!legacy.length) return columns;
  const unassigned = columns.find((c) => c.id === "unassigned");
  const withoutUnassigned = columns.filter((c) => c.id !== "unassigned");
  return [...withoutUnassigned, ...legacy, ...(unassigned ? [unassigned] : [])];
}

function applyStructuredFilters(
  rows: FiBookingRow[],
  q: ParsedCalendarQuery,
  staffUserByStaffId: Map<string, string | null>,
  staffIdByUserId: Map<string, string>,
  staffDirectory: ClinicalStaffPickerOption[]
): FiBookingRow[] {
  const roleBucketIds =
    q.staffRoleBucket && !q.staffId?.trim() ? staffIdsMatchingRoleBucket(staffDirectory, q.staffRoleBucket) : null;

  return rows.filter((b) => {
    if (q.status?.trim()) {
      if (b.booking_status !== q.status.trim()) return false;
    } else if (!q.includeCancelled && b.booking_status === "cancelled") {
      return false;
    }
    if (q.bookingType?.trim() && b.booking_type !== q.bookingType.trim()) return false;
    if (q.staffId?.trim()) {
      const sid = q.staffId.trim();
      const uid = staffUserByStaffId.get(sid) ?? null;
      if (b.assigned_staff_id?.trim() === sid) return true;
      if (!b.assigned_staff_id?.trim() && uid && b.assigned_user_id?.trim() === uid) return true;
      return false;
    }
    if (roleBucketIds) {
      if (roleBucketIds.size === 0) return false;
      const sid = b.assigned_staff_id?.trim();
      if (sid) {
        if (!roleBucketIds.has(sid)) return false;
      } else {
        const uid = b.assigned_user_id?.trim();
        if (!uid) return false;
        let ok = false;
        for (const staffId of Array.from(roleBucketIds)) {
          if ((staffUserByStaffId.get(staffId) ?? "").trim() === uid) {
            ok = true;
            break;
          }
        }
        if (!ok) return false;
      }
    }
    if (q.assignedUserId?.trim()) {
      const uid = q.assignedUserId.trim();
      if (b.assigned_user_id?.trim() === uid) return true;
      const linkedStaffId = staffIdByUserId.get(uid);
      if (linkedStaffId && b.assigned_staff_id?.trim() === linkedStaffId) return true;
      return false;
    }
    if (q.clinicId?.trim() && b.clinic_id !== q.clinicId.trim()) return false;
    if (q.roomId?.trim() && b.room_id !== q.roomId.trim()) return false;
    if (q.waitingOnly) {
      const st = b.booking_status.trim();
      if (st !== "scheduled" && st !== "confirmed") return false;
    }
    if (q.unassignedOnly) {
      if (b.assigned_staff_id?.trim() || b.assigned_user_id?.trim()) return false;
    }
    return true;
  });
}

function staffIdsMatchingRoleBucket(
  staffDirectory: ClinicalStaffPickerOption[],
  bucket: "doctor" | "nurse"
): Set<string> {
  const out = new Set<string>();
  for (const s of staffDirectory) {
    const r = (s.staff_role ?? "").toLowerCase();
    if (bucket === "doctor") {
      if (
        /\b(doctor|physician|surgeon|consultant|dermatologist|gp)\b/.test(r) ||
        r.includes("doctor") ||
        r.includes("surgeon") ||
        r.includes("physician")
      ) {
        out.add(s.id);
      }
    } else if (/\b(nurse|rn|en)\b/.test(r) || r.includes("nurse")) {
      out.add(s.id);
    }
  }
  return out;
}

function humanizeBookingType(type: string): string {
  const t = type.trim();
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function staffHasConfiguredHours(staffDirectory: CrmShellUserPickerOption[]): boolean {
  for (const s of staffDirectory) {
    const summary = formatStaffWeeklyHoursSummary(parseStaffWeeklyHours(s.working_hours ?? undefined)).trim();
    if (summary) return true;
  }
  return false;
}

function buildSetupRecommendations(input: {
  servicesCount: number;
  staffDirectory: ClinicalStaffPickerOption[];
  timezoneConfigured: boolean;
}): string[] {
  const out: string[] = [];
  if (input.servicesCount === 0) {
    out.push("Add services in Settings for procedure colours and catalog defaults.");
  }
  if (input.staffDirectory.length === 0) {
    out.push("Add staff members so appointments can be assigned to provider columns.");
  } else if (!staffHasConfiguredHours(input.staffDirectory)) {
    out.push("Configure staff working hours for availability guidance (bookings still save).");
  }
  if (!input.timezoneConfigured) {
    out.push("Set the clinic timezone in tenant settings for accurate slot times.");
  }
  return out;
}

async function resolveBookingMutationGate(tenantId: string): Promise<{
  canMutateBookings: boolean;
  bookingMutationBlockedReason: string | null;
}> {
  const access = await resolveDevelopmentClinicAccessForTenant(tenantId);
  return {
    canMutateBookings: access.allowed,
    bookingMutationBlockedReason: access.blockedReason,
  };
}

async function measureAsync<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const result = await fn();
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  return [result, Math.round(t1 - t0)];
}

async function loadCalendarOperatorPrimaryClinicId(
  tenantId: string,
  staffDirectory: ClinicalStaffPickerOption[]
): Promise<string | null> {
  const authId = await resolveAuthUserId(null);
  if (!authId) return null;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authId.trim())
    .maybeSingle();
  if (error || !data) return null;
  const fiUserId = String((data as { id: string }).id).trim();
  const staff = staffDirectory.find((s) => (s.fi_user_id?.trim() ?? "") === fiUserId);
  if (!staff?.working_hours) return null;
  const cid = parseStaffProfileExtras(staff.working_hours).primary_clinic_id;
  return cid?.trim() || null;
}

/**
 * Fast path: tenant settings, directory, services, and layout metadata — no booking overlap query.
 * Used by FI OS calendar streaming so toolbar / filters can render before appointments resolve.
 */
export async function loadOperationalCalendarShellData(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>,
  opts?: { route?: CalendarRoute }
): Promise<OperationalCalendarPageData> {
  const route = opts?.route ?? "fi-admin";
  const tid = tenantId.trim();
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const calendarSettings = await loadTenantCalendarSettingsCached(tid);
  const parsed = parseCalendarSearchParams(searchParams, new Date(), {
    calendarTimezone: calendarSettings.calendarTimezone,
  });
  let query = parsed;
  const lanes = buildCalendarLanesForView(query.view, query.dateAnchor, query.calendarTimezone);
  const { rangeStartIso, rangeEndIso } = calendarRangeIsoForQuery(query);

  const [resources, mutationGate, services, tenantMetaRow] = await Promise.all([
    loadTenantStaffAndResourcesCached(tid, query.resourceView, query.clinicId?.trim() || null),
    resolveBookingMutationGateCached(tid),
    loadFiServicesForTenantCached(tid),
    loadTenantConfigRowCached(tid),
  ]);

  const cfg = tenantMetaRow?.config_json;
  const tenantMetadata =
    cfg != null && typeof cfg === "object" && !Array.isArray(cfg) ? (cfg as Record<string, unknown>) : null;

  const normalized = normalizeCalendarStaffFilter(query, resources.staffIdByUserId);
  query = normalized.query;
  const canonicalRedirectHref = normalized.shouldCanonicalizeToStaffId
    ? buildCalendarHref(tid, mergeCalendarHrefQuery(query, {}), { route })
    : null;

  const resourceColumns =
    query.resourceView === "staff"
      ? appendLegacyUserColumns(resources.resourceColumns, {
          userAssignees: resources.assignees,
          staffIdByUserId: resources.staffIdByUserId,
          bookings: [],
          filterUserId: parsed.assignedUserId,
        })
      : resources.resourceColumns;
  const { canMutateBookings, bookingMutationBlockedReason } = mutationGate;
  const gridConfig = calendarSettings.gridConfig;

  const buckets: Record<string, FiBookingRow[]> = {};
  for (const lane of lanes) {
    buckets[lane.dayKey] = [];
  }

  const rangeTitle = formatCalendarRangeTitle(query.view, lanes, query.calendarTimezone);

  const setupRecommendations = buildSetupRecommendations({
    servicesCount: services.length,
    staffDirectory: resources.staffDirectory,
    timezoneConfigured: calendarSettings.timezoneConfigured,
  });

  const calendarOperatorPrimaryClinicId = await loadCalendarOperatorPrimaryClinicId(tid, resources.staffDirectory);

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  logOperationalCalendarServerTiming({
    phase: "loadOperationalCalendarShellData",
    durationMs: Math.round(t1 - t0),
    view: query.view,
    dateAnchor: query.dateAnchor,
    rangeStartIso,
    rangeEndIso,
  });

  return {
    tenantId: tid,
    tenantMetadata,
    query,
    calendarTimezone: query.calendarTimezone,
    rangeStartIso,
    rangeEndIso,
    rangeTitle,
    lanes,
    buckets,
    bookings: [],
    bookingDisplay: {},
    assignees: resources.assignees,
    staffDirectory: resources.staffDirectory,
    clinics: resources.clinics,
    rooms: resources.rooms,
    roomDisplayById: resources.roomDisplayById,
    resourceColumns,
    gridConfig,
    listTruncated: false,
    canMutateBookings,
    bookingMutationBlockedReason,
    reminderJobsByBookingId: {},
    services,
    setupRecommendations,
    canonicalRedirectHref,
    calendarOperatorPrimaryClinicId,
  };
}

/**
 * Booking overlap + enrichment. Dedupes directory/services queries with {@link loadOperationalCalendarShellData}
 * via React `cache()` for the same navigation request.
 */
export async function loadOperationalCalendarGridData(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>,
  opts?: { route?: CalendarRoute }
): Promise<OperationalCalendarGridPatch> {
  void opts;
  const tid = tenantId.trim();
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const calendarSettings = await loadTenantCalendarSettingsCached(tid);
  const parsed = parseCalendarSearchParams(searchParams, new Date(), {
    calendarTimezone: calendarSettings.calendarTimezone,
  });
  let query = parsed;
  const lanes = buildCalendarLanesForView(query.view, query.dateAnchor, query.calendarTimezone);
  const { rangeStartIso, rangeEndIso } = calendarRangeIsoForQuery(query);
  const monthSummaryMode = operationalCalendarSkipsHeavyEnrichment(query.view);

  const tOverlapStart = typeof performance !== "undefined" ? performance.now() : Date.now();

  const bookingsPromise = measureAsync(() =>
    loadBookingsForCalendarOverlap({
      tenantId: tid,
      rangeStartIso,
      rangeEndIso,
      status: query.status,
      bookingType: query.bookingType,
      assignedUserId: query.assignedUserId,
      assignedStaffId: query.staffId,
      clinicId: query.clinicId,
      roomId: query.roomId,
      includeCancelled: query.includeCancelled,
      limit: CALENDAR_VIEW_BOOKINGS_LIMIT,
    })
  );
  const calendarEventsPromise = measureAsync(() =>
    loadFiCalendarEventsForOverlap({
      tenantId: tid,
      rangeStartIso,
      rangeEndIso,
      limit: CALENDAR_VIEW_BOOKINGS_LIMIT,
    })
  );
  const resourcesPromise = loadTenantStaffAndResourcesCached(
    tid,
    query.resourceView,
    query.clinicId?.trim() || null
  );
  const servicesPromise = loadFiServicesForTenantCached(tid);
  const providerLinksPromise = measureAsync(() => loadActiveStaffCalendarLinkIndex(tid));

  logOperationalCalendarServerTiming({
    phase: "loadOperationalCalendarGridData.criticalOverlap.start",
    view: query.view,
    dateAnchor: query.dateAnchor,
    rangeStartIso,
    rangeEndIso,
  });

  const [
    [rawBookings, subMs_fiBookings],
    [calendarOsEventRows, subMs_fiCalendarEvents],
    resources,
  ] = await Promise.all([bookingsPromise, calendarEventsPromise, resourcesPromise]);

  const tCriticalOverlapEnd = typeof performance !== "undefined" ? performance.now() : Date.now();
  logOperationalCalendarServerTiming({
    phase: "loadOperationalCalendarGridData.criticalOverlap.end",
    durationMs: Math.round(tCriticalOverlapEnd - tOverlapStart),
    subMs_fiBookings,
    subMs_fiCalendarEvents,
    view: query.view,
    dateAnchor: query.dateAnchor,
  });

  /** True when Postgres returned a full cap page — more rows may exist in the visible range. */
  const hitOverlapDbCap = rawBookings.length >= CALENDAR_VIEW_BOOKINGS_LIMIT;

  const normalized = normalizeCalendarStaffFilter(query, resources.staffIdByUserId);
  query = normalized.query;

  const resourceColumns =
    query.resourceView === "staff"
      ? appendLegacyUserColumns(resources.resourceColumns, {
          userAssignees: resources.assignees,
          staffIdByUserId: resources.staffIdByUserId,
          bookings: rawBookings,
          filterUserId: parsed.assignedUserId,
        })
      : resources.resourceColumns;

  const structuredBookings = applyStructuredFilters(
    rawBookings,
    query,
    resources.staffUserByStaffId,
    resources.staffIdByUserId,
    resources.staffDirectory
  );

  const displayContextInput = monthSummaryMode
    ? structuredBookings
    : [...structuredBookings, ...calendarOsOverlapRowsForDisplayContext(calendarOsEventRows)];

  const emptyDisplayMaps: BookingDisplayContextMaps = {
    patients: new Map(),
    leads: new Map(),
    persons: new Map(),
  };

  const assignmentMapPromise: Promise<Map<string, FiBookingResourceAssignmentRow[]>> = monthSummaryMode
    ? Promise.resolve(new Map())
    : loadBookingResourceAssignmentsForBookings({
        tenantId: tid,
        bookingIds: structuredBookings.map((b) => b.id),
      });

  logOperationalCalendarServerTiming({
    phase: "loadOperationalCalendarGridData.displayEnrichment.start",
    view: query.view,
    dateAnchor: query.dateAnchor,
    monthSummaryMode,
  });

  const tEnrichStart = typeof performance !== "undefined" ? performance.now() : Date.now();
  const [displayMaps, clinicalMap, assignmentMap, clinicalStaffingByBooking] = await Promise.all([
    monthSummaryMode
      ? Promise.resolve(emptyDisplayMaps)
      : loadBookingDisplayContextMaps(tid, displayContextInput),
    monthSummaryMode
      ? Promise.resolve(new Map<string, ClinicalLite>())
      : loadClinicalDetailsMap(
          tid,
          structuredBookings.map((b) => b.patient_id).filter((x): x is string => Boolean(x?.trim()))
        ),
    assignmentMapPromise,
    monthSummaryMode
      ? Promise.resolve(new Map())
      : loadClinicalStaffingSummariesForBookings(tid, structuredBookings, {
          syncExistingStaff: true,
          preloadedResourceAssignments: assignmentMapPromise,
        }),
  ]);
  const tEnrichEnd = typeof performance !== "undefined" ? performance.now() : Date.now();
  logOperationalCalendarServerTiming({
    phase: "loadOperationalCalendarGridData.displayEnrichment.end",
    durationMs: Math.round(tEnrichEnd - tEnrichStart),
    subMs_displayEnrichment: Math.round(tEnrichEnd - tEnrichStart),
    view: query.view,
    dateAnchor: query.dateAnchor,
    monthSummaryMode,
  });

  const tMappingDepsStart = typeof performance !== "undefined" ? performance.now() : Date.now();
  const [services, [staffCalendarLinkIndex, subMs_providerLinks]] = await Promise.all([
    servicesPromise,
    providerLinksPromise,
  ]);
  const tMappingDepsEnd = typeof performance !== "undefined" ? performance.now() : Date.now();

  const tMapStart = typeof performance !== "undefined" ? performance.now() : Date.now();
  const calendarOsMapped = mapFiCalendarEventsToOperationalCalendar(calendarOsEventRows, {
    tenantId: tid,
    calendarTimezone: query.calendarTimezone,
    displayMaps: monthSummaryMode
      ? { patients: new Map(), leads: new Map(), persons: new Map() }
      : displayMaps,
    services,
    staffCalendarLinks: staffCalendarLinkIndex,
  });
  const tMapEnd = typeof performance !== "undefined" ? performance.now() : Date.now();

  const structuredCalendarOs = applyStructuredFilters(
    calendarOsMapped.bookings,
    query,
    resources.staffUserByStaffId,
    resources.staffIdByUserId,
    resources.staffDirectory
  );
  const structured = [...structuredBookings, ...structuredCalendarOs];

  const staffNameById: Record<string, string> = {};
  for (const s of resources.staffDirectory) {
    staffNameById[s.id] = s.full_name?.trim() || s.email?.trim() || s.id.slice(0, 8);
  }

  const bookingDisplay: Record<string, OperationalCalendarBookingDisplay> = {};
  for (const row of structuredCalendarOs) {
    const d = calendarOsMapped.bookingDisplay[row.id];
    if (d) bookingDisplay[row.id] = d;
  }
  for (const row of structuredBookings) {
    const startMs = Date.parse(row.start_at);
    const endMs = Date.parse(row.end_at);
    const durationMin =
      Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.max(1, Math.round((endMs - startMs) / 60000)) : 30;

    const clin = row.patient_id?.trim() ? clinicalMap.get(row.patient_id.trim()) : undefined;
    const scalesSummary = clin
      ? formatClinicalScalesSummary({
          norwood_scale: clin.norwood_scale,
          ludwig_scale: clin.ludwig_scale,
          hairline_pattern: clin.hairline_pattern,
          primary_concern: clin.primary_concern,
        })
      : null;

    const cat = serviceForBookingType(services, row.booking_type);
    const contact = monthSummaryMode ? null : patientContactForBookingRow(row, displayMaps);
    const resourceLines = monthSummaryMode
      ? { roomLine: null, teamLine: null }
      : buildBookingResourceSummaryLines({
          booking: row,
          assignments: assignmentMap.get(row.id) ?? [],
          roomLabelById: resources.roomDisplayById,
          staffNameById,
        });
    bookingDisplay[row.id] = {
      anchorLabel: monthSummaryMode
        ? optimisticBookingAnchorLabel(row)
        : anchorLabelForBookingRow(row, displayMaps),
      scalesSummary,
      durationMin,
      reminderHint: null,
      procedureCatalogName: cat?.name ?? null,
      procedureCatalogHex: cat?.color ?? null,
      suggestedPrice: cat != null ? cat.base_price : null,
      patientEmail: contact?.email ?? null,
      patientPhone: contact?.phone ?? null,
      roomLabel: monthSummaryMode
        ? null
        : (row.room_id?.trim() ? resources.roomDisplayById[row.room_id.trim()] : null) ??
          row.location?.trim() ??
          null,
      resourceRoomLine: resourceLines.roomLine,
      resourceTeamLine: resourceLines.teamLine,
      clinicalStaffing: clinicalStaffingByBooking.get(row.id) ?? null,
    };
  }

  const searchNeedle = query.search?.trim().toLowerCase() ?? "";
  const searched = searchNeedle
    ? structured.filter((b) => {
        const d = bookingDisplay[b.id];
        const hay = [
          d?.anchorLabel ?? "",
          b.title ?? "",
          humanizeBookingType(b.booking_type),
          b.booking_status,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(searchNeedle);
      })
    : structured;

  searched.sort((a, b) => a.start_at.localeCompare(b.start_at));

  const listTruncated = hitOverlapDbCap;
  const bookings = searched.slice(0, CALENDAR_VIEW_BOOKINGS_LIMIT);

  const tBucketStart = typeof performance !== "undefined" ? performance.now() : Date.now();
  const bucketsMap = bucketBookingsIntoCalendar(bookings, lanes);
  const buckets: Record<string, FiBookingRow[]> = {};
  for (const lane of lanes) {
    buckets[lane.dayKey] = bucketsMap.get(lane.dayKey) ?? [];
  }
  const tBucketEnd = typeof performance !== "undefined" ? performance.now() : Date.now();

  const rangeTitle = formatCalendarRangeTitle(query.view, lanes, query.calendarTimezone);

  const patch: OperationalCalendarGridPatch = {
    bookings,
    bookingDisplay,
    buckets,
    reminderJobsByBookingId: {},
    listTruncated,
    resourceColumns,
    rangeTitle,
  };

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  logOperationalCalendarServerTiming({
    phase: "loadOperationalCalendarGridData",
    durationMs: Math.round(t1 - t0),
    subMs_overlapBundle: Math.round(tCriticalOverlapEnd - tOverlapStart),
    subMs_mappingDepsWait: Math.round(tMappingDepsEnd - tMappingDepsStart),
    subMs_fiBookings,
    subMs_fiCalendarEvents,
    subMs_providerLinks,
    subMs_displayEnrichment: Math.round(tEnrichEnd - tEnrichStart),
    subMs_calendarOsMapping: Math.round(tMapEnd - tMapStart),
    subMs_mergeBucketGrouping: Math.round(tBucketEnd - tBucketStart),
    view: query.view,
    dateAnchor: query.dateAnchor,
    rangeStartIso,
    rangeEndIso,
    rawBookingCount: rawBookings.length,
    rawCalendarOsEventCount: calendarOsEventRows.length,
    providerLinkCount: staffCalendarLinkIndex.size,
    filteredBookingCount: structured.length,
    returnedBookingCount: bookings.length,
    monthSummaryMode,
    hitOverlapDbCap,
    listTruncated,
  });

  if (process.env.NODE_ENV === "development") {
    const approxBytes = new TextEncoder().encode(JSON.stringify(patch)).length;
    logOperationalCalendarServerTiming({
      phase: "loadOperationalCalendarGridData.payloadBytes",
      approxBytes,
      returnedBookingCount: bookings.length,
    });
  }

  return patch;
}

/**
 * FI Admin operational calendar: loads overlapping bookings via {@link loadBookingsForCalendarOverlap}
 * (column subset + DB-level cap) instead of an unbounded `select("*")`, then applies URL filters.
 */
export async function loadOperationalCalendarPageData(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>,
  opts?: { route?: CalendarRoute }
): Promise<OperationalCalendarPageData> {
  const shell = await loadOperationalCalendarShellData(tenantId, searchParams, opts);
  if (shell.canonicalRedirectHref) return shell;
  const grid = await loadOperationalCalendarGridData(tenantId, searchParams, opts);
  return mergeOperationalCalendarShellAndGrid(shell, grid);
}
