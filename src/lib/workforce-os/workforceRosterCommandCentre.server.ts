import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  evaluateStaffProcedurePrivilegeForEvent,
  loadAllProcedurePrivilegeRequirementsForTenant,
} from "@/src/lib/academy-os/procedurePrivileges.server";
import { loadBookingsForOperatorView } from "@/src/lib/bookings/bookings";
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { parseStaffEmploymentStatus } from "@/src/lib/workforce-os/staffLifecycleCore";
import { loadAllStaffForTenant, type FiStaffRow } from "@/src/lib/staff/staff.server";
import { parseStaffProfileExtras } from "@/src/lib/staff/staffProfileExtras";
import { pickStaffHrNotificationFromSourceRows } from "@/src/lib/staff/staffHrNotificationSummary";
import { buildStaffComplianceSummaryFromSourceRows } from "@/src/lib/staffCompliance/staffComplianceSummary";
import type { ClinicalStaffingSummaryDto } from "@/src/lib/workforce-os/clinicalStaffingSummary.types";
import {
  buildWorkforceCandidateAssignments,
  getWorkforceEventWindow,
  isBookingActiveForStaffing,
  resolveWorkforceEventTypeFromBooking,
  type WorkforceClinicalEventSource,
} from "@/src/lib/workforce-os/workforceClinicalEventMapping";
import {
  loadClinicalStaffingSummariesForBookings,
  loadEventStaffingSummary,
} from "@/src/lib/workforce-os/workforceEventAssignmentBridge.server";
import {
  rankAssignableStaffForRole,
  type RosterAssignableCandidate,
} from "@/src/lib/workforce-os/workforceRosterCandidates";
import { loadWorkforceRosterPlanningPolicy } from "@/src/lib/workforce/rosterCadencePolicy.server";
import type { WorkforceRosterPlanningPolicy } from "@/src/lib/workforce/rosterCadencePolicyCore";
import {
  rosterDateRangeFromPeriodStart,
  resolveRosterPeriodStart,
} from "@/src/lib/workforce/rosterCadencePolicyCore";
import {
  rosterDisplayStatusMatchesFilter,
  type RosterStaffingStatusFilter,
} from "@/src/lib/workforce-os/workforceRosterQueryParams";
import type { WorkforceReadinessScoreInput } from "@/src/lib/workforce-os/workforceReadinessEngine";
import {
  detectStaffSchedulingConflicts,
  type StaffAvailabilityBlockRecord,
  type StaffShiftRecord,
} from "@/src/lib/workforce-os/workforceRosteringEngine";
import {
  type FiStaffAvailabilityBlockRow,
  type FiStaffEventAssignmentRow,
  type FiStaffShiftRow,
} from "@/src/lib/workforce-os/workforceRostering.server";
import { resolveTenantCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";
import { rosterAvailabilityLocalDateFromIso } from "@/src/lib/workforce-os/rosterCommandCentreUxCore";
import { loadActiveStandardHoursForTenant } from "@/src/lib/workforce-os/staffStandardHours.server";
import {
  listRosterEligibleStaffMissingStandardHours,
  loadRosterStaffEligibilityContext,
} from "@/src/lib/workforce-os/rosterEligibleStaff.server";
import {
  mondayOfWeekIso,
  weekDayIsoDates,
  type StaffStandardHoursDayInput,
} from "@/src/lib/workforce-os/staffStandardHoursCore";
import type { StandardHoursShiftSource } from "@/src/lib/workforce-os/staffStandardHoursCore";
import type { RosterIneligibleStaffOption } from "@/src/lib/workforce-os/rosterEligibleStaffCore";
import { filterRosterGridStaffOptions } from "@/src/lib/workforce-os/rosterEligibleStaffCore";

export type RosterCommandCentreDateRange = {
  startsAt: string;
  endsAt: string;
};

export type RosterCommandCentreClinicOption = {
  id: string;
  displayName: string;
};

export type RosterCommandCentreAssignmentRow = {
  assignmentId: string;
  staffId: string;
  staffName: string;
  assignedRole: string;
  assignmentStatus: string;
  readinessScore: number | null;
  readinessBand: string | null;
  warnings: string[];
};

export type RosterCommandCentreEvent = {
  eventKey: string;
  eventSource: WorkforceClinicalEventSource;
  eventId: string;
  eventType: string;
  title: string;
  startsAt: string;
  endsAt: string;
  clinicId: string | null;
  clinicName: string | null;
  bookingTypeLabel: string | null;
  staffing: ClinicalStaffingSummaryDto;
  assignments: RosterCommandCentreAssignmentRow[];
};

export type RosterCommandCentreSummaryMetrics = {
  totalClinicalEvents: number;
  readyEvents: number;
  missingRoleEvents: number;
  warningEvents: number;
  blockedEvents: number;
  noTemplateEvents: number;
  openRequiredRoles: number;
  eligibleStaffCount: number;
};

export type RosterGridShift = FiStaffShiftRow & {
  staffName: string;
  shift_source: StandardHoursShiftSource;
  /** Staff/tenant-local calendar day for grid cell placement. */
  localDate: string;
};

export type RosterGridAvailabilityCell = {
  blockId: string;
  staffId: string;
  staffName: string;
  blockType: string;
  label: string;
  startsAt: string;
  endsAt: string;
  localDate: string;
};

export type RosterCommandCentrePayload = {
  dateRange: RosterCommandCentreDateRange;
  periodStart: string;
  weekStart: string;
  periodDayDates: string[];
  /** @deprecated Prefer periodDayDates — kept for older roster view bundles. */
  weekDayDates: string[];
  rosterPlanning: WorkforceRosterPlanningPolicy;
  clinics: RosterCommandCentreClinicOption[];
  staffOptions: Array<{ id: string; name: string; role: string | null; isActive: boolean }>;
  /** Roster-eligible staff only — use for the operational grid rows. */
  rosterGridStaffOptions: Array<{
    id: string;
    name: string;
    role: string | null;
    isActive: boolean;
  }>;
  events: RosterCommandCentreEvent[];
  shifts: RosterGridShift[];
  availabilityBlocks: FiStaffAvailabilityBlockRow[];
  availabilityCells: RosterGridAvailabilityCell[];
  standardHoursByStaffId: Record<string, StaffStandardHoursDayInput[]>;
  eligibleStaffIds: string[];
  ineligibleStaffOptions: RosterIneligibleStaffOption[];
  staffMissingStandardHours: Array<{ id: string; name: string }>;
  summary: RosterCommandCentreSummaryMetrics;
  preselectedEventKey: string | null;
  tenantTimezone: string;
  staffTimezoneByStaffId: Record<string, string | null>;
};

export type LoadRosterCommandCentreInput = {
  tenantId: string;
  dateRange?: RosterCommandCentreDateRange;
  periodStart?: string | null;
  weekStart?: string | null;
  rosterPlanning?: WorkforceRosterPlanningPolicy;
  clinicId?: string | null;
  staffId?: string | null;
  eventType?: string | null;
  statusFilter?: RosterStaffingStatusFilter | null;
  preselectedEventKey?: string | null;
};

export type LoadRosterAssignableStaffInput = {
  tenantId: string;
  clinicId?: string | null;
  eventSource: WorkforceClinicalEventSource;
  eventId: string;
  eventType: string;
  assignedRole: string;
  startsAt: string;
  endsAt: string;
};

export type LoadRosterEventDetailInput = {
  tenantId: string;
  eventSource: WorkforceClinicalEventSource;
  eventId: string;
};

export type RosterEventDetailPayload = {
  event: RosterCommandCentreEvent | null;
  candidatesByRole: Record<string, RosterAssignableCandidate[]>;
};

function mapAvailabilityBlock(row: Record<string, unknown>): StaffAvailabilityBlockRecord {
  return {
    id: String(row.id),
    block_type: row.block_type as StaffAvailabilityBlockRecord["block_type"],
    starts_at: String(row.starts_at),
    ends_at: String(row.ends_at),
    status: row.status as StaffAvailabilityBlockRecord["status"],
    reason: row.reason != null ? String(row.reason) : null,
  };
}

function mapShift(row: Record<string, unknown>): StaffShiftRecord {
  return {
    id: String(row.id),
    shift_type: String(row.shift_type),
    starts_at: String(row.starts_at),
    ends_at: String(row.ends_at),
    status: row.status as StaffShiftRecord["status"],
  };
}

function mapShiftRow(row: Record<string, unknown>): FiStaffShiftRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    staff_id: String(row.staff_id),
    clinic_id: row.clinic_id != null ? String(row.clinic_id) : null,
    shift_type: String(row.shift_type),
    starts_at: String(row.starts_at),
    ends_at: String(row.ends_at),
    status: row.status as FiStaffShiftRow["status"],
    notes: row.notes != null ? String(row.notes) : null,
    shift_source: (row.shift_source as StandardHoursShiftSource | undefined) ?? "manual",
  };
}

