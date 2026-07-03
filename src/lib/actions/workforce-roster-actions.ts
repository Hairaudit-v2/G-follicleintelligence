"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CrmAccessError } from "@/src/lib/crm/crmGate";
import {
  assertHrOsRosterManageAllowed,
  loadBookingForRosterEvent,
} from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import { resolveWorkforceEventTypeFromBooking } from "@/src/lib/workforce-os/workforceClinicalEventMapping";
import {
  assignStaffToClinicalEventAction,
  cancelAvailabilityBlock,
  cancelStaffEventAssignment,
  cancelStaffShift,
  createAvailabilityBlock,
  createStaffShift,
  type FiStaffAvailabilityBlockRow,
  type FiStaffEventAssignmentRow,
  type FiStaffShiftRow,
} from "@/src/lib/workforce-os/workforceRostering.server";
import {
  copyPreviousRosterPeriodForTenant,
  copyPreviousWeekRosterForTenant,
  generateRosterFromStandardHoursForTenant,
} from "@/src/lib/workforce-os/rosterGeneration.server";
import { resolveCurrentTenantFiUserId } from "@/src/lib/workforce-os/resolveCurrentTenantFiUserId.server";
import {
  saveStaffStandardHours,
  type SaveStaffStandardHoursResult,
} from "@/src/lib/workforce-os/staffStandardHours.server";
import type { StaffStandardHoursDayInput } from "@/src/lib/workforce-os/staffStandardHoursCore";

const eventSourceSchema = z.enum(["booking", "surgery", "calendar", "manual"]);
const availabilityBlockTypeSchema = z.enum([
  "unavailable",
  "leave",
  "sick_leave",
  "training",
  "admin",
  "available_override",
]);

const assignStaffSchema = z.object({
  tenantId: z.string().uuid(),
  clinicId: z.string().uuid().optional().nullable(),
  eventSource: eventSourceSchema,
  eventId: z.string().uuid(),
  staffId: z.string().uuid(),
  assignedRole: z.string().min(1).max(64),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  eventType: z.string().optional().nullable(),
  allowBlockedDraft: z.boolean().optional(),
});

const removeStaffSchema = z.object({
  tenantId: z.string().uuid(),
  assignmentId: z.string().uuid(),
});

const createShiftSchema = z.object({
  tenantId: z.string().uuid(),
  clinicId: z.string().uuid().optional().nullable(),
  staffId: z.string().uuid(),
  shiftType: z.string().min(1).max(64),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  notes: z.string().max(500).optional().nullable(),
});

const createBlockSchema = z.object({
  tenantId: z.string().uuid(),
  clinicId: z.string().uuid().optional().nullable(),
  staffId: z.string().uuid(),
  blockType: availabilityBlockTypeSchema,
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  reason: z.string().max(500).optional().nullable(),
});

const cancelShiftSchema = z.object({
  tenantId: z.string().uuid(),
  shiftId: z.string().uuid(),
});

