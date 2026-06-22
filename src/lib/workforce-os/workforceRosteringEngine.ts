/**
 * WorkforceOS Phase 2C — clinical rostering engine (pure functions, no I/O).
 * Validates availability, conflicts, staffing templates, and clinical eligibility.
 */

import {
  isUtcRangeWithinStaffWeeklyHours,
  parseStaffWeeklyHours,
  DEFAULT_STAFF_HOURS_FALLBACK_TZ,
} from "@/src/lib/staff/staffWeeklyHours";
import { canStaffBeAssignedClinically } from "@/src/lib/workforce-os/workforceReadinessClinicalEligibility";
import type { StaffClinicalAssignmentResult } from "@/src/lib/workforce-os/workforceReadinessClinicalEligibility";
import {
  canStaffBeAssignedToProcedure,
  type StaffProcedureAssignmentResult,
} from "@/src/lib/workforce-os/workforceProcedureClinicalEligibility";
import type { ProcedurePrivilegeEligibilityResult } from "@/src/lib/academy-os/procedurePrivilegeTypes";
import {
  normalizeRequiredRoles,
  type ClinicalStaffingRequiredRoles,
} from "@/src/lib/workforce-os/workforceClinicalStaffingTemplateDefaults";
import type { WorkforceReadinessScoreInput } from "@/src/lib/workforce-os/workforceReadinessEngine";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type AvailabilityBlockType =
  | "unavailable"
  | "leave"
  | "sick_leave"
  | "training"
  | "admin"
  | "available_override";

export type AvailabilityBlockStatus = "active" | "cancelled";

export type ShiftStatus = "scheduled" | "confirmed" | "completed" | "cancelled";

export type AssignmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "blocked";

export type StaffAvailabilityBlockRecord = {
  id: string;
  block_type: AvailabilityBlockType;
  starts_at: string;
  ends_at: string;
  status: AvailabilityBlockStatus;
  reason?: string | null;
};

export type StaffShiftRecord = {
  id: string;
  shift_type: string;
  starts_at: string;
  ends_at: string;
  status: ShiftStatus;
};

export type StaffEventAssignmentRecord = {
  id: string;
  staff_id: string;
  assigned_role: string;
  assignment_status: AssignmentStatus;
  event_source: string;
  event_id?: string | null;
  /** Event window stored in eligibility_snapshot or passed by caller. */
  starts_at?: string | null;
  ends_at?: string | null;
};

export type ClinicalStaffingTemplateRecord = {
  id: string;
  tenant_id: string;
  clinic_id: string | null;
  event_type: string;
  required_roles: ClinicalStaffingRequiredRoles;
  is_active: boolean;
};

export type SchedulingConflict = {
  kind: "shift_overlap" | "assignment_overlap" | "unavailable_block" | "leave_block" | "sick_leave_block";
  message: string;
  relatedId?: string;
};

export type CandidateAssignment = {
  staffId: string;
  assignedRole: string;
  readinessInput: WorkforceReadinessScoreInput;
  privilegeEligibility?: ProcedurePrivilegeEligibilityResult;
};

export type StaffAvailabilityRangeInput = {
  staffId: string;
  startsAt: string;
  endsAt: string;
  workingHours: Record<string, unknown> | null | undefined;
  staffTimezone?: string | null;
  availabilityBlocks: StaffAvailabilityBlockRecord[];
  shifts: StaffShiftRecord[];
};

export type StaffAvailabilityRangeResult = {
  available: boolean;
  reasons: string[];
  activeBlocks: StaffAvailabilityBlockRecord[];
  matchingShifts: StaffShiftRecord[];
};

export type SchedulingConflictInput = {
  staffId: string;
  startsAt: string;
  endsAt: string;
  availabilityBlocks: StaffAvailabilityBlockRecord[];
  shifts: StaffShiftRecord[];
  eventAssignments: StaffEventAssignmentRecord[];
  /** When checking an update, exclude this assignment id from overlap checks. */
  excludeAssignmentId?: string | null;
};

export type ResolveClinicalStaffingTemplateInput = {
  eventType: string;
  clinicId?: string | null;
  templates: ClinicalStaffingTemplateRecord[];
};

export type ValidateClinicalEventStaffingInput = {
  eventType: string;
  startsAt: string;
  endsAt: string;
  requiredRoles: ClinicalStaffingRequiredRoles;
  candidateAssignments: CandidateAssignment[];
  availabilityByStaff: Map<string, StaffAvailabilityRangeInput>;
  conflictsByStaff: Map<string, SchedulingConflict[]>;
};

