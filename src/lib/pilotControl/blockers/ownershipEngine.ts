/**
 * Deterministic ownership engine (1A.3).
 *
 * Precedence:
 * 1. Canonical source-record assignee
 * 2. Current journey / programme operational owner (programme_rule)
 * 3. Module default from blocker rule
 * 4. Escalation owner (when escalated)
 * 5. Unassigned
 *
 * High/critical blockers must not remain solely assigned to the patient.
 */

import type { PilotBlockerOwner } from "../pilotControlContracts";
import type { PilotBlockerCandidate, PilotBlockerOwnership, PilotEscalationState } from "./blockerTypes";

export type OwnershipInput = {
  candidate: PilotBlockerCandidate;
  escalation?: Pick<
    PilotEscalationState,
    "escalated" | "level" | "escalationOwnerType" | "escalationReason"
  >;
  /** Prefer escalation owner when true. */
  preferEscalationOwner?: boolean;
};

function ensureClinicSideOwnership(
  ownership: PilotBlockerOwnership,
  candidate: PilotBlockerCandidate,
  severityIsElevated: boolean
): PilotBlockerOwnership {
  if (ownership.ownerType !== "patient") return ownership;
  if (!severityIsElevated && candidate.baseSeverity !== "high" && candidate.baseSeverity !== "critical") {
    return {
      ...ownership,
      monitoringOwnerType: ownership.monitoringOwnerType ?? candidate.monitoringOwnerType ?? "reception",
    };
  }
  // High/critical cannot remain patient-only — promote monitoring owner to primary.
  const clinicOwner =
    ownership.monitoringOwnerType ??
    candidate.monitoringOwnerType ??
    candidate.escalationOwnerType ??
    "reception";
  return {
    ownerType: clinicOwner,
    ownerUserId: ownership.ownerUserId,
    ownerRole: ownership.ownerRole,
    assignmentSource: "escalation_rule",
    ownershipReason:
      "High/critical blocker reassigned from patient-only ownership to clinic-side owner",
    monitoringOwnerType: "reception",
    escalationOwnerType: candidate.escalationOwnerType ?? "clinic_manager",
  };
}

export function resolveBlockerOwnership(input: OwnershipInput): PilotBlockerOwnership {
  const { candidate, escalation, preferEscalationOwner } = input;
  const elevated =
    candidate.baseSeverity === "high" ||
    candidate.baseSeverity === "critical" ||
    candidate.criticalIntegrity ||
    escalation?.level === "high" ||
    escalation?.level === "critical";

  // 1. Canonical assignee
  if (candidate.canonicalAssigneeUserId) {
    const ownerType =
      (candidate.canonicalAssigneeRole as PilotBlockerOwner | undefined) &&
      [
        "patient",
        "reception",
        "consultant",
        "clinical",
        "finance",
        "clinic_manager",
        "technical",
        "director",
        "governance",
      ].includes(candidate.canonicalAssigneeRole!)
        ? (candidate.canonicalAssigneeRole as PilotBlockerOwner)
        : candidate.defaultOwnerType;

    return ensureClinicSideOwnership(
      {
        ownerType,
        ownerUserId: candidate.canonicalAssigneeUserId,
        ownerRole: candidate.canonicalAssigneeRole,
        assignmentSource: "canonical_record",
        ownershipReason: "Assigned from canonical enrolment / source-record owner",
        monitoringOwnerType: candidate.monitoringOwnerType,
        escalationOwnerType: candidate.escalationOwnerType,
      },
      candidate,
      elevated
    );
  }

  // 4 (early): Escalation owner when preferEscalationOwner
  if (preferEscalationOwner && (escalation?.escalated || elevated)) {
    const escOwner =
      escalation?.escalationOwnerType ??
      candidate.escalationOwnerType ??
      "clinic_manager";
    return {
      ownerType: escOwner,
      assignmentSource: "escalation_rule",
      ownershipReason: escalation?.escalationReason
        ? `Escalation ownership: ${escalation.escalationReason}`
        : "Escalation ownership applied",
      monitoringOwnerType: candidate.monitoringOwnerType ?? "reception",
      escalationOwnerType: escOwner,
    };
  }

  // 3. Module default
  if (candidate.defaultOwnerType && candidate.defaultOwnerType !== "unassigned") {
    return ensureClinicSideOwnership(
      {
        ownerType: candidate.defaultOwnerType,
        assignmentSource: "module_default",
        ownershipReason: `Module default owner for ${candidate.category}`,
        monitoringOwnerType: candidate.monitoringOwnerType,
        escalationOwnerType: candidate.escalationOwnerType,
      },
      candidate,
      elevated
    );
  }

  // 5. Unassigned
  return {
    ownerType: "unassigned",
    assignmentSource: "unresolved",
    ownershipReason: "Ownership could not be resolved from canonical, programme, or module rules",
    monitoringOwnerType: candidate.monitoringOwnerType ?? "clinic_manager",
    escalationOwnerType: candidate.escalationOwnerType ?? "director",
  };
}
