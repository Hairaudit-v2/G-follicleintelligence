import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadAllStaffForTenant, loadStaffMemberForTenant } from "@/src/lib/staff/staff.server";
import { loadRosterStaffEligibilityContext } from "@/src/lib/workforce-os/rosterEligibleStaff.server";
import type { RosterStaffEligibilitySnapshot } from "@/src/lib/workforce-os/rosterEligibleStaffCore";
import {
  ROSTER_SHIFT_AUDIT_ACTION_TYPES,
  ROSTER_SHIFT_EDIT_REASON_REQUIRED_MESSAGE,
  ROSTER_SHIFT_UPDATE_OUTCOMES,
  canEditRosterShift,
  canHardDeleteGeneratedDraftShift,
  isValidRosterShiftEditReason,
  rosterShiftCancellationAuditMetadata,
  rosterShiftEditAuditMetadata,
  rosterShiftEditRequiresReason,
  shiftSnapshotForAudit,
  type RosterShiftCancellationReason,
  type RosterShiftEditReason,
  type RosterShiftSnapshot,
  type RosterShiftUpdateOutcome,
} from "@/src/lib/workforce-os/rosterManualAdjustmentsCore";
import { insertRosterShiftAuditEvent } from "@/src/lib/workforce-os/rosterShiftAudit.server";
import {
  rankAssignableStaffForRole,
  type RosterAssignableCandidate,
} from "@/src/lib/workforce-os/workforceRosterCandidates";
import {
  buildWorkforceReadinessInputFromSourceRows,
  createAvailabilityBlock,
  createStaffShift,
  type FiStaffAvailabilityBlockRow,
  type FiStaffShiftRow,
} from "@/src/lib/workforce-os/workforceRostering.server";
import {
  detectStaffSchedulingConflicts,
  type StaffAvailabilityBlockRecord,
  type StaffShiftRecord,
} from "@/src/lib/workforce-os/workforceRosteringEngine";

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
    shift_source: (row.shift_source as FiStaffShiftRow["shift_source"]) ?? "manual",
    adjustment_reason: row.adjustment_reason != null ? String(row.adjustment_reason) : null,
    cancellation_reason: row.cancellation_reason != null ? String(row.cancellation_reason) : null,
    updated_by: row.updated_by != null ? String(row.updated_by) : null,
    created_by: row.created_by != null ? String(row.created_by) : null,
  };
}

function toAuditSnapshot(shift: FiStaffShiftRow): RosterShiftSnapshot {
  return {
    id: shift.id,
    staff_id: shift.staff_id,
    clinic_id: shift.clinic_id,
    shift_type: shift.shift_type,
    starts_at: shift.starts_at,
    ends_at: shift.ends_at,
    status: shift.status,
    notes: shift.notes,
    shift_source: shift.shift_source ?? "manual",
    adjustment_reason: shift.adjustment_reason ?? null,
    cancellation_reason: shift.cancellation_reason ?? null,
  };
}

async function loadShiftForTenant(
  tenantId: string,
  shiftId: string,
  client?: SupabaseClient
): Promise<FiStaffShiftRow | null> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_shifts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", shiftId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapShiftRow(data as Record<string, unknown>);
}

export type RosterShiftValidationWarning = {
  code: string;
  message: string;
  blocking: boolean;
};

