#!/usr/bin/env node
/**
 * One-shot: rewrite workforceRosteringEngine.ts to consume team/roster/availability.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const p = path.join(ROOT, "src/lib/workforce-os/workforceRosteringEngine.ts");
let s = fs.readFileSync(p, "utf8");

const marker = "export function detectStaffSchedulingConflicts";
const idx = s.indexOf(marker);
if (idx < 0) throw new Error("marker not found");
const rest = s.slice(idx);

const header = `/**
 * WorkforceOS Phase 2C — clinical rostering engine (pure functions, no I/O).
 * Validates availability, conflicts, staffing templates, and clinical eligibility.
 *
 * Weekly template + effective UTC-range availability live in
 * \`@/src/lib/team/roster/availability\` (canonical). This module re-exports those
 * symbols for existing workforce-os call sites.
 */

export {
  getStaffAvailabilityForRange,
  parseTimeRangeMs,
  rangesOverlap,
  type AvailabilityBlockStatus,
  type AvailabilityBlockType,
  type ShiftStatus,
  type StaffAvailabilityBlockRecord,
  type StaffAvailabilityRangeInput,
  type StaffAvailabilityRangeResult,
  type StaffShiftRecord,
} from "@/src/lib/team/roster/availability";

import {
  BLOCKING_AVAILABILITY_BLOCK_TYPES,
  getStaffAvailabilityForRange,
  parseTimeRangeMs,
  rangesOverlap,
  type StaffAvailabilityBlockRecord,
  type StaffAvailabilityRangeInput,
  type StaffShiftRecord,
} from "@/src/lib/team/roster/availability";
import { canStaffBeAssignedClinically } from "@/src/lib/team/identity/workforceReadinessClinicalEligibility";
import type { StaffClinicalAssignmentResult } from "@/src/lib/team/identity/workforceReadinessClinicalEligibility";
import {
  canStaffBeAssignedToProcedure,
  type StaffProcedureAssignmentResult,
} from "@/src/lib/workforce-os/workforceProcedureClinicalEligibility";
import type { ProcedurePrivilegeEligibilityResult } from "@/src/lib/academy-os/procedurePrivilegeTypes";
import {
  normalizeRequiredRoles,
  type ClinicalStaffingRequiredRoles,
} from "@/src/lib/workforce-os/workforceClinicalStaffingTemplateDefaults";
import type { WorkforceReadinessScoreInput } from "@/src/lib/team/identity/workforceReadinessEngine";

// ---------------------------------------------------------------------------
// Shared types (engine-specific)
// ---------------------------------------------------------------------------

export type AssignmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "blocked";

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
  kind:
    | "shift_overlap"
    | "assignment_overlap"
    | "unavailable_block"
    | "leave_block"
    | "sick_leave_block";
  message: string;
  relatedId?: string;
};

export type CandidateAssignment = {
  staffId: string;
  assignedRole: string;
  readinessInput: WorkforceReadinessScoreInput;
  privilegeEligibility?: ProcedurePrivilegeEligibilityResult;
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
  /** When checking a shift update, exclude this shift id from overlap checks. */
  excludeShiftId?: string | null;
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
  | {
      ok: false;
      reason: string;
      readiness: StaffClinicalAssignmentResult;
      conflicts: SchedulingConflict[];
    };

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

`;

let out = header + rest;
out = out.replaceAll(
  "UNAVAILABLE_BLOCK_TYPES.includes(block.block_type)",
  "(BLOCKING_AVAILABILITY_BLOCK_TYPES as readonly string[]).includes(block.block_type)"
);

fs.writeFileSync(p, out);
console.log("rewrote", path.relative(ROOT, p), "bytes", out.length);