function localDateFromIso(
  iso: string,
  staffTimezone: string | null | undefined,
  tenantTimezone: string
): string {
  return rosterAvailabilityLocalDateFromIso(iso, staffTimezone, tenantTimezone);
}

async function loadTenantCalendarTimezone(tenantId: string): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from("fi_tenant_settings")
    .select("default_timezone, metadata")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as {
    default_timezone?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
  return resolveTenantCalendarTimezone(row);
}

function mapAvailabilityBlockRow(row: Record<string, unknown>): FiStaffAvailabilityBlockRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    staff_id: String(row.staff_id),
    clinic_id: row.clinic_id != null ? String(row.clinic_id) : null,
    block_type: row.block_type as FiStaffAvailabilityBlockRow["block_type"],
    starts_at: String(row.starts_at),
    ends_at: String(row.ends_at),
    status: row.status as FiStaffAvailabilityBlockRow["status"],
    reason: row.reason != null ? String(row.reason) : null,
  };
}

function mapAssignmentRow(row: Record<string, unknown>): FiStaffEventAssignmentRow {
  const snapshot =
    row.eligibility_snapshot &&
    typeof row.eligibility_snapshot === "object" &&
    !Array.isArray(row.eligibility_snapshot)
      ? (row.eligibility_snapshot as Record<string, unknown>)
      : {};
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    clinic_id: row.clinic_id != null ? String(row.clinic_id) : null,
    event_source: String(row.event_source),
    event_id: row.event_id != null ? String(row.event_id) : null,
    staff_id: String(row.staff_id),
    assigned_role: String(row.assigned_role),
    assignment_status: row.assignment_status as FiStaffEventAssignmentRow["assignment_status"],
    starts_at:
      typeof snapshot.event_starts_at === "string"
        ? snapshot.event_starts_at
        : typeof snapshot.starts_at === "string"
          ? snapshot.starts_at
          : null,
    ends_at:
      typeof snapshot.event_ends_at === "string"
        ? snapshot.event_ends_at
        : typeof snapshot.ends_at === "string"
          ? snapshot.ends_at
          : null,
    readiness_score: row.readiness_score != null ? Number(row.readiness_score) : null,
    readiness_band: row.readiness_band != null ? String(row.readiness_band) : null,
    eligibility_snapshot: snapshot,
    warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
    blocking_issues: Array.isArray(row.blocking_issues) ? row.blocking_issues : [],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function loadClinicsForTenant(tenantId: string): Promise<RosterCommandCentreClinicOption[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_clinics")
    .select("id, display_name")
    .eq("tenant_id", tenantId)
    .order("display_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const r = row as { id: string; display_name: string | null };
    return { id: String(r.id), displayName: r.display_name?.trim() || "Clinic" };
  });
}

