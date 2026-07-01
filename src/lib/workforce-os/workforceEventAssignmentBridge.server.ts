import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadBookingResourceAssignmentsForBookings } from "@/src/lib/calendar/bookingResourceRequirements.server";
import type { FiBookingResourceAssignmentRow } from "@/src/lib/calendar/bookingResourceRequirements.server";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  evaluateStaffProcedurePrivilegeForEvent,
  loadAllProcedurePrivilegeRequirementsForTenant,
} from "@/src/lib/academy-os/procedurePrivileges.server";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  loadStaffMemberForTenant,
  loadStaffMembersByIdForTenant,
} from "@/src/lib/staff/staff.server";
import { toClinicalStaffingSummaryDto } from "@/src/lib/workforce-os/clinicalStaffingStatusDisplay";
import type { ClinicalStaffingSummaryDto } from "@/src/lib/workforce-os/clinicalStaffingSummary.types";
import {
  buildWorkforceCandidateAssignments,
  getWorkforceEventWindow,
  isBookingActiveForStaffing,
  resolveWorkforceAssignedRole,
  resolveWorkforceEventTypeFromBooking,
  resolveWorkforceEventTypeFromSurgery,
  type WorkforceClinicalEventSource,
  type WorkforceStaffCandidate,
} from "@/src/lib/workforce-os/workforceClinicalEventMapping";
import {
  assignStaffToClinicalEvent,
  detectStaffSchedulingConflicts,
  extractEventWindowFromSnapshot,
  resolveClinicalStaffingTemplate,
  type StaffAvailabilityBlockRecord,
  type StaffShiftRecord,
} from "@/src/lib/workforce-os/workforceRosteringEngine";
import {
  buildWorkforceReadinessInputFromSourceRows,
  loadClinicalEventStaffingStatus,
  type ClinicalEventStaffingStatusPreload,
  type FiClinicalStaffingTemplateRow,
  type FiStaffEventAssignmentRow,
} from "@/src/lib/workforce-os/workforceRostering.server";
import type { WorkforceReadinessScoreInput } from "@/src/lib/workforce-os/workforceReadinessEngine";

export type EnsureBookingStaffingAssignmentInput = {
  tenantId: string;
  booking: FiBookingRow;
  allowBlockedDraft?: boolean;
  assignedBy?: string | null;
};

export type EnsureSurgeryStaffingAssignmentInput = {
  tenantId: string;
  surgeryId: string;
  clinicId?: string | null;
  startsAt: string;
  endsAt: string;
  staffId: string;
  assignedRole?: string | null;
  allowBlockedDraft?: boolean;
  assignedBy?: string | null;
};

export type SyncExistingAssignedStaffInput = {
  tenantId: string;
  booking: FiBookingRow;
  resourceAssignments?: FiBookingResourceAssignmentRow[];
  allowBlockedDraft?: boolean;
  assignedBy?: string | null;
};

export type LoadEventStaffingSummaryInput = {
  tenantId: string;
  eventSource: WorkforceClinicalEventSource;
  eventId: string;
  eventType: string;
  clinicId?: string | null;
  startsAt: string;
  endsAt: string;
  candidateStaffIds: WorkforceStaffCandidate[];
  syncExistingStaff?: boolean;
  booking?: FiBookingRow;
  allowBlockedDraft?: boolean;
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

function mapAssignment(row: Record<string, unknown>): FiStaffEventAssignmentRow {
  const snapshot =
    row.eligibility_snapshot &&
    typeof row.eligibility_snapshot === "object" &&
    !Array.isArray(row.eligibility_snapshot)
      ? (row.eligibility_snapshot as Record<string, unknown>)
      : {};
  const window = extractEventWindowFromSnapshot(snapshot);
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    clinic_id: row.clinic_id != null ? String(row.clinic_id) : null,
    event_source: String(row.event_source),
    event_id: row.event_id != null ? String(row.event_id) : null,
    staff_id: String(row.staff_id),
    assigned_role: String(row.assigned_role),
    assignment_status: row.assignment_status as FiStaffEventAssignmentRow["assignment_status"],
    starts_at: window.starts_at,
    ends_at: window.ends_at,
    readiness_score: row.readiness_score != null ? Number(row.readiness_score) : null,
    readiness_band: row.readiness_band != null ? String(row.readiness_band) : null,
    eligibility_snapshot: snapshot,
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    blocking_issues: Array.isArray(row.blocking_issues) ? row.blocking_issues : [],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function assignmentDedupKey(staffId: string, assignedRole: string): string {
  return `${staffId.trim()}:${assignedRole.trim().toLowerCase()}`;
}

async function loadExistingAssignmentsForEvent(
  tenantId: string,
  eventSource: WorkforceClinicalEventSource,
  eventId: string
): Promise<FiStaffEventAssignmentRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_event_assignments")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("event_source", eventSource)
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapAssignment(r as Record<string, unknown>));
}