export async function evaluateStaffShiftAssignmentWarnings(input: {
  tenantId: string;
  staffId: string;
  clinicId?: string | null;
  shiftType: string;
  startsAt: string;
  endsAt: string;
  allowOverride?: boolean;
  excludeShiftId?: string | null;
  client?: SupabaseClient;
}): Promise<{ warnings: RosterShiftValidationWarning[]; eligibility: RosterStaffEligibilitySnapshot }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const sid = assertNonEmptyUuid(input.staffId, "staffId");
  const supabase = input.client ?? supabaseAdmin();
  const localDate = input.startsAt.slice(0, 10);

  const ctx = await loadRosterStaffEligibilityContext(tid, {
    periodDayDates: [localDate],
    client: supabase,
  });
  const eligibility = ctx.eligibilityByStaffId.get(sid) ?? {
    eligible: false,
    reason: "no_tenant_association" as const,
  };

  const warnings: RosterShiftValidationWarning[] = [];
  if (!eligibility.eligible) {
    warnings.push({
      code: "staff_not_roster_eligible",
      message: `Staff is not roster-eligible (${eligibility.reason ?? "unknown"}).`,
      blocking: !input.allowOverride,
    });
  }

  const staff = await loadStaffMemberForTenant(tid, sid, supabase);
  if (staff && !staff.is_active) {
    warnings.push({
      code: "staff_inactive",
      message: "Staff member is inactive.",
      blocking: !input.allowOverride,
    });
  }

  const [blocksRes, shiftsRes] = await Promise.all([
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
  ]);
  if (blocksRes.error) throw new Error(blocksRes.error.message);
  if (shiftsRes.error) throw new Error(shiftsRes.error.message);

  const blocks = (blocksRes.data ?? []).map(
    (r) =>
      ({
        block_type: r.block_type,
        starts_at: String(r.starts_at),
        ends_at: String(r.ends_at),
        status: String(r.status),
      }) as StaffAvailabilityBlockRecord
  );
  const shifts = (shiftsRes.data ?? []).map(
    (r) =>
      ({
        id: String(r.id),
        shift_type: String(r.shift_type),
        starts_at: String(r.starts_at),
        ends_at: String(r.ends_at),
        status: String(r.status),
      }) as StaffShiftRecord
  );

  const conflicts = detectStaffSchedulingConflicts({
    staffId: sid,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    availabilityBlocks: blocks,
    shifts,
    eventAssignments: [],
    excludeShiftId: input.excludeShiftId,
  });

  for (const conflict of conflicts) {
    warnings.push({
      code: conflict.kind,
      message: conflict.message,
      blocking: !input.allowOverride,
    });
  }

  return { warnings, eligibility };
}