async function buildReadinessInputForStaff(
  tenantId: string,
  staff: FiStaffRow
): Promise<WorkforceReadinessScoreInput> {
  const supabase = supabaseAdmin();
  const [sourceRes, memberRes] = await Promise.all([
    supabase
      .from("fi_staff_source_ids")
      .select("source_system, source_staff_id, source_url, metadata")
      .eq("tenant_id", tenantId)
      .eq("staff_id", staff.id),
    supabase
      .from("fi_staff_members")
      .select("employment_status")
      .eq("tenant_id", tenantId)
      .eq("fi_staff_id", staff.id)
      .is("archived_at", null)
      .maybeSingle(),
  ]);
  if (sourceRes.error) throw new Error(sourceRes.error.message);
  if (memberRes.error) throw new Error(memberRes.error.message);

  const data = sourceRes.data;

  const srcRows = (data ?? []).map((r) => {
    const row = r as { source_system: string; source_url: string | null; metadata: unknown };
    return {
      source_system: String(row.source_system),
      source_url: row.source_url,
      metadata:
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null,
    };
  });

  const hr = pickStaffHrNotificationFromSourceRows(srcRows);
  const compliance = buildStaffComplianceSummaryFromSourceRows(
    srcRows.map((row) => ({ source_system: row.source_system, metadata: row.metadata })),
    { now: new Date() }
  );

  return {
    is_active: staff.is_active,
    employment_status: memberRes.data?.employment_status
      ? parseStaffEmploymentStatus(memberRes.data.employment_status)
      : null,
    staff_role: staff.staff_role,
    working_hours: staff.working_hours,
    hr,
    identityRows: srcRows.map((row) => ({
      source_system: row.source_system,
      source_staff_id: "",
      metadata: row.metadata,
    })),
    compliance,
  };
}