async function loadTemplatesForTenant(tenantId: string) {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_clinical_staffing_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: String((r as Record<string, unknown>).id),
    tenant_id: tenantId,
    clinic_id:
      (r as Record<string, unknown>).clinic_id != null
        ? String((r as Record<string, unknown>).clinic_id)
        : null,
    event_type: String((r as Record<string, unknown>).event_type),
    required_roles:
      (r as Record<string, unknown>).required_roles &&
      typeof (r as Record<string, unknown>).required_roles === "object"
        ? ((r as Record<string, unknown>).required_roles as Record<string, number>)
        : {},
    is_active: true,
  }));
}

function groupAvailabilityBlocksByStaffId(
  rows: Record<string, unknown>[]
): Map<string, StaffAvailabilityBlockRecord[]> {
  const out = new Map<string, StaffAvailabilityBlockRecord[]>();
  for (const raw of rows) {
    const sid = String(raw.staff_id ?? "").trim();
    if (!sid) continue;
    const list = out.get(sid) ?? [];
    list.push(mapAvailabilityBlock(raw));
    out.set(sid, list);
  }
  return out;
}

function groupShiftsByStaffId(rows: Record<string, unknown>[]): Map<string, StaffShiftRecord[]> {
  const out = new Map<string, StaffShiftRecord[]>();
  for (const raw of rows) {
    const sid = String(raw.staff_id ?? "").trim();
    if (!sid) continue;
    const list = out.get(sid) ?? [];
    list.push(mapShift(raw));
    out.set(sid, list);
  }
  return out;
}

function groupEventAssignmentsByStaffId(
  rows: Record<string, unknown>[]
): Map<string, FiStaffEventAssignmentRow[]> {
  const out = new Map<string, FiStaffEventAssignmentRow[]>();
  for (const raw of rows) {
    const sid = String(raw.staff_id ?? "").trim();
    if (!sid) continue;
    const list = out.get(sid) ?? [];
    list.push(mapAssignment(raw));
    out.set(sid, list);
  }
  return out;
}

function collectStaffIdsForBookingStaffing(input: {
  bookings: FiBookingRow[];
  resourceMap: Map<string, FiBookingResourceAssignmentRow[]>;
  existingByBooking: Map<string, FiStaffEventAssignmentRow[]>;
}): string[] {
  const ids = new Set<string>();
  for (const booking of input.bookings) {
    if (booking.assigned_staff_id?.trim()) ids.add(booking.assigned_staff_id.trim());
    for (const ra of input.resourceMap.get(booking.id) ?? []) {
      if (ra.resource_type === "staff" && ra.resource_id.trim()) ids.add(ra.resource_id.trim());
    }
    for (const row of input.existingByBooking.get(booking.id) ?? []) {
      if (row.staff_id.trim()) ids.add(row.staff_id.trim());
    }
  }
  return Array.from(ids);
}