export async function updateStaffShift(input: {
  tenantId: string;
  shiftId: string;
  staffId?: string;
  clinicId?: string | null;
  shiftType?: string;
  startsAt?: string;
  endsAt?: string;
  notes?: string | null;
  status?: FiStaffShiftRow["status"];
  editReason?: RosterShiftEditReason | string | null;
  updatedBy: string;
  allowOverride?: boolean;
  client?: SupabaseClient;
}): Promise<{
  shift: FiStaffShiftRow;
  warnings: RosterShiftValidationWarning[];
  outcome: RosterShiftUpdateOutcome;
}> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const shiftId = assertNonEmptyUuid(input.shiftId, "shiftId");
  const supabase = input.client ?? supabaseAdmin();

  const existing = await loadShiftForTenant(tid, shiftId, supabase);
  if (!existing) throw new Error("Shift not found.");

  const editEligibility = canEditRosterShift(toAuditSnapshot(existing));
  if (!editEligibility.editable) {
    throw new Error(editEligibility.reason);
  }

  if (input.staffId !== undefined) {
    const requestedStaffId = input.staffId.trim();
    if (requestedStaffId && requestedStaffId !== existing.staff_id) {
      throw new Error("Staff reassignment is not supported.");
    }
  }

  const nextStaffId = existing.staff_id;
  const nextStartsAt = input.startsAt ?? existing.starts_at;
  const nextEndsAt = input.endsAt ?? existing.ends_at;
  const nextShiftType = input.shiftType ?? existing.shift_type;
  const nextClinicId =
    input.clinicId !== undefined ? input.clinicId?.trim() || null : existing.clinic_id;
  const nextNotes =
    input.notes !== undefined ? input.notes?.trim() || null : existing.notes?.trim() || null;

  if (Date.parse(nextEndsAt) <= Date.parse(nextStartsAt)) {
    throw new Error("Shift end must be after start.");
  }

  const changedFields: string[] = [];
  if (nextStartsAt !== existing.starts_at) changedFields.push("starts_at");
  if (nextEndsAt !== existing.ends_at) changedFields.push("ends_at");
  if (nextShiftType !== existing.shift_type) changedFields.push("shift_type");
  if (nextClinicId !== (existing.clinic_id?.trim() || null)) changedFields.push("clinic_id");
  if (nextNotes !== (existing.notes?.trim() || null)) changedFields.push("notes");

  if (changedFields.length === 0) {
    return {
      shift: existing,
      warnings: [],
      outcome: ROSTER_SHIFT_UPDATE_OUTCOMES.SHIFT_UNCHANGED,
    };
  }

  if (rosterShiftEditRequiresReason(changedFields)) {
    if (!isValidRosterShiftEditReason(input.editReason)) {
      throw new Error(ROSTER_SHIFT_EDIT_REASON_REQUIRED_MESSAGE);
    }
  }

  const { warnings } = await evaluateStaffShiftAssignmentWarnings({
    tenantId: tid,
    staffId: nextStaffId,
    clinicId: nextClinicId,
    shiftType: nextShiftType,
    startsAt: nextStartsAt,
    endsAt: nextEndsAt,
    allowOverride: input.allowOverride,
    excludeShiftId: shiftId,
    client: supabase,
  });

  const blocking = warnings.filter((w) => w.blocking);
  if (blocking.length > 0) {
    throw new Error(blocking.map((w) => w.message).join(" "));
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    updated_at: now,
    updated_by: input.updatedBy,
  };
  if (changedFields.includes("starts_at")) patch.starts_at = nextStartsAt;
  if (changedFields.includes("ends_at")) patch.ends_at = nextEndsAt;
  if (changedFields.includes("shift_type")) patch.shift_type = nextShiftType;
  if (changedFields.includes("clinic_id")) patch.clinic_id = nextClinicId;
  if (changedFields.includes("notes")) patch.notes = nextNotes;
  if (input.status) patch.status = input.status;

  const { data, error } = await supabase
    .from("fi_staff_shifts")
    .update(patch)
    .eq("tenant_id", tid)
    .eq("id", shiftId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not update shift.");

  const shift = mapShiftRow(data as Record<string, unknown>);
  await insertRosterShiftAuditEvent({
    tenantId: tid,
    shiftId: shift.id,
    staffId: shift.staff_id,
    actorFiUserId: input.updatedBy,
    actionType: ROSTER_SHIFT_AUDIT_ACTION_TYPES.SHIFT_UPDATED_MANUAL,
    reason: rosterShiftEditRequiresReason(changedFields)
      ? (input.editReason as RosterShiftEditReason)
      : null,
    oldValues: shiftSnapshotForAudit(toAuditSnapshot(existing)),
    newValues: shiftSnapshotForAudit(toAuditSnapshot(shift)),
    metadata: rosterShiftEditAuditMetadata({
      changedFields,
      notes: input.notes,
    }),
    client: supabase,
  });

  return {
    shift,
    warnings,
    outcome: ROSTER_SHIFT_UPDATE_OUTCOMES.SHIFT_UPDATED,
  };
}