function bookingTitle(booking: FiBookingRow): string {
  return booking.title?.trim() || bookingTypeLabel(booking.booking_type) || "Clinical event";
}

function summarizeEvents(events: RosterCommandCentreEvent[]): RosterCommandCentreSummaryMetrics {
  let readyEvents = 0;
  let missingRoleEvents = 0;
  let warningEvents = 0;
  let blockedEvents = 0;
  let noTemplateEvents = 0;
  let openRequiredRoles = 0;

  for (const event of events) {
    const status = event.staffing.displayStatus;
    if (status === "ready") readyEvents += 1;
    if (status === "missing_roles") missingRoleEvents += 1;
    if (status === "warning") warningEvents += 1;
    if (status === "blocked") blockedEvents += 1;
    if (status === "not_configured") noTemplateEvents += 1;
    openRequiredRoles += (event.staffing.missingRoles ?? []).reduce(
      (sum, row) => sum + Math.max(0, row.required - row.assigned),
      0
    );
  }

  return {
    totalClinicalEvents: events.length,
    readyEvents,
    missingRoleEvents,
    warningEvents,
    blockedEvents,
    noTemplateEvents,
    openRequiredRoles,
    eligibleStaffCount: 0,
  };
}

async function loadAssignmentsForBookings(
  tenantId: string,
  bookingIds: string[]
): Promise<Map<string, FiStaffEventAssignmentRow[]>> {
  const out = new Map<string, FiStaffEventAssignmentRow[]>();
  if (!bookingIds.length) return out;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_event_assignments")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("event_source", "booking")
    .in("event_id", bookingIds);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const row = mapAssignmentRow(raw as Record<string, unknown>);
    const eid = row.event_id?.trim();
    if (!eid) continue;
    const list = out.get(eid) ?? [];
    list.push(row);
    out.set(eid, list);
  }
  return out;
}

function buildAssignmentRows(
  assignments: FiStaffEventAssignmentRow[],
  staffNameById: Map<string, string>
): RosterCommandCentreAssignmentRow[] {
  return assignments
    .filter((row) => row.assignment_status !== "cancelled")
    .map((row) => ({
      assignmentId: row.id,
      staffId: row.staff_id,
      staffName: staffNameById.get(row.staff_id) ?? row.staff_id.slice(0, 8),
      assignedRole: row.assigned_role,
      assignmentStatus: row.assignment_status,
      readinessScore: row.readiness_score,
      readinessBand: row.readiness_band,
      warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
    }));
}

async function buildBookingEvents(input: {
  tenantId: string;
  bookings: FiBookingRow[];
  clinicNameById: Map<string, string>;
  staffNameById: Map<string, string>;
  staffingByBooking: Map<string, ClinicalStaffingSummaryDto>;
  assignmentsByBooking: Map<string, FiStaffEventAssignmentRow[]>;
}): Promise<RosterCommandCentreEvent[]> {
  const events: RosterCommandCentreEvent[] = [];
  for (const booking of input.bookings) {
    if (!isBookingActiveForStaffing(booking)) continue;
    const eventType = resolveWorkforceEventTypeFromBooking(booking);
    const window = getWorkforceEventWindow(booking);
    const clinicId = booking.clinic_id?.trim() || null;
    events.push({
      eventKey: `booking:${booking.id}`,
      eventSource: "booking",
      eventId: booking.id,
      eventType,
      title: bookingTitle(booking),
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      clinicId,
      clinicName: clinicId ? (input.clinicNameById.get(clinicId) ?? null) : null,
      bookingTypeLabel: bookingTypeLabel(booking.booking_type),
      staffing: input.staffingByBooking.get(booking.id) ?? {
        displayStatus: "not_configured",
        templateConfigured: false,
        readinessScore: 0,
        ready: false,
        requiredRoles: {},
        assignedCounts: {},
        missingRoles: [],
        blockedAssignments: [],
        warnings: [],
      },
      assignments: buildAssignmentRows(
        input.assignmentsByBooking.get(booking.id) ?? [],
        input.staffNameById
      ),
    });
  }
  return events;
}