async function loadClinicalStaffingStatusPreload(
  tenantId: string,
  staffIds: string[],
  templates: Awaited<ReturnType<typeof loadTemplatesForTenant>>,
  privilegeRequirements: Awaited<ReturnType<typeof loadAllProcedurePrivilegeRequirementsForTenant>>
): Promise<ClinicalEventStaffingStatusPreload> {
  const tid = tenantId.trim();
  const ids = Array.from(new Set(staffIds.map((x) => x.trim()).filter(Boolean)));
  if (!ids.length) {
    return {
      templates: templates as FiClinicalStaffingTemplateRow[],
      privilegeRequirements,
      staffById: new Map(),
      availabilityBlocksByStaffId: new Map(),
      shiftsByStaffId: new Map(),
      eventAssignmentsByStaffId: new Map(),
      readinessInputByStaffId: new Map(),
    };
  }

  const supabase = supabaseAdmin();
  const [staffById, blocksRes, shiftsRes, assignmentsRes, sourceRes] = await Promise.all([
    loadStaffMembersByIdForTenant(tid, ids),
    supabase
      .from("fi_staff_availability_blocks")
      .select("*")
      .eq("tenant_id", tid)
      .in("staff_id", ids)
      .eq("status", "active"),
    supabase
      .from("fi_staff_shifts")
      .select("*")
      .eq("tenant_id", tid)
      .in("staff_id", ids)
      .neq("status", "cancelled"),
    supabase
      .from("fi_staff_event_assignments")
      .select("*")
      .eq("tenant_id", tid)
      .in("staff_id", ids)
      .neq("assignment_status", "cancelled"),
    supabase
      .from("fi_staff_source_ids")
      .select("staff_id, source_system, source_staff_id, source_url, metadata")
      .eq("tenant_id", tid)
      .in("staff_id", ids),
  ]);

  if (blocksRes.error) throw new Error(blocksRes.error.message);
  if (shiftsRes.error) throw new Error(shiftsRes.error.message);
  if (assignmentsRes.error) throw new Error(assignmentsRes.error.message);
  if (sourceRes.error) throw new Error(sourceRes.error.message);

  const sourceRowsByStaffId = new Map<
    string,
    Array<{
      source_system: string;
      source_url: string | null;
      metadata: Record<string, unknown> | null;
    }>
  >();
  for (const raw of sourceRes.data ?? []) {
    const r = raw as {
      staff_id: string;
      source_system: string;
      source_url: string | null;
      metadata: unknown;
    };
    const sid = String(r.staff_id).trim();
    if (!sid) continue;
    const list = sourceRowsByStaffId.get(sid) ?? [];
    list.push({
      source_system: String(r.source_system),
      source_url: r.source_url,
      metadata:
        r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
          ? (r.metadata as Record<string, unknown>)
          : null,
    });
    sourceRowsByStaffId.set(sid, list);
  }

  const readinessInputByStaffId = new Map<string, WorkforceReadinessScoreInput>();
  for (const sid of ids) {
    const staff = staffById.get(sid);
    if (!staff) continue;
    readinessInputByStaffId.set(
      sid,
      buildWorkforceReadinessInputFromSourceRows(staff, sourceRowsByStaffId.get(sid) ?? [])
    );
  }

  return {
    templates: templates as FiClinicalStaffingTemplateRow[],
    privilegeRequirements,
    staffById,
    availabilityBlocksByStaffId: groupAvailabilityBlocksByStaffId(
      (blocksRes.data ?? []) as Record<string, unknown>[]
    ),
    shiftsByStaffId: groupShiftsByStaffId((shiftsRes.data ?? []) as Record<string, unknown>[]),
    eventAssignmentsByStaffId: groupEventAssignmentsByStaffId(
      (assignmentsRes.data ?? []) as Record<string, unknown>[]
    ),
    readinessInputByStaffId,
  };
}

async function buildReadinessInputForStaff(tenantId: string, staffId: string) {
  const staff = await loadStaffMemberForTenant(tenantId, staffId);
  if (!staff) throw new Error("Staff member not found.");
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_source_ids")
    .select("source_system, source_staff_id, source_url, metadata")
    .eq("tenant_id", tenantId)
    .eq("staff_id", staffId);
  if (error) throw new Error(error.message);

  const { pickStaffHrNotificationFromSourceRows } =
    await import("@/src/lib/staff/staffHrNotificationSummary");
  const { buildStaffComplianceSummaryFromSourceRows } =
    await import("@/src/lib/staffCompliance/staffComplianceSummary");

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
    staff,
    readinessInput: {
      is_active: staff.is_active,
      staff_role: staff.staff_role,
      working_hours: staff.working_hours,
      hr,
      identityRows: srcRows.map((row) => ({
        source_system: row.source_system,
        source_staff_id: "",
        metadata: row.metadata,
      })),
      compliance,
    },
  };
}

