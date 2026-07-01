import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { publishWorkforceEvent } from "@/src/lib/analytics-os/analyticsModulePublishers";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  evaluateStaffProcedurePrivilegeForEvent,
  loadAllProcedurePrivilegeRequirementsForTenant,
  seedDefaultProcedurePrivilegeRequirementsForTenant,
} from "@/src/lib/academy-os/procedurePrivileges.server";
import {
  DEFAULT_CLINICAL_STAFFING_TEMPLATES,
  normalizeRequiredRoles,
  type ClinicalStaffingRequiredRoles,
} from "@/src/lib/workforce-os/workforceClinicalStaffingTemplateDefaults";
import { pickStaffHrNotificationFromSourceRows } from "@/src/lib/staff/staffHrNotificationSummary";
import { buildStaffComplianceSummaryFromSourceRows } from "@/src/lib/staffCompliance/staffComplianceSummary";
import type { FiStaffRow } from "@/src/lib/staff/staff.server";
import { loadStaffMemberForTenant } from "@/src/lib/staff/staff.server";
import { assertStaffMeetsClinicalEligibilityForAssignment } from "@/src/lib/workforce/clinicalEligibilityGate.server";
import type { WorkforceReadinessScoreInput } from "@/src/lib/workforce-os/workforceReadinessEngine";
import {
  assignStaffToClinicalEvent,
  detectStaffSchedulingConflicts,
  extractEventWindowFromSnapshot,
  resolveClinicalStaffingTemplate,
  validateClinicalEventStaffing,
  type ClinicalStaffingTemplateRecord,
  type StaffAvailabilityBlockRecord,
  type StaffEventAssignmentRecord,
  type StaffShiftRecord,
  type ValidateClinicalEventStaffingResult,
} from "@/src/lib/workforce-os/workforceRosteringEngine";

export type FiStaffAvailabilityBlockRow = StaffAvailabilityBlockRecord & {
  tenant_id: string;
  staff_id: string;
  clinic_id: string | null;
};

export type FiStaffShiftRow = StaffShiftRecord & {
  tenant_id: string;
  staff_id: string;
  clinic_id: string | null;
  notes: string | null;
};

export type FiClinicalStaffingTemplateRow = ClinicalStaffingTemplateRecord & {
  created_at: string;
  updated_at: string;
};

export type FiStaffEventAssignmentRow = StaffEventAssignmentRecord & {
  tenant_id: string;
  clinic_id: string | null;
  readiness_score: number | null;
  readiness_band: string | null;
  eligibility_snapshot: Record<string, unknown>;
  warnings: unknown[];
  blocking_issues: unknown[];
  created_at: string;
  updated_at: string;
};

export type WorkforceRosterDateRange = {
  startsAt: string;
  endsAt: string;
};

export type WorkforceRosterOverview = {
  shiftsScheduledThisWeek: number;
  availabilityBlocksCount: number;
  staffAssignedToEvents: number;
  eventsWithStaffingWarnings: number;
  eventsMissingRequiredRoles: number;
  todaysStaffingReadiness: TodaysStaffingReadinessRow[];
};

export type TodaysStaffingReadinessRow = {
  eventType: string;
  timeLabel: string;
  requiredRoles: ClinicalStaffingRequiredRoles;
  assignedStaffCount: number;
  status: "ready" | "missing_roles" | "blocked_assignment" | "warning";
};

export type StaffRosterProfile = {
  upcomingShifts: FiStaffShiftRow[];
  activeAvailabilityBlocks: FiStaffAvailabilityBlockRow[];
  recentClinicalAssignments: FiStaffEventAssignmentRow[];
  assignmentWarnings: string[];
};

export type ClinicalStaffingTemplateSeedResult = {
  created: number;
  skipped: number;
};

export { seedDefaultProcedurePrivilegeRequirementsForTenant };