/** HR OS roster mutations — aligned with standard-hours manage gate. */
export async function assertHrOsRosterManageAllowed(
  tenantId: string
): Promise<{ fiUserId: string }> {
  const { assertStaffStandardHoursManageAllowed } =
    await import("@/src/lib/workforce-os/staffStandardHoursManageGate.server");
  return assertStaffStandardHoursManageAllowed(tenantId);
}

export async function loadRosterCommandCentre(
  input: LoadRosterCommandCentreInput
): Promise<RosterCommandCentrePayload> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const rosterPlanning = input.rosterPlanning ?? (await loadWorkforceRosterPlanningPolicy(tid));

  const periodStart =
    input.periodStart?.trim() ||
    input.weekStart?.trim() ||
    resolveRosterPeriodStart({
      refDateIso: new Date().toISOString().slice(0, 10),
      cadence: rosterPlanning.rosterCadence,
      weekStartDay: rosterPlanning.rosterWeekStartDay,
      rosterCycleAnchorDate: rosterPlanning.rosterCycleAnchorDate,
    });

  const fullRange = rosterDateRangeFromPeriodStart(
    periodStart,
    rosterPlanning.rosterCadence,
    rosterPlanning.rosterWeekStartDay
  );

  const dateRange = input.dateRange
    ? { startsAt: input.dateRange.startsAt, endsAt: input.dateRange.endsAt }
    : { startsAt: fullRange.startsAt, endsAt: fullRange.endsAt };
  const periodDayDates = fullRange.periodDayDates;
  const weekStart =
    rosterPlanning.rosterCadence === "monthly"
      ? mondayOfWeekIso(periodStart)
      : periodStart.slice(0, 10);
  const weekDayDates =
    rosterPlanning.rosterCadence === "weekly" ? weekDayIsoDates(weekStart) : periodDayDates;
  const clinicFilter = input.clinicId?.trim() || null;
  const staffFilter = input.staffId?.trim() || null;
  const eventTypeFilter = input.eventType?.trim().toLowerCase() || null;
  const statusFilter = input.statusFilter ?? null;

  const [
    clinics,
    staffRows,
    bookings,
    shiftsRes,
    blocksRes,
    eligibilityBlocksRes,
    standardHoursMap,
    tenantTimezone,
  ] = await Promise.all([
    loadClinicsForTenant(tid),
    loadAllStaffForTenant(tid),
    loadBookingsForOperatorView({
      tenantId: tid,
      rangeStartIso: dateRange.startsAt,
      rangeEndIso: dateRange.endsAt,
      clinicId: clinicFilter ?? undefined,
      limit: 480,
    }),
    supabaseAdmin()
      .from("fi_staff_shifts")
      .select("*")
      .eq("tenant_id", tid)
      .neq("status", "cancelled")
      .gte("starts_at", dateRange.startsAt)
      .lt("starts_at", dateRange.endsAt)
      .order("starts_at", { ascending: true })
      .limit(500),
    supabaseAdmin()
      .from("fi_staff_availability_blocks")
      .select("*")
      .eq("tenant_id", tid)
      .eq("status", "active")
      .lte("starts_at", dateRange.endsAt)
      .gte("ends_at", dateRange.startsAt)
      .order("starts_at", { ascending: true })
      .limit(500),
    supabaseAdmin()
      .from("fi_staff_availability_blocks")
      .select("staff_id, block_type, starts_at, ends_at, status")
      .eq("tenant_id", tid)
      .eq("status", "active")
      .lte("starts_at", dateRange.endsAt)
      .gte("ends_at", dateRange.startsAt)
      .limit(1000),
    loadActiveStandardHoursForTenant(tid),
    loadTenantCalendarTimezone(tid),
  ]);

  if (shiftsRes.error) throw new Error(shiftsRes.error.message);
  if (blocksRes.error) throw new Error(blocksRes.error.message);
  if (eligibilityBlocksRes.error) throw new Error(eligibilityBlocksRes.error.message);

  const activeBookings = bookings.filter(isBookingActiveForStaffing);
  const staffingByBooking = await loadClinicalStaffingSummariesForBookings(tid, activeBookings, {
    syncExistingStaff: false,
    allowBlockedDraft: true,
  });
  const assignmentsByBooking = await loadAssignmentsForBookings(
    tid,
    activeBookings.map((b) => b.id)
  );

  const clinicNameById = new Map(clinics.map((c) => [c.id, c.displayName]));
  const staffNameById = new Map(staffRows.map((s) => [s.id, s.full_name?.trim() || "Staff"]));
  const staffTimezoneById = new Map(
    staffRows.map((s) => [s.id, s.default_timezone?.trim() || null])
  );

  let staffOptions = staffRows.map((s) => ({
    id: s.id,
    name: s.full_name?.trim() || "Staff",
    role: s.staff_role,
    isActive: s.is_active,
  }));
  if (staffFilter) {
    staffOptions = staffOptions.filter((s) => s.id === staffFilter);
  }

  let shiftRows = (shiftsRes.data ?? []).map((row) => mapShiftRow(row as Record<string, unknown>));
  if (staffFilter) {
    shiftRows = shiftRows.filter((s) => s.staff_id === staffFilter);
  }

  const shifts: RosterGridShift[] = shiftRows.map((shift) => ({
    ...shift,
    staffName: staffNameById.get(shift.staff_id) ?? "Staff",
    shift_source: shift.shift_source ?? "manual",
    localDate: localDateFromIso(
      shift.starts_at,
      staffTimezoneById.get(shift.staff_id),
      tenantTimezone
    ),
  }));

  let blockRows = (blocksRes.data ?? []).map((row) =>
    mapAvailabilityBlockRow(row as Record<string, unknown>)
  );
  if (staffFilter) {
    blockRows = blockRows.filter((b) => b.staff_id === staffFilter);
  }

  const availabilityCells: RosterGridAvailabilityCell[] = blockRows.map((block) => ({
    blockId: block.id,
    staffId: block.staff_id,
    staffName: staffNameById.get(block.staff_id) ?? "Staff",
    blockType: block.block_type,
    label:
      block.block_type === "leave" || block.block_type === "sick_leave"
        ? "Leave"
        : block.block_type === "maternity_leave"
          ? "Maternity leave"
          : block.block_type === "unavailable"
            ? "Unavailable"
            : block.block_type.replace(/_/g, " "),
    startsAt: block.starts_at,
    endsAt: block.ends_at,
    localDate: localDateFromIso(
      block.starts_at,
      staffTimezoneById.get(block.staff_id),
      tenantTimezone
    ),
  }));

  const standardHoursByStaffId: Record<string, StaffStandardHoursDayInput[]> = {};
  for (const [staffId, days] of standardHoursMap.entries()) {
    standardHoursByStaffId[staffId] = days;
  }

  let events = await buildBookingEvents({
    tenantId: tid,
    bookings: activeBookings,
    clinicNameById,
    staffNameById,
    staffingByBooking,
    assignmentsByBooking,
  });

  if (eventTypeFilter) {
    events = events.filter((event) => event.eventType === eventTypeFilter);
  }
  if (statusFilter) {
    events = events.filter((event) =>
      rosterDisplayStatusMatchesFilter(event.staffing.displayStatus, statusFilter)
    );
  }

  events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const eligibilityContext = await loadRosterStaffEligibilityContext(tid, {
    periodDayDates,
    availabilityBlocks: (eligibilityBlocksRes.data ?? []).map((row) => ({
      staff_id: String((row as Record<string, unknown>).staff_id),
      block_type: String((row as Record<string, unknown>).block_type),
      starts_at: String((row as Record<string, unknown>).starts_at),
      ends_at: String((row as Record<string, unknown>).ends_at),
      status: (row as Record<string, unknown>).status as string | null | undefined,
    })),
    staffRows,
  });

  const staffMissingStandardHours = listRosterEligibleStaffMissingStandardHours({
    staffOptions: filterRosterGridStaffOptions(
      staffOptions,
      eligibilityContext.eligibleStaffIds
    ).map((staff) => ({ id: staff.id, name: staff.name })),
    standardHoursByStaffId,
    eligibleStaffIds: eligibilityContext.eligibleStaffIds,
  });

  const rosterGridStaffOptions = filterRosterGridStaffOptions(
    staffOptions,
    eligibilityContext.eligibleStaffIds
  );

  const summary = summarizeEvents(events);
  summary.eligibleStaffCount = eligibilityContext.eligibleStaffIds.length;

  return {
    dateRange,
    periodStart: periodStart.slice(0, 10),
    weekStart,
    periodDayDates: weekDayDates,
    weekDayDates,
    rosterPlanning,
    clinics,
    staffOptions,
    rosterGridStaffOptions,
    events,
    shifts,
    availabilityBlocks: blockRows,
    availabilityCells,
    standardHoursByStaffId,
    eligibleStaffIds: eligibilityContext.eligibleStaffIds,
    ineligibleStaffOptions: eligibilityContext.ineligibleStaffOptions,
    staffMissingStandardHours,
    summary,
    preselectedEventKey: input.preselectedEventKey?.trim() || null,
    tenantTimezone,
    staffTimezoneByStaffId: Object.fromEntries(staffTimezoneById.entries()),
  };
}