async function upsertWorkforceAssignment(input: {
  tenantId: string;
  clinicId?: string | null;
  eventSource: WorkforceClinicalEventSource;
  eventId: string;
  staffId: string;
  assignedRole: string;
  startsAt: string;
  endsAt: string;
  eventType: string;
  allowBlockedDraft?: boolean;
  assignedBy?: string | null;
  existing?: FiStaffEventAssignmentRow[];
}): Promise<FiStaffEventAssignmentRow | null> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const sid = assertNonEmptyUuid(input.staffId, "staffId");
  const role = input.assignedRole.trim().toLowerCase();

  const existingRows =
    input.existing ??
    (await loadExistingAssignmentsForEvent(tid, input.eventSource, input.eventId));
  const activeMatch = existingRows.find(
    (row) =>
      row.staff_id === sid &&
      row.assigned_role.trim().toLowerCase() === role &&
      row.assignment_status !== "cancelled"
  );
  if (activeMatch) return activeMatch;

  const { readinessInput } = await buildReadinessInputForStaff(tid, sid);
  const privilegeEligibility = await evaluateStaffProcedurePrivilegeForEvent({
    tenantId: tid,
    staffId: sid,
    clinicId: input.clinicId,
    eventType: input.eventType,
    assignedRole: role,
  });
  const supabase = supabaseAdmin();

  const [blocksRes, shiftsRes, assignmentsRes] = await Promise.all([
    supabase
      .from("fi_staff_availability_blocks")
      .select("*")
      .eq("tenant_id", tid)
      .eq("staff_id", sid)
      .eq("status", "active"),
    supabase
      .from("fi_staff_shifts")
      .select("*")
      .eq("tenant_id", tid)
      .eq("staff_id", sid)
      .neq("status", "cancelled"),
    supabase
      .from("fi_staff_event_assignments")
      .select("*")
      .eq("tenant_id", tid)
      .eq("staff_id", sid)
      .neq("assignment_status", "cancelled"),
  ]);
  if (blocksRes.error) throw new Error(blocksRes.error.message);
  if (shiftsRes.error) throw new Error(shiftsRes.error.message);
  if (assignmentsRes.error) throw new Error(assignmentsRes.error.message);

  const blocks = (blocksRes.data ?? []).map((r) =>
    mapAvailabilityBlock(r as Record<string, unknown>)
  );
  const shifts = (shiftsRes.data ?? []).map((r) => mapShift(r as Record<string, unknown>));
  const assignments = (assignmentsRes.data ?? []).map((r) =>
    mapAssignment(r as Record<string, unknown>)
  );

  const conflicts = detectStaffSchedulingConflicts({
    staffId: sid,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    availabilityBlocks: blocks,
    shifts,
    eventAssignments: assignments,
  });

  const result = assignStaffToClinicalEvent({
    tenantId: tid,
    clinicId: input.clinicId,
    eventSource: input.eventSource,
    eventId: input.eventId,
    staffId: sid,
    assignedRole: role,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    assignedBy: input.assignedBy,
    readinessInput,
    privilegeEligibility,
    conflicts,
    allowBlockedDraft: input.allowBlockedDraft ?? true,
  });

  if (!result.ok) return null;

  const snapshot = {
    ...result.eligibilitySnapshot,
    event_type: input.eventType.trim().toLowerCase(),
    bridge_source: "fi_os_assignment_bridge",
  };

  const { data, error } = await supabase
    .from("fi_staff_event_assignments")
    .insert({
      tenant_id: tid,
      clinic_id: input.clinicId?.trim() || null,
      event_source: input.eventSource,
      event_id: input.eventId,
      staff_id: sid,
      assigned_role: role,
      assignment_status: result.assignmentStatus,
      readiness_score: result.readiness.score,
      readiness_band: result.readiness.band,
      eligibility_snapshot: snapshot,
      warnings: result.warnings,
      blocking_issues: result.blockingIssues,
      assigned_by: input.assignedBy?.trim() || null,
    })
    .select("*")
    .single();

  if (error || !data) return null;
  return mapAssignment(data as Record<string, unknown>);
}

export async function cancelWorkforceAssignmentsForEvent(input: {
  tenantId: string;
  eventSource: WorkforceClinicalEventSource;
  eventId: string;
}): Promise<number> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const eid = assertNonEmptyUuid(input.eventId, "eventId");
  const supabase = supabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_staff_event_assignments")
    .update({ assignment_status: "cancelled", updated_at: now })
    .eq("tenant_id", tid)
    .eq("event_source", input.eventSource)
    .eq("event_id", eid)
    .neq("assignment_status", "cancelled")
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