export type ValidateClinicalEventStaffingResult = {
  ready: boolean;
  readinessScore: number;
  requiredRoles: ClinicalStaffingRequiredRoles;
  assignedCounts: ClinicalStaffingRequiredRoles;
  missingRoles: Array<{ role: string; required: number; assigned: number }>;
  blockedAssignments: Array<{ staffId: string; role: string; reason: string }>;
  warnings: string[];
};

export type AssignStaffToClinicalEventInput = {
  tenantId: string;
  clinicId?: string | null;
  eventSource: "booking" | "surgery" | "calendar" | "manual";
  eventId?: string | null;
  staffId: string;
  assignedRole: string;
  startsAt: string;
  endsAt: string;
  assignedBy?: string | null;
  readinessInput: WorkforceReadinessScoreInput;
  privilegeEligibility?: ProcedurePrivilegeEligibilityResult;
  conflicts: SchedulingConflict[];
  allowBlockedDraft?: boolean;
};

function evaluateClinicalAssignment(input: {
  readinessInput: WorkforceReadinessScoreInput;
  privilegeEligibility?: ProcedurePrivilegeEligibilityResult;
}): StaffClinicalAssignmentResult | StaffProcedureAssignmentResult {
  if (input.privilegeEligibility) {
    return canStaffBeAssignedToProcedure({
      readinessInput: input.readinessInput,
      privilegeEligibility: input.privilegeEligibility,
    });
  }
  return canStaffBeAssignedClinically(input.readinessInput);
}

export type AssignStaffToClinicalEventResult =
  | {
      ok: true;
      assignmentStatus: "scheduled" | "blocked";
      readiness: StaffClinicalAssignmentResult;
      warnings: string[];
      blockingIssues: StaffClinicalAssignmentResult["blocking_issues"];
      eligibilitySnapshot: Record<string, unknown>;
    }
  | { ok: false; reason: string; readiness: StaffClinicalAssignmentResult; conflicts: SchedulingConflict[] };

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

export function parseTimeRangeMs(startsAt: string, endsAt: string): { startMs: number; endMs: number } | null {
  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return { startMs, endMs };
}

export function rangesOverlap(
  aStartMs: number,
  aEndMs: number,
  bStartMs: number,
  bEndMs: number
): boolean {
  return aStartMs < bEndMs && bStartMs < aEndMs;
}

const UNAVAILABLE_BLOCK_TYPES: AvailabilityBlockType[] = [
  "unavailable",
  "leave",
  "sick_leave",
  "training",
  "admin",
];

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

export function getStaffAvailabilityForRange(input: StaffAvailabilityRangeInput): StaffAvailabilityRangeResult {
  const range = parseTimeRangeMs(input.startsAt, input.endsAt);
  const reasons: string[] = [];
  const activeBlocks = input.availabilityBlocks.filter((b) => b.status === "active");

  const overlappingBlocks = activeBlocks.filter((b) => {
    const br = parseTimeRangeMs(b.starts_at, b.ends_at);
    return br && range && rangesOverlap(range.startMs, range.endMs, br.startMs, br.endMs);
  });

  const matchingShifts = input.shifts.filter((s) => {
    if (s.status === "cancelled") return false;
    const sr = parseTimeRangeMs(s.starts_at, s.ends_at);
    return sr && range && rangesOverlap(range.startMs, range.endMs, sr.startMs, sr.endMs);
  });

  const hasOverride = overlappingBlocks.some((b) => b.block_type === "available_override");
  const blockingBlocks = overlappingBlocks.filter((b) => UNAVAILABLE_BLOCK_TYPES.includes(b.block_type));

  if (blockingBlocks.length > 0) {
    for (const b of blockingBlocks) {
      reasons.push(`Active ${b.block_type.replace(/_/g, " ")} block`);
    }
  }

  let withinWorkingHours = false;
  if (range) {
    const weekly = parseStaffWeeklyHours(input.workingHours);
    const tz = input.staffTimezone?.trim() || DEFAULT_STAFF_HOURS_FALLBACK_TZ;
    withinWorkingHours = isUtcRangeWithinStaffWeeklyHours(range.startMs, range.endMs, weekly, tz);
    if (!withinWorkingHours && !hasOverride) {
      reasons.push("Outside configured weekly working hours");
    }
  }

  const available =
    (withinWorkingHours || hasOverride) &&
    blockingBlocks.length === 0 &&
    (matchingShifts.length > 0 || hasOverride || withinWorkingHours);

  if (available && matchingShifts.length === 0 && !hasOverride) {
    // Staff may still be available via working hours even without an explicit shift row.
  }

  return {
    available: blockingBlocks.length === 0 && (withinWorkingHours || hasOverride),
    reasons,
    activeBlocks: overlappingBlocks,
    matchingShifts,
  };
}