export async function loadRosterEventDetail(
  input: LoadRosterEventDetailInput
): Promise<RosterEventDetailPayload> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const eventId = assertNonEmptyUuid(input.eventId, "eventId");
  const eventSource = input.eventSource;

  if (eventSource === "booking") {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("fi_bookings")
      .select("*")
      .eq("tenant_id", tid)
      .eq("id", eventId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { event: null, candidatesByRole: {} };

    const booking = data as FiBookingRow;
    const [clinics, staffRows, staffing, assignmentsByBooking] = await Promise.all([
      loadClinicsForTenant(tid),
      loadAllStaffForTenant(tid),
      loadEventStaffingSummary({
        tenantId: tid,
        eventSource: "booking",
        eventId: booking.id,
        eventType: resolveWorkforceEventTypeFromBooking(booking),
        clinicId: booking.clinic_id,
        startsAt: booking.start_at,
        endsAt: booking.end_at,
        candidateStaffIds: [],
        syncExistingStaff: true,
        booking,
        allowBlockedDraft: true,
      }),
      loadAssignmentsForBookings(tid, [booking.id]),
    ]);

    const clinicNameById = new Map(clinics.map((c) => [c.id, c.displayName]));
    const staffNameById = new Map(staffRows.map((s) => [s.id, s.full_name?.trim() || "Staff"]));
    const [event] = await buildBookingEvents({
      tenantId: tid,
      bookings: [booking],
      clinicNameById,
      staffNameById,
      staffingByBooking: new Map([[booking.id, staffing]]),
      assignmentsByBooking,
    });

    const candidatesByRole: Record<string, RosterAssignableCandidate[]> = {};
    for (const missing of staffing.missingRoles ?? []) {
      const needed = Math.max(0, missing.required - missing.assigned);
      if (needed <= 0) continue;
      candidatesByRole[missing.role] = await loadRosterAssignableStaff({
        tenantId: tid,
        clinicId: booking.clinic_id,
        eventSource: "booking",
        eventId: booking.id,
        eventType: resolveWorkforceEventTypeFromBooking(booking),
        assignedRole: missing.role,
        startsAt: booking.start_at,
        endsAt: booking.end_at,
      });
    }

    return { event: event ?? null, candidatesByRole };
  }

  return { event: null, candidatesByRole: {} };
}