export async function syncExistingAssignedStaffToWorkforceAssignments(
  input: SyncExistingAssignedStaffInput
): Promise<{ created: number; skipped: number }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const booking = input.booking;

  if (!isBookingActiveForStaffing(booking)) {
    await cancelWorkforceAssignmentsForEvent({
      tenantId: tid,
      eventSource: "booking",
      eventId: booking.id,
    });
    return { created: 0, skipped: 0 };
  }

  const resourceAssignments =
    input.resourceAssignments ??
    (
      await loadBookingResourceAssignmentsForBookings({ tenantId: tid, bookingIds: [booking.id] })
    ).get(booking.id) ??
    [];

  const existing = await loadExistingAssignmentsForEvent(tid, "booking", booking.id);
  const activeExisting = existing.filter((row) => row.assignment_status !== "cancelled");

  const staffRoleById = new Map<string, string>();
  const staffIds = new Set<string>();
  if (booking.assigned_staff_id?.trim()) staffIds.add(booking.assigned_staff_id.trim());
  for (const ra of resourceAssignments) {
    if (ra.resource_type === "staff" && ra.resource_id.trim()) staffIds.add(ra.resource_id.trim());
  }
  const staffMembers = await loadStaffMembersByIdForTenant(tid, Array.from(staffIds));
  for (const sid of staffIds) {
    const staff = staffMembers.get(sid);
    if (staff) staffRoleById.set(sid, staff.staff_role);
  }

  const resourceStaff = resourceAssignments
    .filter((ra) => ra.resource_type === "staff")
    .map((ra) => ({
      staffId: ra.resource_id,
      roleLabel: ra.role_label,
      staffRole: staffRoleById.get(ra.resource_id) ?? null,
    }));

  const candidates = buildWorkforceCandidateAssignments({
    primaryStaffId: booking.assigned_staff_id,
    primaryStaffRole: booking.assigned_staff_id
      ? (staffRoleById.get(booking.assigned_staff_id.trim()) ?? null)
      : null,
    bookingType: booking.booking_type,
    resourceStaff,
    existingAssignments: activeExisting.map((row) => ({
      staffId: row.staff_id,
      assignedRole: row.assigned_role,
    })),
  });

  const eventType = resolveWorkforceEventTypeFromBooking(booking);
  const window = getWorkforceEventWindow(booking);
  let created = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const key = assignmentDedupKey(candidate.staffId, candidate.assignedRole);
    const hasActive = activeExisting.some(
      (row) =>
        assignmentDedupKey(row.staff_id, row.assigned_role) === key &&
        row.assignment_status !== "cancelled"
    );
    if (hasActive) {
      skipped += 1;
      continue;
    }

    const row = await upsertWorkforceAssignment({
      tenantId: tid,
      clinicId: booking.clinic_id,
      eventSource: "booking",
      eventId: booking.id,
      staffId: candidate.staffId,
      assignedRole: candidate.assignedRole,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      eventType,
      allowBlockedDraft: input.allowBlockedDraft ?? true,
      assignedBy: input.assignedBy,
      existing,
    });
    if (row) created += 1;
    else skipped += 1;
  }

  return { created, skipped };
}

export async function ensureBookingStaffingAssignment(
  input: EnsureBookingStaffingAssignmentInput
): Promise<ClinicalStaffingSummaryDto> {
  await syncExistingAssignedStaffToWorkforceAssignments({
    tenantId: input.tenantId,
    booking: input.booking,
    allowBlockedDraft: input.allowBlockedDraft,
    assignedBy: input.assignedBy,
  });
  return loadEventStaffingSummary({
    tenantId: input.tenantId,
    eventSource: "booking",
    eventId: input.booking.id,
    eventType: resolveWorkforceEventTypeFromBooking(input.booking),
    clinicId: input.booking.clinic_id,
    startsAt: input.booking.start_at,
    endsAt: input.booking.end_at,
    candidateStaffIds: [],
    booking: input.booking,
    syncExistingStaff: false,
  });
}

export type EnsureSurgeryStaffingFromBookingInput = {
  tenantId: string;
  surgeryId: string;
  booking: FiBookingRow;
  allowBlockedDraft?: boolean;
  assignedBy?: string | null;
};