const cancelBlockSchema = z.object({
  tenantId: z.string().uuid(),
  blockId: z.string().uuid(),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateRosterSurfaces(tenantId: string): void {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/hr-os`);
  revalidatePath(`/fi-admin/${tid}/hr-os/roster`);
  revalidatePath(`/fi-admin/${tid}/workforce-os/roster`);
  revalidatePath(`/fi-admin/${tid}/workforce-os/roster/standard-hours`);
  revalidatePath(`/fi-admin/${tid}/calendar`);
  revalidatePath(`/fi-admin/${tid}/tomorrow`);
  revalidatePath(`/fi-admin/${tid}/surgery-readiness`);
  revalidatePath(`/fi-admin/${tid}/procedure-day`);
  revalidatePath(`/fi-admin/${tid}/appointments`);
}

async function resolveRosterActorFiUserId(tenantId: string): Promise<string> {
  return resolveCurrentTenantFiUserId({
    supabase: supabaseAdmin(),
    tenantId,
  });
}

// TODO(workforce-audit): Wire fi_staff roster audit events when a dedicated workforce audit table ships.
async function logRosterAuditEvent(_metadata: Record<string, unknown>): Promise<void> {
  return;
}

export type WorkforceRosterActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function assignStaffToRosterEventAction(
  body: unknown
): Promise<WorkforceRosterActionResult<FiStaffEventAssignmentRow>> {
  try {
    const parsed = assignStaffSchema.parse(body);
    await assertHrOsRosterManageAllowed(parsed.tenantId);
    const actorFiUserId = await resolveRosterActorFiUserId(parsed.tenantId);

    let eventType = parsed.eventType?.trim().toLowerCase() || null;
    if (!eventType && parsed.eventSource === "booking") {
      const booking = await loadBookingForRosterEvent(parsed.tenantId, parsed.eventId);
      if (booking) eventType = resolveWorkforceEventTypeFromBooking(booking);
    }

    const assignment = await assignStaffToClinicalEventAction({
      tenantId: parsed.tenantId,
      clinicId: parsed.clinicId,
      eventSource: parsed.eventSource,
      eventId: parsed.eventId,
      staffId: parsed.staffId,
      assignedRole: parsed.assignedRole,
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      assignedBy: actorFiUserId,
      allowBlockedDraft: parsed.allowBlockedDraft ?? false,
      eventType,
    });

    await logRosterAuditEvent({
      action: "staff_assigned_to_event",
      event_source: parsed.eventSource,
      event_id: parsed.eventId,
      staff_id: parsed.staffId,
      assigned_role: parsed.assignedRole,
      readiness_score: assignment.readiness_score,
      readiness_band: assignment.readiness_band,
      warnings: assignment.warnings,
      blocking_issues: assignment.blocking_issues,
      actor_user_id: actorFiUserId,
    });

    revalidateRosterSurfaces(parsed.tenantId);
    return { ok: true, data: assignment };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function removeStaffFromRosterEventAction(
  body: unknown
): Promise<WorkforceRosterActionResult<FiStaffEventAssignmentRow>> {
  try {
    const parsed = removeStaffSchema.parse(body);
    await assertHrOsRosterManageAllowed(parsed.tenantId);
    const actorFiUserId = await resolveRosterActorFiUserId(parsed.tenantId);

    const assignment = await cancelStaffEventAssignment(parsed.tenantId, parsed.assignmentId);

    await logRosterAuditEvent({
      action: "staff_removed_from_event",
      event_source: assignment.event_source,
      event_id: assignment.event_id,
      staff_id: assignment.staff_id,
      assigned_role: assignment.assigned_role,
      actor_user_id: actorFiUserId,
    });

    revalidateRosterSurfaces(parsed.tenantId);
    return { ok: true, data: assignment };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createRosterShiftAction(
  body: unknown
): Promise<WorkforceRosterActionResult<FiStaffShiftRow>> {
  try {
    const parsed = createShiftSchema.parse(body);
    await assertHrOsRosterManageAllowed(parsed.tenantId);
    const actorFiUserId = await resolveRosterActorFiUserId(parsed.tenantId);

    if (Date.parse(parsed.endsAt) <= Date.parse(parsed.startsAt)) {
      return { ok: false, error: "Shift end must be after start." };
    }

    const shift = await createStaffShift({
      tenantId: parsed.tenantId,
      clinicId: parsed.clinicId,
      staffId: parsed.staffId,
      shiftType: parsed.shiftType,
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      notes: parsed.notes,
      createdBy: actorFiUserId,
    });

    await logRosterAuditEvent({
      action: "shift_created",
      staff_id: parsed.staffId,
      shift_id: shift.id,
      actor_user_id: actorFiUserId,
    });

    revalidateRosterSurfaces(parsed.tenantId);
    return { ok: true, data: shift };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createAvailabilityBlockAction(
  body: unknown
): Promise<WorkforceRosterActionResult<FiStaffAvailabilityBlockRow>> {
  try {
    const parsed = createBlockSchema.parse(body);
    await assertHrOsRosterManageAllowed(parsed.tenantId);
    const actorFiUserId = await resolveRosterActorFiUserId(parsed.tenantId);

    if (Date.parse(parsed.endsAt) <= Date.parse(parsed.startsAt)) {
      return { ok: false, error: "Availability block end must be after start." };
    }

    const block = await createAvailabilityBlock({
      tenantId: parsed.tenantId,
      clinicId: parsed.clinicId,
      staffId: parsed.staffId,
      blockType: parsed.blockType,
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      reason: parsed.reason,
      createdBy: actorFiUserId,
    });

    await logRosterAuditEvent({
      action: "availability_block_created",
      staff_id: parsed.staffId,
      block_id: block.id,
      actor_user_id: actorFiUserId,
    });

    revalidateRosterSurfaces(parsed.tenantId);
    return { ok: true, data: block };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function cancelRosterShiftAction(
  body: unknown
): Promise<WorkforceRosterActionResult<FiStaffShiftRow>> {
  try {
    const parsed = cancelShiftSchema.parse(body);
    await assertHrOsRosterManageAllowed(parsed.tenantId);
    const actorFiUserId = await resolveRosterActorFiUserId(parsed.tenantId);

    const shift = await cancelStaffShift(parsed.tenantId, parsed.shiftId);

    await logRosterAuditEvent({
      action: "shift_cancelled",
      shift_id: shift.id,
      staff_id: shift.staff_id,
      actor_user_id: actorFiUserId,
    });

    revalidateRosterSurfaces(parsed.tenantId);
    return { ok: true, data: shift };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function cancelAvailabilityBlockAction(
  body: unknown
): Promise<WorkforceRosterActionResult<FiStaffAvailabilityBlockRow>> {
  try {
    const parsed = cancelBlockSchema.parse(body);
    await assertHrOsRosterManageAllowed(parsed.tenantId);
    const actorFiUserId = await resolveRosterActorFiUserId(parsed.tenantId);

    const block = await cancelAvailabilityBlock(parsed.tenantId, parsed.blockId);

    await logRosterAuditEvent({
      action: "availability_block_cancelled",
      block_id: block.id,
      staff_id: block.staff_id,
      actor_user_id: actorFiUserId,
    });

    revalidateRosterSurfaces(parsed.tenantId);
    return { ok: true, data: block };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const saveStandardHoursSchema = z.object({
  tenantId: z.string().uuid(),
  staffId: z.string().uuid(),
  days: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      cycle_week: z.number().int().min(1).max(2).optional(),
      is_working_day: z.boolean(),
      start_time: z.string().nullable(),
      end_time: z.string().nullable(),
      break_minutes: z.number().int().min(0).max(480).nullable().optional(),
      clinic_id: z.string().uuid().nullable().optional(),
      shift_label: z.string().max(64).nullable().optional(),
      role_code: z.string().max(64).nullable().optional(),
    })
  ),
});

const generateRosterSchema = z.object({
  tenantId: z.string().uuid(),
  rangeStartIso: z.string().min(1),
  rangeEndIso: z.string().min(1),
  staffIds: z.array(z.string().uuid()).optional(),
  overwriteGeneratedOnly: z.boolean().optional(),
});

const copyPeriodSchema = z.object({
  tenantId: z.string().uuid(),
  targetPeriodStartIso: z.string().min(1),
  staffIds: z.array(z.string().uuid()).optional(),
});

const copyWeekSchema = z.object({
  tenantId: z.string().uuid(),
  targetWeekStartIso: z.string().min(1),
  staffIds: z.array(z.string().uuid()).optional(),
});

const applyDefaultClinicStandardHoursSchema = z.object({
  tenantId: z.string().uuid(),
});

export async function applyDefaultClinicStandardHoursAction(
  body: unknown
): Promise<
  WorkforceRosterActionResult<{
    appliedCount: number;
    skippedCount: number;
    appliedStaffIds: string[];
  }>
> {
  try {
    const parsed = applyDefaultClinicStandardHoursSchema.parse(body);
    await assertHrOsRosterManageAllowed(parsed.tenantId);
    const { applyDefaultClinicStandardHoursToMissingStaff } = await import(
      "@/src/lib/workforce-os/staffStandardHours.server"
    );
    const result = await applyDefaultClinicStandardHoursToMissingStaff(parsed.tenantId);
    revalidateRosterSurfaces(parsed.tenantId);
    return {
      ok: true,
      data: {
        appliedCount: result.appliedCount,
        skippedCount: result.skippedCount,
        appliedStaffIds: result.appliedStaffIds,
      },
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function saveStaffStandardHoursAction(
  body: unknown
): Promise<WorkforceRosterActionResult<SaveStaffStandardHoursResult>> {
  try {
    const parsed = saveStandardHoursSchema.parse(body);
    await assertHrOsRosterManageAllowed(parsed.tenantId);
    const result = await saveStaffStandardHours({
      tenantId: parsed.tenantId,
      staffId: parsed.staffId,
      days: parsed.days as StaffStandardHoursDayInput[],
    });
    if (!result.validation.valid) {
      return {
        ok: false,
        error: result.validation.warnings.map((w) => w.message).join(" "),
      };
    }
    revalidateRosterSurfaces(parsed.tenantId);
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function generateRosterFromStandardHoursAction(body: unknown): Promise<
  WorkforceRosterActionResult<{
    createdCount: number;
    replacedCount: number;
    skippedCount: number;
    cadence: string;
    summary: {
      generatedCount: number;
      skippedManualCount: number;
      skippedLeaveCount: number;
      skippedUnavailableCount: number;
      skippedDuplicateCount: number;
    };
  }>
> {
  try {
    const parsed = generateRosterSchema.parse(body);
    await assertHrOsRosterManageAllowed(parsed.tenantId);
    const actorFiUserId = await resolveRosterActorFiUserId(parsed.tenantId);

    const result = await generateRosterFromStandardHoursForTenant({
      tenantId: parsed.tenantId,
      rangeStartIso: parsed.rangeStartIso,
      rangeEndIso: parsed.rangeEndIso,
      staffIds: parsed.staffIds,
      overwriteGeneratedOnly: parsed.overwriteGeneratedOnly,
      createdBy: actorFiUserId,
    });

    await logRosterAuditEvent({
      action: "roster_generated_from_standard_hours",
      created_count: result.createdCount,
      replaced_count: result.replacedCount,
      cadence: result.cadence,
      actor_user_id: actorFiUserId,
    });

    revalidateRosterSurfaces(parsed.tenantId);
    return {
      ok: true,
      data: {
        createdCount: result.createdCount,
        replacedCount: result.replacedCount,
        skippedCount: result.skips.length,
        cadence: result.cadence,
        summary: {
          generatedCount: result.summary.generatedCount,
          skippedManualCount: result.summary.skippedManualCount,
          skippedLeaveCount: result.summary.skippedLeaveCount,
          skippedUnavailableCount: result.summary.skippedUnavailableCount,
          skippedDuplicateCount: result.summary.skippedDuplicateCount,
        },
      },
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function copyPreviousRosterPeriodAction(body: unknown): Promise<
  WorkforceRosterActionResult<{ createdCount: number; cadence: string }>
> {
  try {
    const parsed = copyPeriodSchema.parse(body);
    await assertHrOsRosterManageAllowed(parsed.tenantId);
    const actorFiUserId = await resolveRosterActorFiUserId(parsed.tenantId);

    const result = await copyPreviousRosterPeriodForTenant({
      tenantId: parsed.tenantId,
      targetPeriodStartIso: parsed.targetPeriodStartIso,
      staffIds: parsed.staffIds,
      createdBy: actorFiUserId,
    });

    await logRosterAuditEvent({
      action: "roster_copied_previous_period",
      created_count: result.createdCount,
      cadence: result.cadence,
      actor_user_id: actorFiUserId,
    });

    revalidateRosterSurfaces(parsed.tenantId);
    return { ok: true, data: { createdCount: result.createdCount, cadence: result.cadence } };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function copyPreviousWeekRosterAction(body: unknown): Promise<
  WorkforceRosterActionResult<{ createdCount: number }>
> {
  try {
    const parsed = copyWeekSchema.parse(body);
    await assertHrOsRosterManageAllowed(parsed.tenantId);
    const actorFiUserId = await resolveRosterActorFiUserId(parsed.tenantId);

    const result = await copyPreviousWeekRosterForTenant({
      tenantId: parsed.tenantId,
      targetWeekStartIso: parsed.targetWeekStartIso,
      staffIds: parsed.staffIds,
      createdBy: actorFiUserId,
    });

    await logRosterAuditEvent({
      action: "roster_copied_previous_week",
      created_count: result.createdCount,
      actor_user_id: actorFiUserId,
    });

    revalidateRosterSurfaces(parsed.tenantId);
    return { ok: true, data: { createdCount: result.createdCount } };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
