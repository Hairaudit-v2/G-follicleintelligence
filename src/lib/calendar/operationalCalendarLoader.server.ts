import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadBookingsForTenantRange } from "@/src/lib/bookings/bookings";
import { formatCalendarRangeTitle } from "@/src/lib/bookings/calendarLabels";
import {
  bucketBookingsIntoCalendar,
  buildCalendarLanesForView,
} from "@/src/lib/bookings/calendarView";
import { calendarRangeIsoForQuery, parseCalendarSearchParams, type CalendarRoute, type ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import { buildCalendarHref, mergeCalendarHrefQuery } from "@/src/lib/bookings/calendarQuery";
import { CALENDAR_VIEW_BOOKINGS_LIMIT } from "@/src/lib/bookings/operatorBookingConstants";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";

import type {
  OperationalCalendarBookingDisplay,
  OperationalCalendarPageData,
  OperationalCalendarResourceColumn,
} from "@/src/lib/calendar/operationalCalendarTypes";

export type {
  OperationalCalendarBookingDisplay,
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
import { loadReminderJobsForBookings } from "@/src/lib/reminders/reminderJobs.server";
import { formatNextReminderHint } from "@/src/lib/reminders/remindersCore";
import type { FiReminderJobWithTemplate } from "@/src/lib/reminders/reminderTypes";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";
import { serviceForBookingType } from "@/src/lib/bookings/servicesCatalog";
import { loadClinicRoomsForTenant } from "@/src/lib/rooms/fiClinicRooms.server";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import { isCalendarVisibleClinicalStaff } from "@/src/lib/staff/calendarVisibleStaff";
import {
  anchorLabelForBookingRow,
  patientContactForBookingRow,
} from "@/src/lib/bookings/bookingDisplayContext";
import { loadBookingDisplayContextMaps } from "@/src/lib/bookings/bookingDisplayContext.server";
import {
  buildBookingResourceSummaryLines,
  loadBookingResourceAssignmentsForBookings,
} from "@/src/lib/calendar/bookingResourceRequirements.server";

type ClinicalLite = {
  norwood_scale: string | null;
  ludwig_scale: string | null;
  hairline_pattern: string | null;
  primary_concern: string | null;
};

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
 * FI Admin operational calendar: uses {@link loadBookingsForTenantRange} for the same overlap
 * semantics as the tenant dashboard agenda, then applies URL filters + a hard row cap.
 */
export async function loadOperationalCalendarPageData(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>,
  opts?: { route?: CalendarRoute }
): Promise<OperationalCalendarPageData> {
  const route = opts?.route ?? "fi-admin";
  const tid = tenantId.trim();
  const calendarSettings = await loadTenantOperationalCalendarSettings(tid);
  const parsed = parseCalendarSearchParams(searchParams, new Date(), {
    calendarTimezone: calendarSettings.calendarTimezone,
  });
  /**
   * Always trust {@link parseCalendarSearchParams} for `view`. Week is the default when `view`
   * is omitted from the URL ({@link buildCalendarHref} does not emit `view=` for week); forcing
   * `day` here broke Week links because they intentionally omit the param.
   */
  let query = parsed;
  const lanes = buildCalendarLanesForView(query.view, query.dateAnchor, query.calendarTimezone);
  const { rangeStartIso, rangeEndIso } = calendarRangeIsoForQuery(query);

  const [rawBookings, resources, mutationGate, services, tenantRow] = await Promise.all([
    loadBookingsForTenantRange(tid, rangeStartIso, rangeEndIso),
    loadTenantStaffAndClinics(tid, { resourceView: query.resourceView, clinicId: query.clinicId }),
    resolveBookingMutationGate(tid),
    loadFiServicesForTenant(tid),
    supabaseAdmin().from("fi_tenants").select("config_json").eq("id", tid).maybeSingle(),
  ]);

  const tenantMetaRow = tenantRow.data as { config_json?: unknown } | null;
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
          bookings: rawBookings,
          filterUserId: parsed.assignedUserId,
        })
      : resources.resourceColumns;
  const { canMutateBookings, bookingMutationBlockedReason } = mutationGate;
  const gridConfig = calendarSettings.gridConfig;

  const structured = applyStructuredFilters(
    rawBookings,
    query,
    resources.staffUserByStaffId,
    resources.staffIdByUserId,
    resources.staffDirectory
  );

  const [displayMaps, clinicalMap, assignmentMap] = await Promise.all([
    loadBookingDisplayContextMaps(tid, structured),
    loadClinicalDetailsMap(
      tid,
      structured.map((b) => b.patient_id).filter((x): x is string => Boolean(x?.trim()))
    ),
    loadBookingResourceAssignmentsForBookings({
      tenantId: tid,
      bookingIds: structured.map((b) => b.id),
    }),
  ]);

  const staffNameById: Record<string, string> = {};
  for (const s of resources.staffDirectory) {
    staffNameById[s.id] = s.full_name?.trim() || s.email?.trim() || s.id.slice(0, 8);
  }

  const bookingDisplay: Record<string, OperationalCalendarBookingDisplay> = {};
  for (const row of structured) {
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
    const contact = patientContactForBookingRow(row, displayMaps);
    const resourceLines = buildBookingResourceSummaryLines({
      booking: row,
      assignments: assignmentMap.get(row.id) ?? [],
      roomLabelById: resources.roomDisplayById,
      staffNameById,
    });
    bookingDisplay[row.id] = {
      anchorLabel: anchorLabelForBookingRow(row, displayMaps),
      scalesSummary,
      durationMin,
      reminderHint: null,
      procedureCatalogName: cat?.name ?? null,
      procedureCatalogHex: cat?.color ?? null,
      suggestedPrice: cat != null ? cat.base_price : null,
      patientEmail: contact.email,
      patientPhone: contact.phone,
      roomLabel:
        (row.room_id?.trim() ? resources.roomDisplayById[row.room_id.trim()] : null) ??
        row.location?.trim() ??
        null,
      resourceRoomLine: resourceLines.roomLine,
      resourceTeamLine: resourceLines.teamLine,
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

  const listTruncated = searched.length > CALENDAR_VIEW_BOOKINGS_LIMIT;
  const bookings = searched.slice(0, CALENDAR_VIEW_BOOKINGS_LIMIT);

  const reminderMap = await loadReminderJobsForBookings(
    tid,
    bookings.map((b) => b.id)
  );
  const reminderJobsByBookingId: Record<string, FiReminderJobWithTemplate[]> = {};
  for (const b of bookings) {
    const jobs = reminderMap.get(b.id) ?? [];
    reminderJobsByBookingId[b.id] = jobs;
    const hint = formatNextReminderHint(jobs, query.calendarTimezone);
    const prev = bookingDisplay[b.id];
    if (prev) {
      bookingDisplay[b.id] = { ...prev, reminderHint: hint };
    }
  }

  const bucketsMap = bucketBookingsIntoCalendar(bookings, lanes);
  const buckets: Record<string, FiBookingRow[]> = {};
  for (const lane of lanes) {
    buckets[lane.dayKey] = bucketsMap.get(lane.dayKey) ?? [];
  }

  const rangeTitle = formatCalendarRangeTitle(query.view, lanes, query.calendarTimezone);

  const setupRecommendations = buildSetupRecommendations({
    servicesCount: services.length,
    staffDirectory: resources.staffDirectory,
    timezoneConfigured: calendarSettings.timezoneConfigured,
  });

  const calendarOperatorPrimaryClinicId = await loadCalendarOperatorPrimaryClinicId(tid, resources.staffDirectory);

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
    bookings,
    bookingDisplay,
    assignees: resources.assignees,
    staffDirectory: resources.staffDirectory,
    clinics: resources.clinics,
    rooms: resources.rooms,
    roomDisplayById: resources.roomDisplayById,
    resourceColumns,
    gridConfig,
    listTruncated,
    canMutateBookings,
    bookingMutationBlockedReason,
    reminderJobsByBookingId,
    services,
    setupRecommendations,
    canonicalRedirectHref,
    calendarOperatorPrimaryClinicId,
  };
}