export async function loadRosterAssignableStaff(
  input: LoadRosterAssignableStaffInput
): Promise<RosterAssignableCandidate[]> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const staffRows = await loadAllStaffForTenant(tid);
  const supabase = supabaseAdmin();

  const { data: assignmentRows, error: assignmentErr } = await supabase
    .from("fi_staff_event_assignments")
    .select("*")
    .eq("tenant_id", tid)
    .eq("event_source", input.eventSource)
    .eq("event_id", input.eventId);
  if (assignmentErr) throw new Error(assignmentErr.message);

  const existingAssignments = (assignmentRows ?? [])
    .map((row) => mapAssignmentRow(row as Record<string, unknown>))
    .filter((row) => row.assignment_status !== "cancelled")
    .map((row) => ({
      staffId: row.staff_id,
      assignedRole: row.assigned_role,
      assignmentStatus: row.assignment_status,
    }));

  const allPrivilegeRequirements = await loadAllProcedurePrivilegeRequirementsForTenant(tid);

  const availabilityByStaff = new Map<
    string,
    import("@/src/lib/workforce-os/workforceRosteringEngine").StaffAvailabilityRangeInput
  >();
  const conflictsByStaff = new Map<string, ReturnType<typeof detectStaffSchedulingConflicts>>();
  const staffList: import("@/src/lib/workforce-os/workforceRosterCandidates").RosterCandidateStaffInput[] =
    [];

  for (const staff of staffRows) {
    const [blocksRes, shiftsRes, staffAssignmentsRes] = await Promise.all([
      supabase
        .from("fi_staff_availability_blocks")
        .select("*")
        .eq("tenant_id", tid)
        .eq("staff_id", staff.id)
        .eq("status", "active"),
      supabase
        .from("fi_staff_shifts")
        .select("*")
        .eq("tenant_id", tid)
        .eq("staff_id", staff.id)
        .neq("status", "cancelled"),
      supabase
        .from("fi_staff_event_assignments")
        .select("*")
        .eq("tenant_id", tid)
        .eq("staff_id", staff.id)
        .neq("assignment_status", "cancelled"),
    ]);
    if (blocksRes.error) throw new Error(blocksRes.error.message);
    if (shiftsRes.error) throw new Error(shiftsRes.error.message);
    if (staffAssignmentsRes.error) throw new Error(staffAssignmentsRes.error.message);

    const blocks = (blocksRes.data ?? []).map((r) =>
      mapAvailabilityBlock(r as Record<string, unknown>)
    );
    const shifts = (shiftsRes.data ?? []).map((r) => mapShift(r as Record<string, unknown>));
    const assignments = (staffAssignmentsRes.data ?? []).map((r) => ({
      id: String((r as Record<string, unknown>).id),
      staff_id: String((r as Record<string, unknown>).staff_id),
      assigned_role: String((r as Record<string, unknown>).assigned_role),
      assignment_status: (r as Record<string, unknown>)
        .assignment_status as FiStaffEventAssignmentRow["assignment_status"],
      event_source: String((r as Record<string, unknown>).event_source),
      event_id:
        (r as Record<string, unknown>).event_id != null
          ? String((r as Record<string, unknown>).event_id)
          : null,
    }));

    availabilityByStaff.set(staff.id, {
      staffId: staff.id,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      workingHours: staff.working_hours,
      staffTimezone: staff.default_timezone,
      availabilityBlocks: blocks,
      shifts,
    });

    conflictsByStaff.set(
      staff.id,
      detectStaffSchedulingConflicts({
        staffId: staff.id,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        availabilityBlocks: blocks,
        shifts,
        eventAssignments: assignments,
      })
    );

    const profileExtras = parseStaffProfileExtras(staff.staff_metadata);
    const privilegeEligibility = await evaluateStaffProcedurePrivilegeForEvent({
      tenantId: tid,
      staffId: staff.id,
      clinicId: input.clinicId,
      eventType: input.eventType,
      assignedRole: input.assignedRole,
      requirements: allPrivilegeRequirements,
    });

    staffList.push({
      staffId: staff.id,
      name: staff.full_name?.trim() || "Staff",
      role: staff.staff_role,
      isActive: staff.is_active,
      clinicId: profileExtras.primary_clinic_id,
      readinessInput: await buildReadinessInputForStaff(tid, staff),
      privilegeEligibility,
    });
  }

  return rankAssignableStaffForRole({
    tenantId: tid,
    clinicId: input.clinicId,
    eventType: input.eventType,
    assignedRole: input.assignedRole,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    existingAssignments,
    staffList,
    availabilityByStaff,
    conflictsByStaff,
  });
}

export async function loadBookingForRosterEvent(
  tenantId: string,
  bookingId: string
): Promise<FiBookingRow | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const bid = assertNonEmptyUuid(bookingId, "bookingId");
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_bookings")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", bid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? (data as FiBookingRow) : null;
}

export { buildWorkforceCandidateAssignments };