export async function seedDefaultClinicalStaffingTemplatesForTenant(
  tenantId: string,
  clinicId?: string | null
): Promise<ClinicalStaffingTemplateSeedResult> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = supabaseAdmin();
  let created = 0;
  let skipped = 0;

  for (const template of DEFAULT_CLINICAL_STAFFING_TEMPLATES) {
    let query = supabase
      .from("fi_clinical_staffing_templates")
      .select("id")
      .eq("tenant_id", tid)
      .eq("event_type", template.event_type)
      .eq("is_active", true);

    if (clinicId?.trim()) {
      query = query.eq("clinic_id", clinicId.trim());
    } else {
      query = query.is("clinic_id", null);
    }

    const { data: existing, error: findErr } = await query.maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (existing) {
      skipped += 1;
      continue;
    }

    const { error: insErr } = await supabase.from("fi_clinical_staffing_templates").insert({
      tenant_id: tid,
      clinic_id: clinicId?.trim() || null,
      event_type: template.event_type,
      required_roles: template.required_roles,
      is_active: true,
    });
    if (insErr) throw new Error(insErr.message);
    created += 1;
  }

  return { created, skipped };
}

function mapAvailabilityBlock(row: Record<string, unknown>): FiStaffAvailabilityBlockRow {
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

function mapShift(row: Record<string, unknown>): FiStaffShiftRow {
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
  };
}

function mapTemplate(row: Record<string, unknown>): FiClinicalStaffingTemplateRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    clinic_id: row.clinic_id != null ? String(row.clinic_id) : null,
    event_type: String(row.event_type),
    required_roles: normalizeRequiredRoles(row.required_roles as Record<string, unknown>),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
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

async function loadTemplatesForTenant(tenantId: string): Promise<FiClinicalStaffingTemplateRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_clinical_staffing_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapTemplate(r as Record<string, unknown>));
}

type StaffSourceQueryRow = {
  source_system: string;
  source_url: string | null;
  metadata: Record<string, unknown> | null;
};

export function buildWorkforceReadinessInputFromSourceRows(
  staff: FiStaffRow,
  sourceRows: StaffSourceQueryRow[]
): WorkforceReadinessScoreInput {
  const identityRows = sourceRows.map((row) => ({
    source_system: row.source_system,
    source_staff_id: "",
    metadata: row.metadata,
  }));

  const hr = pickStaffHrNotificationFromSourceRows(sourceRows);
  const compliance = buildStaffComplianceSummaryFromSourceRows(
    sourceRows.map((row) => ({ source_system: row.source_system, metadata: row.metadata })),
    { now: new Date() }
  );

  return {
    is_active: staff.is_active,
    staff_role: staff.staff_role,
    working_hours: staff.working_hours,
    hr,
    identityRows,
    compliance,
  };
}

async function buildReadinessInputForStaff(
  tenantId: string,
  staff: FiStaffRow
): Promise<WorkforceReadinessScoreInput> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_source_ids")
    .select("source_system, source_staff_id, source_url, metadata")
    .eq("tenant_id", tenantId)
    .eq("staff_id", staff.id);
  if (error) throw new Error(error.message);

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

  return buildWorkforceReadinessInputFromSourceRows(staff, srcRows);
}