export async function cancelStaffShiftWithReason(input: {
  tenantId: string;
  shiftId: string;
  cancellationReason: RosterShiftCancellationReason | string;
  updatedBy: string;
  notes?: string | null;
  hardDeleteGeneratedDraft?: boolean;
  client?: SupabaseClient;
}): Promise<FiStaffShiftRow> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const shiftId = assertNonEmptyUuid(input.shiftId, "shiftId");
  const supabase = input.client ?? supabaseAdmin();

  const existing = await loadShiftForTenant(tid, shiftId, supabase);
  if (!existing) throw new Error("Shift not found.");
  if (existing.status === "cancelled") return existing;

  const cancellationMetadata = rosterShiftCancellationAuditMetadata(input.notes);

  if (input.hardDeleteGeneratedDraft && canHardDeleteGeneratedDraftShift(toAuditSnapshot(existing))) {
    const { error } = await supabase
      .from("fi_staff_shifts")
      .delete()
      .eq("tenant_id", tid)
      .eq("id", shiftId)
      .eq("status", "scheduled")
      .in("shift_source", ["standard_hours", "copy_week"]);
    if (error) throw new Error(error.message);

    await insertRosterShiftAuditEvent({
      tenantId: tid,
      shiftId,
      staffId: existing.staff_id,
      actorFiUserId: input.updatedBy,
      actionType: ROSTER_SHIFT_AUDIT_ACTION_TYPES.SHIFT_REMOVED_GENERATED,
      reason: input.cancellationReason,
      oldValues: shiftSnapshotForAudit(toAuditSnapshot(existing)),
      newValues: { deleted: true },
      metadata: cancellationMetadata,
      client: supabase,
    });

    return { ...existing, status: "cancelled" };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_staff_shifts")
    .update({
      status: "cancelled",
      cancellation_reason: input.cancellationReason,
      updated_at: now,
      updated_by: input.updatedBy,
    })
    .eq("tenant_id", tid)
    .eq("id", shiftId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not cancel shift.");

  const shift = mapShiftRow(data as Record<string, unknown>);
  await insertRosterShiftAuditEvent({
    tenantId: tid,
    shiftId: shift.id,
    staffId: shift.staff_id,
    actorFiUserId: input.updatedBy,
    actionType: ROSTER_SHIFT_AUDIT_ACTION_TYPES.SHIFT_CANCELLED,
    reason: input.cancellationReason,
    oldValues: shiftSnapshotForAudit(toAuditSnapshot(existing)),
    newValues: shiftSnapshotForAudit(toAuditSnapshot(shift)),
    metadata: cancellationMetadata,
    client: supabase,
  });

  return shift;
}

export async function clearGeneratedRosterShiftsForPeriod(input: {
  tenantId: string;
  rangeStartIso: string;
  rangeEndIso: string;
  staffIds?: string[];
  updatedBy: string;
  client?: SupabaseClient;
}): Promise<{ cancelledCount: number }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();

  if (input.staffIds?.length) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("fi_staff_shifts")
      .update({
        status: "cancelled",
        cancellation_reason: "clear_generated_roster",
        updated_at: now,
        updated_by: input.updatedBy,
      })
      .eq("tenant_id", tid)
      .eq("status", "scheduled")
      .in("shift_source", ["standard_hours", "copy_week"])
      .gte("starts_at", input.rangeStartIso)
      .lt("starts_at", input.rangeEndIso)
      .in("staff_id", input.staffIds)
      .select("id");

    if (error) throw new Error(error.message);
    const cancelledCount = data?.length ?? 0;
    if (cancelledCount > 0) {
      await insertRosterShiftAuditEvent({
        tenantId: tid,
        actorFiUserId: input.updatedBy,
        actionType: ROSTER_SHIFT_AUDIT_ACTION_TYPES.SHIFT_REMOVED_GENERATED,
        reason: "clear_generated_roster",
        metadata: {
          range_start: input.rangeStartIso,
          range_end: input.rangeEndIso,
          staff_ids: input.staffIds,
          cancelled_count: cancelledCount,
        },
        client: supabase,
      });
    }
    return { cancelledCount };
  }

  const { data, error } = await supabase.rpc("fi_clear_generated_roster_shifts", {
    p_tenant_id: tid,
    p_range_start: input.rangeStartIso,
    p_range_end: input.rangeEndIso,
    p_updated_by: input.updatedBy,
    p_cancellation_reason: "clear_generated_roster",
  });
  if (error) throw new Error(error.message);

  const cancelledCount = Number((data as { cancelled_count?: number })?.cancelled_count ?? 0);
  if (cancelledCount > 0) {
    await insertRosterShiftAuditEvent({
      tenantId: tid,
      actorFiUserId: input.updatedBy,
      actionType: ROSTER_SHIFT_AUDIT_ACTION_TYPES.SHIFT_REMOVED_GENERATED,
      reason: "clear_generated_roster",
      metadata: {
        range_start: input.rangeStartIso,
        range_end: input.rangeEndIso,
        cancelled_count: cancelledCount,
      },
      client: supabase,
    });
  }

  return { cancelledCount };
}

