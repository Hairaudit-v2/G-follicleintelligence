/**
 * WorkforceOS Phase 2E — assignment candidate ranking (pure, no I/O).
 */

import { canStaffBeAssignedClinically } from "@/src/lib/workforce-os/workforceReadinessClinicalEligibility";
import type { WorkforceReadinessScoreInput } from "@/src/lib/workforce-os/workforceReadinessEngine";
import {
  getStaffAvailabilityForRange,
  type SchedulingConflict,
  type StaffAvailabilityRangeInput,
} from "@/src/lib/workforce-os/workforceRosteringEngine";

export type RosterCandidateStaffInput = {
  staffId: string;
  name: string;
  role: string | null;
  isActive: boolean;
  clinicId?: string | null;
  readinessInput: WorkforceReadinessScoreInput;
};

export type RankAssignableStaffInput = {
  tenantId: string;
  clinicId?: string | null;
  eventType: string;
  assignedRole: string;
  startsAt: string;
  endsAt: string;
  existingAssignments: Array<{ staffId: string; assignedRole: string }>;
  staffList: RosterCandidateStaffInput[];
  availabilityByStaff: Map<string, StaffAvailabilityRangeInput>;
  conflictsByStaff: Map<string, SchedulingConflict[]>;
};

export type RosterCandidateSection = "eligible" | "warning" | "blocked";

export type RosterAssignableCandidate = {
  staffId: string;
  name: string;
  role: string | null;
  readinessScore: number;
  readinessBand: string;
  eligible: boolean;
  reasons: string[];
  warnings: string[];
  conflicts: SchedulingConflict[];
  rankScore: number;
  section: RosterCandidateSection;
};

function normalizeRole(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function staffAlreadyOnEvent(
  staffId: string,
  existingAssignments: RankAssignableStaffInput["existingAssignments"]
): boolean {
  return existingAssignments.some((row) => row.staffId.trim() === staffId.trim());
}

function roleMatches(staffRole: string | null, assignedRole: string): boolean {
  const target = normalizeRole(assignedRole);
  const role = normalizeRole(staffRole);
  if (!role || !target) return false;
  if (role === target) return true;
  const aliases: Record<string, string[]> = {
    surgeon: ["surgeon", "doctor"],
    doctor: ["doctor", "surgeon", "consultant"],
    consultant: ["consultant", "doctor", "clinician"],
    nurse: ["nurse"],
    technician: ["technician", "tech"],
  };
  return (aliases[target] ?? [target]).includes(role);
}

function computeRankScore(input: {
  readinessScore: number;
  roleMatch: boolean;
  clinicMatch: boolean;
  conflictCount: number;
  eligible: boolean;
  isActive: boolean;
}): number {
  if (!input.isActive) return -10_000;
  if (!input.eligible) return -5_000 + input.readinessScore;
  let score = input.readinessScore;
  if (input.roleMatch) score += 25;
  if (input.clinicMatch) score += 10;
  score -= input.conflictCount * 40;
  return score;
}

function resolveCandidateSection(input: {
  isActive: boolean;
  eligible: boolean;
  hasConflicts: boolean;
  unavailable: boolean;
  warningCount: number;
}): RosterCandidateSection {
  if (!input.isActive || !input.eligible || input.hasConflicts || input.unavailable) return "blocked";
  if (input.warningCount > 0) return "warning";
  return "eligible";
}

/**
 * Rank staff for a missing clinical role. Does not auto-assign — recommendations only.
 */
export function rankAssignableStaffForRole(input: RankAssignableStaffInput): RosterAssignableCandidate[] {
  const assignedRole = normalizeRole(input.assignedRole);
  const eventClinicId = input.clinicId?.trim() || null;
  const candidates: RosterAssignableCandidate[] = [];

  for (const staff of input.staffList) {
    if (staffAlreadyOnEvent(staff.staffId, input.existingAssignments)) continue;

    const conflicts = input.conflictsByStaff.get(staff.staffId) ?? [];
    const availabilityInput = input.availabilityByStaff.get(staff.staffId);
    const availability = availabilityInput
      ? getStaffAvailabilityForRange(availabilityInput)
      : { available: true, reasons: [] as string[], activeBlocks: [], matchingShifts: [] };

    const clinical = canStaffBeAssignedClinically(staff.readinessInput);
    const eligible = staff.isActive && clinical.eligible && availability.available && conflicts.length === 0;

    const reasons: string[] = [];
    if (!staff.isActive) reasons.push("Staff member is inactive");
    if (!clinical.eligible && clinical.reason) reasons.push(clinical.reason);
    if (!availability.available) reasons.push(...availability.reasons);
    if (conflicts.length) reasons.push(...conflicts.map((c) => c.message));

    const warnings = clinical.warnings.map(String);
    const section = resolveCandidateSection({
      isActive: staff.isActive,
      eligible,
      hasConflicts: conflicts.length > 0,
      unavailable: !availability.available,
      warningCount: warnings.length,
    });

    const rankScore = computeRankScore({
      readinessScore: clinical.score,
      roleMatch: roleMatches(staff.role, assignedRole),
      clinicMatch: Boolean(eventClinicId && staff.clinicId?.trim() === eventClinicId),
      conflictCount: conflicts.length,
      eligible,
      isActive: staff.isActive,
    });

    candidates.push({
      staffId: staff.staffId,
      name: staff.name,
      role: staff.role,
      readinessScore: clinical.score,
      readinessBand: clinical.band,
      eligible,
      reasons,
      warnings,
      conflicts,
      rankScore,
      section,
    });
  }

  const sectionOrder: Record<RosterCandidateSection, number> = { eligible: 0, warning: 1, blocked: 2 };
  return candidates.sort((a, b) => {
    const sectionDiff = sectionOrder[a.section] - sectionOrder[b.section];
    if (sectionDiff !== 0) return sectionDiff;
    return b.rankScore - a.rankScore;
  });
}

/** Guard against duplicate active assignment rows (staff + role + event). */
export function isDuplicateRosterAssignment(input: {
  staffId: string;
  assignedRole: string;
  existingAssignments: Array<{ staffId: string; assignedRole: string; assignmentStatus?: string }>;
}): boolean {
  const staffId = input.staffId.trim();
  const role = normalizeRole(input.assignedRole);
  return input.existingAssignments.some(
    (row) =>
      row.staffId.trim() === staffId &&
      normalizeRole(row.assignedRole) === role &&
      row.assignmentStatus !== "cancelled"
  );
}