function startOfWeekUtc(ref: Date): Date {
  const d = new Date(ref);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfWeekUtc(ref: Date): Date {
  const start = startOfWeekUtc(ref);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
}

function startOfDayUtc(ref: Date): Date {
  const d = new Date(ref);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDayUtc(ref: Date): Date {
  const d = startOfDayUtc(ref);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function formatTimeLabel(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "—";
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${fmt(s)}–${fmt(e)}`;
}

export async function loadWorkforceRosterOverview(
  tenantId: string,
  dateRange?: WorkforceRosterDateRange
): Promise<WorkforceRosterOverview> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = supabaseAdmin();
  const now = new Date();
  const weekStart = dateRange?.startsAt ?? startOfWeekUtc(now).toISOString();
  const weekEnd = dateRange?.endsAt ?? endOfWeekUtc(now).toISOString();
  const todayStart = startOfDayUtc(now).toISOString();
  const todayEnd = endOfDayUtc(now).toISOString();

  const [shiftsRes, blocksRes, assignmentsRes, templates] = await Promise.all([
    supabase
      .from("fi_staff_shifts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .neq("status", "cancelled")
      .gte("starts_at", weekStart)
      .lt("starts_at", weekEnd),
    supabase
      .from("fi_staff_availability_blocks")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("status", "active")
      .gte("starts_at", weekStart)
      .lt("starts_at", weekEnd),
    supabase
      .from("fi_staff_event_assignments")
      .select("*")
      .eq("tenant_id", tid)
      .neq("assignment_status", "cancelled")
      .gte("created_at", weekStart)
      .lt("created_at", weekEnd),
    loadTemplatesForTenant(tid),
  ]);

  if (shiftsRes.error) throw new Error(shiftsRes.error.message);
  if (blocksRes.error) throw new Error(blocksRes.error.message);
  if (assignmentsRes.error) throw new Error(assignmentsRes.error.message);

  const assignments = (assignmentsRes.data ?? []).map((r) =>
    mapAssignment(r as Record<string, unknown>)
  );
  const uniqueStaffAssigned = new Set(assignments.map((a) => a.staff_id)).size;

  let eventsWithStaffingWarnings = 0;
  let eventsMissingRequiredRoles = 0;

  const eventGroups = new Map<string, FiStaffEventAssignmentRow[]>();
  for (const a of assignments) {
    const key = `${a.event_source}:${a.event_id ?? a.id}`;
    const list = eventGroups.get(key) ?? [];
    list.push(a);
    eventGroups.set(key, list);
  }

  for (const [, group] of eventGroups) {
    const hasWarning = group.some((a) => Array.isArray(a.warnings) && a.warnings.length > 0);
    const hasBlocked = group.some((a) => a.assignment_status === "blocked");
    if (hasWarning || hasBlocked) eventsWithStaffingWarnings += 1;
  }

  const todaysAssignments = assignments.filter((a) => {
    const start = a.starts_at ?? a.created_at;
    return start >= todayStart && start < todayEnd;
  });

  const todaysStaffingReadiness: TodaysStaffingReadinessRow[] = [];
  const todayGroups = new Map<string, FiStaffEventAssignmentRow[]>();
  for (const a of todaysAssignments) {
    const key = `${a.event_source}:${a.event_id ?? a.id}`;
    const list = todayGroups.get(key) ?? [];
    list.push(a);
    todayGroups.set(key, list);
  }

  for (const [, group] of todayGroups) {
    const first = group[0];
    const eventType = String(first.eligibility_snapshot?.event_type ?? "clinical_event");
    const template = resolveClinicalStaffingTemplate({
      eventType,
      clinicId: first.clinic_id,
      templates,
    });
    const requiredRoles = template?.required_roles ?? {};
    const assignedCounts: ClinicalStaffingRequiredRoles = {};
    for (const a of group) {
      const role = a.assigned_role.trim().toLowerCase();
      assignedCounts[role] = (assignedCounts[role] ?? 0) + 1;
    }
    const missing = Object.entries(requiredRoles).some(
      ([role, count]) => (assignedCounts[role] ?? 0) < count
    );
    const hasBlocked = group.some((a) => a.assignment_status === "blocked");
    const hasWarning = group.some((a) => Array.isArray(a.warnings) && a.warnings.length > 0);
    if (missing) eventsMissingRequiredRoles += 1;

    let status: TodaysStaffingReadinessRow["status"] = "ready";
    if (hasBlocked) status = "blocked_assignment";
    else if (missing) status = "missing_roles";
    else if (hasWarning) status = "warning";

    const windowStart = first.starts_at ?? first.created_at;
    const windowEnd = first.ends_at ?? first.created_at;

    todaysStaffingReadiness.push({
      eventType,
      timeLabel: formatTimeLabel(windowStart, windowEnd),
      requiredRoles,
      assignedStaffCount: group.length,
      status,
    });
  }

  return {
    shiftsScheduledThisWeek: shiftsRes.count ?? 0,
    availabilityBlocksCount: blocksRes.count ?? 0,
    staffAssignedToEvents: uniqueStaffAssigned,
    eventsWithStaffingWarnings,
    eventsMissingRequiredRoles,
    todaysStaffingReadiness,
  };
}

export async function loadStaffRosterProfile(
  tenantId: string,
  staffId: string,
  dateRange?: WorkforceRosterDateRange
): Promise<StaffRosterProfile> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffId, "staffId");
  const supabase = supabaseAdmin();
  const now = new Date();
  const rangeStart = dateRange?.startsAt ?? now.toISOString();
  const rangeEnd = dateRange?.endsAt ?? new Date(now.getTime() + 30 * 86_400_000).toISOString();

  const [shiftsRes, blocksRes, assignmentsRes] = await Promise.all([
    supabase
      .from("fi_staff_shifts")
      .select("*")
      .eq("tenant_id", tid)
      .eq("staff_id", sid)
      .neq("status", "cancelled")
      .gte("starts_at", rangeStart)
      .lt("starts_at", rangeEnd)
      .order("starts_at", { ascending: true })
      .limit(20),
    supabase
      .from("fi_staff_availability_blocks")
      .select("*")
      .eq("tenant_id", tid)
      .eq("staff_id", sid)
      .eq("status", "active")
      .gte("ends_at", rangeStart)
      .order("starts_at", { ascending: true })
      .limit(20),
    supabase
      .from("fi_staff_event_assignments")
      .select("*")
      .eq("tenant_id", tid)
      .eq("staff_id", sid)
      .neq("assignment_status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (shiftsRes.error) throw new Error(shiftsRes.error.message);
  if (blocksRes.error) throw new Error(blocksRes.error.message);
  if (assignmentsRes.error) throw new Error(assignmentsRes.error.message);

  const recentClinicalAssignments = (assignmentsRes.data ?? []).map((r) =>
    mapAssignment(r as Record<string, unknown>)
  );

  const assignmentWarnings: string[] = [];
  for (const a of recentClinicalAssignments) {
    if (Array.isArray(a.warnings)) {
      for (const w of a.warnings) {
        if (typeof w === "string" && w.trim()) assignmentWarnings.push(w.trim());
      }
    }
    if (a.assignment_status === "blocked") {
      assignmentWarnings.push(`Blocked assignment (${a.assigned_role})`);
    }
  }

  return {
    upcomingShifts: (shiftsRes.data ?? []).map((r) => mapShift(r as Record<string, unknown>)),
    activeAvailabilityBlocks: (blocksRes.data ?? []).map((r) =>
      mapAvailabilityBlock(r as Record<string, unknown>)
    ),
    recentClinicalAssignments,
    assignmentWarnings: [...new Set(assignmentWarnings)],
  };
}

export async function createStaffShift(input: {
  tenantId: string;
  clinicId?: string | null;
  staffId: string;
  shiftType: string;
  startsAt: string;
  endsAt: string;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<FiStaffShiftRow> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_shifts")
    .insert({
      tenant_id: tid,
      clinic_id: input.clinicId?.trim() || null,
      staff_id: assertNonEmptyUuid(input.staffId, "staffId"),
      shift_type: input.shiftType,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      notes: input.notes?.trim() || null,
      created_by: input.createdBy?.trim() || null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create shift.");
  return mapShift(data as Record<string, unknown>);
}

export async function createAvailabilityBlock(input: {
  tenantId: string;
  staffId: string;
  clinicId?: string | null;
  blockType: FiStaffAvailabilityBlockRow["block_type"];
  startsAt: string;
  endsAt: string;
  reason?: string | null;
  createdBy?: string | null;
}): Promise<FiStaffAvailabilityBlockRow> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_availability_blocks")
    .insert({
      tenant_id: tid,
      staff_id: assertNonEmptyUuid(input.staffId, "staffId"),
      clinic_id: input.clinicId?.trim() || null,
      block_type: input.blockType,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      reason: input.reason?.trim() || null,
      created_by: input.createdBy?.trim() || null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create availability block.");
  return mapAvailabilityBlock(data as Record<string, unknown>);
}

export async function cancelAvailabilityBlock(
  tenantId: string,
  blockId: string
): Promise<FiStaffAvailabilityBlockRow> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const bid = assertNonEmptyUuid(blockId, "blockId");
  const supabase = supabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_staff_availability_blocks")
    .update({ status: "cancelled", updated_at: now })
    .eq("tenant_id", tid)
    .eq("id", bid)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not cancel availability block.");
  return mapAvailabilityBlock(data as Record<string, unknown>);
}

export async function cancelStaffShift(
  tenantId: string,
  shiftId: string
): Promise<FiStaffShiftRow> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(shiftId, "shiftId");
  const supabase = supabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_staff_shifts")
    .update({ status: "cancelled", updated_at: now })
    .eq("tenant_id", tid)
    .eq("id", sid)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not cancel shift.");
  return mapShift(data as Record<string, unknown>);
}

export async function cancelStaffEventAssignment(
  tenantId: string,
  assignmentId: string
): Promise<FiStaffEventAssignmentRow> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const aid = assertNonEmptyUuid(assignmentId, "assignmentId");
  const supabase = supabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_staff_event_assignments")
    .update({ assignment_status: "cancelled", updated_at: now })
    .eq("tenant_id", tid)
    .eq("id", aid)
    .neq("assignment_status", "cancelled")
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not cancel assignment.");
  return mapAssignment(data as Record<string, unknown>);
}

export async function createClinicalStaffingTemplate(input: {
  tenantId: string;
  clinicId?: string | null;
  eventType: string;
  requiredRoles: ClinicalStaffingRequiredRoles;
}): Promise<FiClinicalStaffingTemplateRow> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_clinical_staffing_templates")
    .insert({
      tenant_id: tid,
      clinic_id: input.clinicId?.trim() || null,
      event_type: input.eventType.trim().toLowerCase(),
      required_roles: normalizeRequiredRoles(input.requiredRoles),
      is_active: true,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create staffing template.");
  return mapTemplate(data as Record<string, unknown>);
}

export async function assignStaffToClinicalEventAction(input: {
  tenantId: string;
  clinicId?: string | null;
  eventSource: "booking" | "surgery" | "calendar" | "manual";
  eventId?: string | null;
  staffId: string;
  assignedRole: string;
  startsAt: string;
  endsAt: string;
  assignedBy?: string | null;
  allowBlockedDraft?: boolean;
  eventType?: string | null;
}): Promise<FiStaffEventAssignmentRow> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const sid = assertNonEmptyUuid(input.staffId, "staffId");
  const supabase = supabaseAdmin();

  const staff = await loadStaffMemberForTenant(tid, sid);
  if (!staff) throw new Error("Staff member not found.");

  if (input.eventId?.trim()) {
    const { data: existingRows, error: existingErr } = await supabase
      .from("fi_staff_event_assignments")
      .select("*")
      .eq("tenant_id", tid)
      .eq("event_source", input.eventSource)
      .eq("event_id", input.eventId.trim())
      .eq("staff_id", sid)
      .eq("assigned_role", input.assignedRole.trim().toLowerCase())
      .neq("assignment_status", "cancelled")
      .maybeSingle();
    if (existingErr) throw new Error(existingErr.message);
    if (existingRows) {
      return mapAssignment(existingRows as Record<string, unknown>);
    }
  }

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

  const readinessInput = await buildReadinessInputForStaff(tid, staff);
  const privilegeEligibility = input.eventType?.trim()
    ? await evaluateStaffProcedurePrivilegeForEvent({
        tenantId: tid,
        staffId: sid,
        clinicId: input.clinicId,
        eventType: input.eventType.trim().toLowerCase(),
        assignedRole: input.assignedRole,
      })
    : undefined;

  if (!input.allowBlockedDraft) {
    await assertStaffMeetsClinicalEligibilityForAssignment(tid, sid, supabase);
  }

  const result = assignStaffToClinicalEvent({
    tenantId: tid,
    clinicId: input.clinicId,
    eventSource: input.eventSource,
    eventId: input.eventId,
    staffId: sid,
    assignedRole: input.assignedRole,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    assignedBy: input.assignedBy,
    readinessInput,
    privilegeEligibility,
    conflicts,
    allowBlockedDraft: input.allowBlockedDraft,
  });

  if (!result.ok) {
    throw new Error(result.reason);
  }

  const snapshot = {
    ...result.eligibilitySnapshot,
    event_type: input.eventType?.trim().toLowerCase() || null,
  };

  const { data, error } = await supabase
    .from("fi_staff_event_assignments")
    .insert({
      tenant_id: tid,
      clinic_id: input.clinicId?.trim() || null,
      event_source: input.eventSource,
      event_id: input.eventId?.trim() || null,
      staff_id: sid,
      assigned_role: input.assignedRole.trim().toLowerCase(),
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

  if (error || !data) throw new Error(error?.message ?? "Could not create event assignment.");
  const assignment = mapAssignment(data as Record<string, unknown>);

  void publishWorkforceEvent({
    tenantId: tid,
    clinicId: input.clinicId,
    eventType: "staff_assigned",
    entityId: input.eventId?.trim() || assignment.id,
    entityType: input.eventSource === "surgery" ? "surgery" : "booking",
    eventValue: result.readiness.score,
    eventMetadata: {
      staff_id: sid,
      staff_role: input.assignedRole.trim().toLowerCase(),
      event_source: input.eventSource,
      assignment_status: result.assignmentStatus,
      assignment_id: assignment.id,
    },
    occurredAt: input.startsAt,
  });

  return assignment;
}

export type ClinicalEventStaffingStatusPreload = {
  templates?: FiClinicalStaffingTemplateRow[];
  privilegeRequirements?: Awaited<
    ReturnType<typeof loadAllProcedurePrivilegeRequirementsForTenant>
  >;
  staffById?: Map<string, FiStaffRow>;
  availabilityBlocksByStaffId?: Map<string, StaffAvailabilityBlockRecord[]>;
  shiftsByStaffId?: Map<string, StaffShiftRecord[]>;
  eventAssignmentsByStaffId?: Map<string, FiStaffEventAssignmentRow[]>;
  readinessInputByStaffId?: Map<string, WorkforceReadinessScoreInput>;
};

export async function loadClinicalEventStaffingStatus(input: {
  tenantId: string;
  clinicId?: string | null;
  eventType: string;
  startsAt: string;
  endsAt: string;
  candidateStaffIds: Array<{ staffId: string; assignedRole: string }>;
  preload?: ClinicalEventStaffingStatusPreload;
}): Promise<ValidateClinicalEventStaffingResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = supabaseAdmin();
  const templates = input.preload?.templates ?? (await loadTemplatesForTenant(tid));
  const template = resolveClinicalStaffingTemplate({
    eventType: input.eventType,
    clinicId: input.clinicId,
    templates,
  });
  const requiredRoles = template?.required_roles ?? {};
  const allPrivilegeRequirements =
    input.preload?.privilegeRequirements ??
    (await loadAllProcedurePrivilegeRequirementsForTenant(tid));

  const availabilityByStaff = new Map<
    string,
    import("@/src/lib/workforce-os/workforceRosteringEngine").StaffAvailabilityRangeInput
  >();
  const conflictsByStaff = new Map<string, ReturnType<typeof detectStaffSchedulingConflicts>>();
  const candidateAssignments: Array<{
    staffId: string;
    assignedRole: string;
    readinessInput: WorkforceReadinessScoreInput;
    privilegeEligibility?: import("@/src/lib/academy-os/procedurePrivilegeTypes").ProcedurePrivilegeEligibilityResult;
  }> = [];

  for (const candidate of input.candidateStaffIds) {
    const staff =
      input.preload?.staffById?.get(candidate.staffId) ??
      (await loadStaffMemberForTenant(tid, candidate.staffId));
    if (!staff) continue;

    let blocks: StaffAvailabilityBlockRecord[];
    let shifts: StaffShiftRecord[];
    let assignments: FiStaffEventAssignmentRow[];

    if (input.preload?.availabilityBlocksByStaffId) {
      blocks = input.preload.availabilityBlocksByStaffId.get(candidate.staffId) ?? [];
      shifts = input.preload.shiftsByStaffId?.get(candidate.staffId) ?? [];
      assignments = input.preload.eventAssignmentsByStaffId?.get(candidate.staffId) ?? [];
    } else {
      const [blocksRes, shiftsRes, assignmentsRes] = await Promise.all([
        supabase
          .from("fi_staff_availability_blocks")
          .select("*")
          .eq("tenant_id", tid)
          .eq("staff_id", candidate.staffId)
          .eq("status", "active"),
        supabase
          .from("fi_staff_shifts")
          .select("*")
          .eq("tenant_id", tid)
          .eq("staff_id", candidate.staffId)
          .neq("status", "cancelled"),
        supabase
          .from("fi_staff_event_assignments")
          .select("*")
          .eq("tenant_id", tid)
          .eq("staff_id", candidate.staffId)
          .neq("assignment_status", "cancelled"),
      ]);

      if (blocksRes.error) throw new Error(blocksRes.error.message);
      if (shiftsRes.error) throw new Error(shiftsRes.error.message);
      if (assignmentsRes.error) throw new Error(assignmentsRes.error.message);

      blocks = (blocksRes.data ?? []).map((r) =>
        mapAvailabilityBlock(r as Record<string, unknown>)
      );
      shifts = (shiftsRes.data ?? []).map((r) => mapShift(r as Record<string, unknown>));
      assignments = (assignmentsRes.data ?? []).map((r) =>
        mapAssignment(r as Record<string, unknown>)
      );
    }

    availabilityByStaff.set(candidate.staffId, {
      staffId: candidate.staffId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      workingHours: staff.working_hours,
      staffTimezone: staff.default_timezone,
      availabilityBlocks: blocks,
      shifts,
    });

    const conflicts = detectStaffSchedulingConflicts({
      staffId: candidate.staffId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      availabilityBlocks: blocks,
      shifts,
      eventAssignments: assignments,
    });
    conflictsByStaff.set(candidate.staffId, conflicts);

    const readinessInput =
      input.preload?.readinessInputByStaffId?.get(candidate.staffId) ??
      (await buildReadinessInputForStaff(tid, staff));
    const privilegeEligibility = await evaluateStaffProcedurePrivilegeForEvent({
      tenantId: tid,
      staffId: candidate.staffId,
      clinicId: input.clinicId,
      eventType: input.eventType,
      assignedRole: candidate.assignedRole,
      requirements: allPrivilegeRequirements,
    });
    candidateAssignments.push({
      staffId: candidate.staffId,
      assignedRole: candidate.assignedRole,
      readinessInput,
      privilegeEligibility,
    });
  }

  return validateClinicalEventStaffing({
    eventType: input.eventType,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    requiredRoles,
    candidateAssignments,
    availabilityByStaff,
    conflictsByStaff,
  });
}