export type MarkStaffSickForShiftResult = {
  cancelledShift: FiStaffShiftRow;
  sickBlock: FiStaffAvailabilityBlockRow;
  replacementCandidates: RosterAssignableCandidate[];
};

export async function markStaffSickForShift(input: {
  tenantId: string;
  shiftId: string;
  updatedBy: string;
  notes?: string | null;
  client?: SupabaseClient;
}): Promise<MarkStaffSickForShiftResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const shiftId = assertNonEmptyUuid(input.shiftId, "shiftId");
  const supabase = input.client ?? supabaseAdmin();

  const existing = await loadShiftForTenant(tid, shiftId, supabase);
  if (!existing) throw new Error("Shift not found.");
  if (existing.status === "cancelled") throw new Error("Shift is already cancelled.");

  const sickBlock = await createAvailabilityBlock({
    tenantId: tid,
    staffId: existing.staff_id,
    clinicId: existing.clinic_id,
    blockType: "sick_leave",
    startsAt: existing.starts_at,
    endsAt: existing.ends_at,
    reason: input.notes?.trim() || "Staff called in sick",
    createdBy: input.updatedBy,
    client: supabase,
  });

  const cancelledShift = await cancelStaffShiftWithReason({
    tenantId: tid,
    shiftId,
    cancellationReason: "staff_sick",
    updatedBy: input.updatedBy,
    client: supabase,
  });

  await insertRosterShiftAuditEvent({
    tenantId: tid,
    shiftId: cancelledShift.id,
    staffId: existing.staff_id,
    actorFiUserId: input.updatedBy,
    actionType: ROSTER_SHIFT_AUDIT_ACTION_TYPES.STAFF_MARKED_SICK_FOR_SHIFT,
    reason: "staff_sick",
    oldValues: shiftSnapshotForAudit(toAuditSnapshot(existing)),
    newValues: {
      shift: shiftSnapshotForAudit(toAuditSnapshot(cancelledShift)),
      sick_block_id: sickBlock.id,
    },
    client: supabase,
  });

  const replacementCandidates = await loadReplacementStaffForShift({
    tenantId: tid,
    excludeStaffId: existing.staff_id,
    clinicId: existing.clinic_id,
    shiftType: existing.shift_type,
    startsAt: existing.starts_at,
    endsAt: existing.ends_at,
    client: supabase,
  });

  return { cancelledShift, sickBlock, replacementCandidates };
}