/**
 * Mirrors booking roster staff into `fi_staff_event_assignments` for a live surgery event.
 * Idempotent — existing surgery assignments are preserved; missing staff records are skipped safely.
 */
export async function ensureSurgeryStaffingFromBooking(
  input: EnsureSurgeryStaffingFromBookingInput
): Promise<{ created: number; skipped: number }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const surgeryId = assertNonEmptyUuid(input.surgeryId, "surgeryId");
  const booking = input.booking;
  const window = getWorkforceEventWindow(booking);

  const resourceAssignments =
    (
      await loadBookingResourceAssignmentsForBookings({ tenantId: tid, bookingIds: [booking.id] })
    ).get(booking.id) ?? [];

  const existing = await loadExistingAssignmentsForEvent(tid, "surgery", surgeryId);
  const activeExisting = existing.filter((row) => row.assignment_status !== "cancelled");

  const staffRoleById = new Map<string, string>();
  const staffIds = new Set<string>();
  if (booking.assigned_staff_id?.trim()) staffIds.add(booking.assigned_staff_id.trim());
  for (const ra of resourceAssignments) {
    if (ra.resource_type === "staff" && ra.resource_id.trim()) staffIds.add(ra.resource_id.trim());
  }
  const staffMembers = await loadStaffMembersByIdForTenant(tid, Array.from(staffIds));
  for (const staffId of staffIds) {
    const staff = staffMembers.get(staffId);
    if (staff) staffRoleById.set(staffId, staff.staff_role);
  }

  const resourceStaff = resourceAssignments
    .filter((ra) => ra.resource_type === "staff")
    .map((ra) => ({
      staffId: ra.resource_id,
      roleLabel: ra.role_label,
      staffRole: staffRoleById.get(ra.resource_id) ?? null,
    }));

  const candidates = buildWorkforceCandidateAssignments({
    primaryStaffId: booking.assigned_staff_id,
    primaryStaffRole: booking.assigned_staff_id
      ? (staffRoleById.get(booking.assigned_staff_id.trim()) ?? null)
      : null,
    bookingType: booking.booking_type,
    resourceStaff,
    existingAssignments: activeExisting.map((row) => ({
      staffId: row.staff_id,
      assignedRole: row.assigned_role,
    })),
  });

  let created = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const key = assignmentDedupKey(candidate.staffId, candidate.assignedRole);
    const hasActive = activeExisting.some(
      (row) =>
        assignmentDedupKey(row.staff_id, row.assigned_role) === key &&
        row.assignment_status !== "cancelled"
    );
    if (hasActive) {
      skipped += 1;
      continue;
    }

    const result = await ensureSurgeryStaffingAssignment({
      tenantId: tid,
      surgeryId,
      clinicId: booking.clinic_id,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      staffId: candidate.staffId,
      assignedRole: candidate.assignedRole,
      allowBlockedDraft: input.allowBlockedDraft ?? true,
      assignedBy: input.assignedBy,
    });
    if (result) created += 1;
    else skipped += 1;
  }

  return { created, skipped };
}

export async function ensureSurgeryStaffingAssignment(
  input: EnsureSurgeryStaffingAssignmentInput
): Promise<ClinicalStaffingSummaryDto | null> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const sid = assertNonEmptyUuid(input.staffId, "staffId");
  const staff = await loadStaffMemberForTenant(tid, sid);
  if (!staff) return null;

  const assignedRole =
    input.assignedRole?.trim().toLowerCase() ||
    resolveWorkforceAssignedRole({ staffRole: staff.staff_role, bookingType: "surgery" });

  await upsertWorkforceAssignment({
    tenantId: tid,
    clinicId: input.clinicId,
    eventSource: "surgery",
    eventId: input.surgeryId,
    staffId: sid,
    assignedRole,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    eventType: resolveWorkforceEventTypeFromSurgery(),
    allowBlockedDraft: input.allowBlockedDraft ?? true,
    assignedBy: input.assignedBy,
  });

  return loadEventStaffingSummary({
    tenantId: tid,
    eventSource: "surgery",
    eventId: input.surgeryId,
    eventType: resolveWorkforceEventTypeFromSurgery(),
    clinicId: input.clinicId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    candidateStaffIds: [{ staffId: sid, assignedRole }],
    syncExistingStaff: false,
  });
}