export function detectStaffSchedulingConflicts(input: SchedulingConflictInput): SchedulingConflict[] {
  const range = parseTimeRangeMs(input.startsAt, input.endsAt);
  if (!range) return [{ kind: "unavailable_block", message: "Invalid time range" }];

  const conflicts: SchedulingConflict[] = [];

  for (const block of input.availabilityBlocks) {
    if (block.status !== "active") continue;
    const br = parseTimeRangeMs(block.starts_at, block.ends_at);
    if (!br || !rangesOverlap(range.startMs, range.endMs, br.startMs, br.endMs)) continue;

    if (block.block_type === "leave") {
      conflicts.push({
        kind: "leave_block",
        message: "Staff has active leave during this period",
        relatedId: block.id,
      });
    } else if (block.block_type === "sick_leave") {
      conflicts.push({
        kind: "sick_leave_block",
        message: "Staff has sick leave during this period",
        relatedId: block.id,
      });
    } else if (UNAVAILABLE_BLOCK_TYPES.includes(block.block_type)) {
      conflicts.push({
        kind: "unavailable_block",
        message: `Staff unavailable (${block.block_type}) during this period`,
        relatedId: block.id,
      });
    }
  }

  for (const shift of input.shifts) {
    if (shift.status === "cancelled") continue;
    const sr = parseTimeRangeMs(shift.starts_at, shift.ends_at);
    if (!sr || !rangesOverlap(range.startMs, range.endMs, sr.startMs, sr.endMs)) continue;
    conflicts.push({
      kind: "shift_overlap",
      message: `Overlapping shift (${shift.shift_type})`,
      relatedId: shift.id,
    });
  }

  for (const assignment of input.eventAssignments) {
    if (assignment.assignment_status === "cancelled") continue;
    if (input.excludeAssignmentId && assignment.id === input.excludeAssignmentId) continue;
    const aStart = assignment.starts_at;
    const aEnd = assignment.ends_at;
    if (!aStart || !aEnd) continue;
    const ar = parseTimeRangeMs(aStart, aEnd);
    if (!ar || !rangesOverlap(range.startMs, range.endMs, ar.startMs, ar.endMs)) continue;
    conflicts.push({
      kind: "assignment_overlap",
      message: `Overlapping clinical event assignment (${assignment.assigned_role})`,
      relatedId: assignment.id,
    });
  }

  return conflicts;
}

export function resolveClinicalStaffingTemplate(
  input: ResolveClinicalStaffingTemplateInput
): ClinicalStaffingTemplateRecord | null {
  const eventType = input.eventType.trim().toLowerCase();
  const clinicId = input.clinicId?.trim() || null;
  const active = input.templates.filter((t) => t.is_active && t.event_type.trim().toLowerCase() === eventType);

  if (clinicId) {
    const clinicSpecific = active.find((t) => t.clinic_id === clinicId);
    if (clinicSpecific) return clinicSpecific;
  }

  return active.find((t) => t.clinic_id == null) ?? null;
}

export function countAssignedRoles(assignments: Array<{ assignedRole: string }>): ClinicalStaffingRequiredRoles {
  const counts: ClinicalStaffingRequiredRoles = {};
  for (const a of assignments) {
    const role = a.assignedRole.trim().toLowerCase();
    if (!role) continue;
    counts[role] = (counts[role] ?? 0) + 1;
  }
  return counts;
}

export function detectMissingRoles(
  required: ClinicalStaffingRequiredRoles,
  assigned: ClinicalStaffingRequiredRoles
): Array<{ role: string; required: number; assigned: number }> {
  const missing: Array<{ role: string; required: number; assigned: number }> = [];
  for (const [role, requiredCount] of Object.entries(required)) {
    const assignedCount = assigned[role] ?? 0;
    if (assignedCount < requiredCount) {
      missing.push({ role, required: requiredCount, assigned: assignedCount });
    }
  }
  return missing;
}