export async function loadReplacementStaffForShift(input: {
  tenantId: string;
  excludeStaffId: string;
  clinicId?: string | null;
  shiftType: string;
  startsAt: string;
  endsAt: string;
  client?: SupabaseClient;
}): Promise<RosterAssignableCandidate[]> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();
  const localDate = input.startsAt.slice(0, 10);

  const allStaff = await loadAllStaffForTenant(tid, supabase);
  const ctx = await loadRosterStaffEligibilityContext(tid, {
    periodDayDates: [localDate],
    client: supabase,
  });

  const eligibleStaff = allStaff.filter((staff) => {
    if (staff.id === input.excludeStaffId) return false;
    return ctx.eligibilityByStaffId.get(staff.id)?.eligible === true;
  });

  const staffList = await Promise.all(
    eligibleStaff.map(async (staff) => {
      const { data: sourceRows } = await supabase
        .from("fi_staff_source_ids")
        .select("source_system, source_staff_id, source_url, metadata")
        .eq("tenant_id", tid)
        .eq("staff_id", staff.id);

      return {
        staffId: staff.id,
        name: staff.full_name,
        role: staff.staff_role,
        isActive: staff.is_active,
        clinicId:
          staff.staff_metadata &&
          typeof staff.staff_metadata === "object" &&
          !Array.isArray(staff.staff_metadata)
            ? ((staff.staff_metadata as Record<string, unknown>).primary_clinic_id as
                | string
                | null
                | undefined)
            : null,
        readinessInput: buildWorkforceReadinessInputFromSourceRows(
          staff,
          (sourceRows ?? []).map((r) => ({
            source_system: String(r.source_system),
            source_staff_id: String(r.source_staff_id ?? ""),
            source_url: r.source_url,
            metadata:
              r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
                ? (r.metadata as Record<string, unknown>)
                : null,
          }))
        ),
      };
    })
  );

  const availabilityByStaff = new Map<
    string,
    import("@/src/lib/workforce-os/workforceRosteringEngine").StaffAvailabilityRangeInput
  >();
  const conflictsByStaff = new Map<
    string,
    ReturnType<typeof detectStaffSchedulingConflicts>
  >();

  for (const staff of eligibleStaff) {
    const [blocksRes, shiftsRes] = await Promise.all([
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
    ]);
    if (blocksRes.error) throw new Error(blocksRes.error.message);
    if (shiftsRes.error) throw new Error(shiftsRes.error.message);

    const blocks = (blocksRes.data ?? []).map(
      (r) =>
        ({
          block_type: r.block_type,
          starts_at: String(r.starts_at),
          ends_at: String(r.ends_at),
          status: String(r.status),
        }) as StaffAvailabilityBlockRecord
    );
    const shifts = (shiftsRes.data ?? []).map(
      (r) =>
        ({
          id: String(r.id),
          shift_type: String(r.shift_type),
          starts_at: String(r.starts_at),
          ends_at: String(r.ends_at),
          status: String(r.status),
        }) as StaffShiftRecord
    );

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
        eventAssignments: [],
      })
    );
  }

  const assignedRole = input.shiftType.replace(/_day$/, "").replace(/_/g, " ");
  return rankAssignableStaffForRole({
    tenantId: tid,
    clinicId: input.clinicId,
    eventType: input.shiftType,
    assignedRole,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    existingAssignments: [],
    staffList,
    availabilityByStaff,
    conflictsByStaff,
  });
}

export async function createReplacementShiftForSickCover(input: {
  tenantId: string;
  originalShiftId: string;
  replacementStaffId: string;
  updatedBy: string;
  notes?: string | null;
  allowOverride?: boolean;
  client?: SupabaseClient;
}): Promise<{ shift: FiStaffShiftRow; warnings: RosterShiftValidationWarning[] }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();

  const original = await loadShiftForTenant(tid, input.originalShiftId, supabase);
  if (!original) throw new Error("Original shift not found.");

  const { warnings } = await evaluateStaffShiftAssignmentWarnings({
    tenantId: tid,
    staffId: input.replacementStaffId,
    clinicId: original.clinic_id,
    shiftType: original.shift_type,
    startsAt: original.starts_at,
    endsAt: original.ends_at,
    allowOverride: input.allowOverride,
    client: supabase,
  });
  const blocking = warnings.filter((w) => w.blocking);
  if (blocking.length > 0) {
    throw new Error(blocking.map((w) => w.message).join(" "));
  }

  const shift = await createStaffShift({
    tenantId: tid,
    staffId: input.replacementStaffId,
    clinicId: original.clinic_id,
    shiftType: original.shift_type,
    startsAt: original.starts_at,
    endsAt: original.ends_at,
    notes: input.notes?.trim() || `Sick cover for shift ${original.id}`,
    createdBy: input.updatedBy,
    shiftSource: "manual",
    adjustmentReason: "sick_cover",
    client: supabase,
  });

  await insertRosterShiftAuditEvent({
    tenantId: tid,
    shiftId: shift.id,
    staffId: shift.staff_id,
    actorFiUserId: input.updatedBy,
    actionType: ROSTER_SHIFT_AUDIT_ACTION_TYPES.REPLACEMENT_SHIFT_CREATED,
    reason: "sick_cover",
    oldValues: { original_shift_id: original.id, original_staff_id: original.staff_id },
    newValues: shiftSnapshotForAudit(toAuditSnapshot(shift)),
    metadata: { original_shift_id: original.id },
    client: supabase,
  });

  return { shift, warnings };
}