export async function loadEventStaffingSummary(
  input: LoadEventStaffingSummaryInput
): Promise<ClinicalStaffingSummaryDto> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");

  if (input.syncExistingStaff && input.booking) {
    await syncExistingAssignedStaffToWorkforceAssignments({
      tenantId: tid,
      booking: input.booking,
      allowBlockedDraft: input.allowBlockedDraft ?? true,
    });
  }

  const existing = await loadExistingAssignmentsForEvent(tid, input.eventSource, input.eventId);
  const activeExisting = existing.filter((row) => row.assignment_status !== "cancelled");

  let candidates = [...input.candidateStaffIds];
  if (input.booking) {
    const resourceAssignments =
      (
        await loadBookingResourceAssignmentsForBookings({
          tenantId: tid,
          bookingIds: [input.booking.id],
        })
      ).get(input.booking.id) ?? [];
    const staffRoleById = new Map<string, string>();
    for (const sid of new Set(
      [
        input.booking.assigned_staff_id?.trim(),
        ...resourceAssignments
          .filter((ra) => ra.resource_type === "staff")
          .map((ra) => ra.resource_id.trim()),
        ...activeExisting.map((row) => row.staff_id),
      ].filter(Boolean) as string[]
    )) {
      const staff = await loadStaffMemberForTenant(tid, sid);
      if (staff) staffRoleById.set(sid, staff.staff_role);
    }

    candidates = buildWorkforceCandidateAssignments({
      primaryStaffId: input.booking.assigned_staff_id,
      primaryStaffRole: input.booking.assigned_staff_id
        ? (staffRoleById.get(input.booking.assigned_staff_id.trim()) ?? null)
        : null,
      bookingType: input.booking.booking_type,
      resourceStaff: resourceAssignments
        .filter((ra) => ra.resource_type === "staff")
        .map((ra) => ({
          staffId: ra.resource_id,
          roleLabel: ra.role_label,
          staffRole: staffRoleById.get(ra.resource_id) ?? null,
        })),
      existingAssignments: [
        ...activeExisting.map((row) => ({
          staffId: row.staff_id,
          assignedRole: row.assigned_role,
        })),
        ...candidates,
      ],
    });
  } else if (activeExisting.length) {
    const merged = new Map<string, WorkforceStaffCandidate>();
    for (const row of [
      ...candidates,
      ...activeExisting.map((r) => ({ staffId: r.staff_id, assignedRole: r.assigned_role })),
    ]) {
      merged.set(assignmentDedupKey(row.staffId, row.assignedRole), row);
    }
    candidates = Array.from(merged.values());
  }

  const templates = await loadTemplatesForTenant(tid);
  const template = resolveClinicalStaffingTemplate({
    eventType: input.eventType,
    clinicId: input.clinicId,
    templates,
  });

  const status = await loadClinicalEventStaffingStatus({
    tenantId: tid,
    clinicId: input.clinicId,
    eventType: input.eventType,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    candidateStaffIds: candidates,
  });

  return toClinicalStaffingSummaryDto(status, Boolean(template));
}