export function validateClinicalEventStaffing(
  input: ValidateClinicalEventStaffingInput
): ValidateClinicalEventStaffingResult {
  const requiredRoles = normalizeRequiredRoles(input.requiredRoles);
  const assignedCounts = countAssignedRoles(
    input.candidateAssignments.map((a) => ({ assignedRole: a.assignedRole }))
  );
  const missingRoles = detectMissingRoles(requiredRoles, assignedCounts);

  const blockedAssignments: ValidateClinicalEventStaffingResult["blockedAssignments"] = [];
  const warnings: string[] = [];
  const scores: number[] = [];

  for (const candidate of input.candidateAssignments) {
    const eligibility = evaluateClinicalAssignment({
      readinessInput: candidate.readinessInput,
      privilegeEligibility: candidate.privilegeEligibility,
    });
    scores.push(eligibility.score);

    if (!candidate.readinessInput.is_active) {
      blockedAssignments.push({
        staffId: candidate.staffId,
        role: candidate.assignedRole,
        reason: "Staff member is inactive",
      });
      continue;
    }

    if (!eligibility.eligible) {
      blockedAssignments.push({
        staffId: candidate.staffId,
        role: candidate.assignedRole,
        reason: eligibility.reason ?? "Not clinically eligible",
      });
    } else if (eligibility.warnings.length > 0) {
      warnings.push(
        `Staff ${candidate.staffId}: ${eligibility.warnings.length} readiness/privilege warning(s)`
      );
    }

    const availabilityInput = input.availabilityByStaff.get(candidate.staffId);
    if (availabilityInput) {
      const availability = getStaffAvailabilityForRange(availabilityInput);
      if (!availability.available) {
        blockedAssignments.push({
          staffId: candidate.staffId,
          role: candidate.assignedRole,
          reason: availability.reasons.join("; ") || "Not available",
        });
      }
    }

    const conflicts = input.conflictsByStaff.get(candidate.staffId) ?? [];
    if (conflicts.length > 0) {
      blockedAssignments.push({
        staffId: candidate.staffId,
        role: candidate.assignedRole,
        reason: conflicts.map((c) => c.message).join("; "),
      });
    }
  }

  const readinessScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const ready = missingRoles.length === 0 && blockedAssignments.length === 0;

  return {
    ready,
    readinessScore,
    requiredRoles,
    assignedCounts,
    missingRoles,
    blockedAssignments,
    warnings,
  };
}

export function assignStaffToClinicalEvent(
  input: AssignStaffToClinicalEventInput
): AssignStaffToClinicalEventResult {
  const readiness = evaluateClinicalAssignment({
    readinessInput: input.readinessInput,
    privilegeEligibility: input.privilegeEligibility,
  });

  if (input.conflicts.length > 0 && !input.allowBlockedDraft) {
    return {
      ok: false,
      reason: "Scheduling conflicts detected",
      readiness,
      conflicts: input.conflicts,
    };
  }

  const hardBlocked = !readiness.eligible && !input.allowBlockedDraft;
  if (hardBlocked) {
    return {
      ok: false,
      reason: readiness.reason ?? "Staff not clinically eligible",
      readiness,
      conflicts: input.conflicts,
    };
  }

  const assignmentStatus: "scheduled" | "blocked" =
    !readiness.eligible || input.conflicts.length > 0 ? "blocked" : "scheduled";

  const eligibilitySnapshot: Record<string, unknown> = {
    eligible: readiness.eligible,
    score: readiness.score,
    band: readiness.band,
    band_label: readiness.bandLabel,
    reason: readiness.reason,
    event_starts_at: input.startsAt,
    event_ends_at: input.endsAt,
    conflicts: input.conflicts.map((c) => ({ kind: c.kind, message: c.message })),
    assigned_at: new Date().toISOString(),
    ...("procedurePrivilegeSnapshot" in readiness
      ? (readiness as StaffProcedureAssignmentResult).procedurePrivilegeSnapshot
      : {}),
  };

  const warnings = [
    ...readiness.warnings.map((w) => String(w)),
    ...input.conflicts.map((c) => c.message),
  ];

  return {
    ok: true,
    assignmentStatus,
    readiness,
    warnings,
    blockingIssues: readiness.blocking_issues,
    eligibilitySnapshot,
  };
}

export function extractEventWindowFromSnapshot(
  snapshot: Record<string, unknown> | null | undefined
): { starts_at: string | null; ends_at: string | null } {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return { starts_at: null, ends_at: null };
  }
  const starts = typeof snapshot.event_starts_at === "string" ? snapshot.event_starts_at : null;
  const ends = typeof snapshot.event_ends_at === "string" ? snapshot.event_ends_at : null;
  return { starts_at: starts, ends_at: ends };
}