export async function loadClinicalStaffingSummariesForBookings(
  tenantId: string,
  bookings: FiBookingRow[],
  options?: {
    syncExistingStaff?: boolean;
    allowBlockedDraft?: boolean;
    /** When provided, skips the fi_booking_resource_assignments fetch (same map may be shared with display enrichment). */
    preloadedResourceAssignments?:
      | Map<string, FiBookingResourceAssignmentRow[]>
      | Promise<Map<string, FiBookingResourceAssignmentRow[]>>;
  }
): Promise<Map<string, ClinicalStaffingSummaryDto>> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const out = new Map<string, ClinicalStaffingSummaryDto>();
  if (!bookings.length) return out;

  const activeBookings = bookings.filter((b) => isBookingActiveForStaffing(b));
  const bookingIds = activeBookings.map((b) => b.id);

  const templatesPromise = loadTemplatesForTenant(tid);
  const privilegeRequirementsPromise = loadAllProcedurePrivilegeRequirementsForTenant(tid);

  const resourceMap =
    options?.preloadedResourceAssignments != null
      ? await options.preloadedResourceAssignments
      : await loadBookingResourceAssignmentsForBookings({ tenantId: tid, bookingIds });

  if (options?.syncExistingStaff) {
    for (const booking of activeBookings) {
      await syncExistingAssignedStaffToWorkforceAssignments({
        tenantId: tid,
        booking,
        resourceAssignments: resourceMap.get(booking.id) ?? [],
        allowBlockedDraft: options.allowBlockedDraft ?? true,
      });
    }
  }

  const eventAssignmentsPromise =
    bookingIds.length > 0
      ? supabaseAdmin()
          .from("fi_staff_event_assignments")
          .select("*")
          .eq("tenant_id", tid)
          .eq("event_source", "booking")
          .in("event_id", bookingIds)
      : Promise.resolve({ data: [], error: null });

  const [eventAssignmentsRes, templates, privilegeRequirements] = await Promise.all([
    eventAssignmentsPromise,
    templatesPromise,
    privilegeRequirementsPromise,
  ]);
  if (eventAssignmentsRes.error) throw new Error(eventAssignmentsRes.error.message);

  const existingByBooking = new Map<string, FiStaffEventAssignmentRow[]>();
  for (const raw of eventAssignmentsRes.data ?? []) {
    const row = mapAssignment(raw as Record<string, unknown>);
    const eid = row.event_id?.trim();
    if (!eid) continue;
    const list = existingByBooking.get(eid) ?? [];
    list.push(row);
    existingByBooking.set(eid, list);
  }

  const staffIds = collectStaffIdsForBookingStaffing({
    bookings: activeBookings,
    resourceMap,
    existingByBooking,
  });
  const staffingPreload = await loadClinicalStaffingStatusPreload(
    tid,
    staffIds,
    templates,
    privilegeRequirements
  );
  const staffRoleById = new Map<string, string | null>();
  for (const sid of staffIds) {
    staffRoleById.set(sid, staffingPreload.staffById?.get(sid)?.staff_role ?? null);
  }

  await Promise.all(
    activeBookings.map(async (booking) => {
      const resourceAssignments = resourceMap.get(booking.id) ?? [];
      const activeExisting = (existingByBooking.get(booking.id) ?? []).filter(
        (row) => row.assignment_status !== "cancelled"
      );

      const resourceStaff = resourceAssignments
        .filter((r) => r.resource_type === "staff")
        .map((ra) => ({
          staffId: ra.resource_id,
          roleLabel: ra.role_label,
          staffRole: staffRoleById.get(ra.resource_id.trim()) ?? null,
        }));

      const candidates = buildWorkforceCandidateAssignments({
        primaryStaffId: booking.assigned_staff_id,
        primaryStaffRole: booking.assigned_staff_id
          ? (staffRoleById.get(booking.assigned_staff_id.trim()) ?? null)
          : null,
        bookingType: booking.booking_type,
        resourceStaff,
        existingAssignments: activeExisting.map((row) => ({
          staffId: row.staff_id,
          assignedRole: row.assigned_role,
        })),
      });

      const eventType = resolveWorkforceEventTypeFromBooking(booking);
      const template = resolveClinicalStaffingTemplate({
        eventType,
        clinicId: booking.clinic_id,
        templates,
      });
      const window = getWorkforceEventWindow(booking);

      const status = await loadClinicalEventStaffingStatus({
        tenantId: tid,
        clinicId: booking.clinic_id,
        eventType,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        candidateStaffIds: candidates,
        preload: staffingPreload,
      });

      out.set(booking.id, toClinicalStaffingSummaryDto(status, Boolean(template)));
    })
  );

  return out;
}

export async function loadBookingClinicalStaffingSummary(
  tenantId: string,
  booking: FiBookingRow,
  options?: { syncExistingStaff?: boolean }
): Promise<ClinicalStaffingSummaryDto> {
  if (!isBookingActiveForStaffing(booking)) {
    return toClinicalStaffingSummaryDto(
      {
        ready: true,
        readinessScore: 0,
        requiredRoles: {},
        assignedCounts: {},
        missingRoles: [],
        blockedAssignments: [],
        warnings: [],
      },
      false
    );
  }

  const eventType = resolveWorkforceEventTypeFromBooking(booking);
  const window = getWorkforceEventWindow(booking);
  return loadEventStaffingSummary({
    tenantId,
    eventSource: "booking",
    eventId: booking.id,
    eventType,
    clinicId: booking.clinic_id,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    candidateStaffIds: [],
    booking,
    syncExistingStaff: options?.syncExistingStaff ?? true,
  });
}
