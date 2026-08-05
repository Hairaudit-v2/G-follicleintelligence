/**
 * Integrity classification for fi_staff ↔ fi_staff_members linkage.
 * Pure — no I/O. Missing rows do not throw; they yield an integrity state.
 */

import type {
  StaffIdentityIntegrity,
  StaffIdentityIntegrityWarning,
  StaffIdentityLinkStatus,
} from "@/src/lib/team/identity/types";

export type ClassifyStaffIdentityIntegrityInput = {
  tenantId: string;
  /** Scheduling row tenant when loaded (may differ on mismatch probes). */
  schedulingTenantId: string | null;
  lifecycleTenantId: string | null;
  staffId: string | null;
  staffMemberId: string | null;
  userId: string | null;
  hasSchedulingRecord: boolean;
  hasLifecycleRecord: boolean;
  /** Active (non-archived, non-merged) lifecycle candidates for the staff id. */
  lifecycleCandidateCount: number;
  /** True when fi_staff_id points at a row that does not exist anywhere. */
  brokenStaffFk?: boolean;
  /** True when identifiers failed structural validation. */
  structurallyInvalid?: boolean;
};

function warn(
  code: StaffIdentityIntegrityWarning["code"],
  message: string
): StaffIdentityIntegrityWarning {
  return { code, message };
}

/**
 * Classify link integrity. Cross-tenant and structural failures never present
 * as a clean `linked` status.
 */
export function classifyStaffIdentityIntegrity(
  input: ClassifyStaffIdentityIntegrityInput
): StaffIdentityIntegrity {
  const warnings: StaffIdentityIntegrityWarning[] = [];
  const hasAuthIdentity = Boolean(input.userId?.trim());

  if (input.structurallyInvalid) {
    warnings.push(warn("structurally_invalid", "Staff identity identifiers are structurally invalid."));
    return {
      linkStatus: "invalid",
      hasSchedulingRecord: input.hasSchedulingRecord,
      hasLifecycleRecord: input.hasLifecycleRecord,
      hasAuthIdentity,
      warnings,
    };
  }

  if (input.brokenStaffFk) {
    warnings.push(
      warn("broken_staff_fk", "Lifecycle row references a fi_staff id that does not exist.")
    );
    return {
      linkStatus: "invalid",
      hasSchedulingRecord: false,
      hasLifecycleRecord: input.hasLifecycleRecord,
      hasAuthIdentity,
      warnings,
    };
  }

  const bothTenantsKnown =
    Boolean(input.schedulingTenantId) && Boolean(input.lifecycleTenantId);
  if (
    bothTenantsKnown &&
    input.schedulingTenantId !== input.lifecycleTenantId
  ) {
    warnings.push(
      warn(
        "cross_tenant_link",
        "Linked fi_staff and fi_staff_members rows belong to different tenants."
      )
    );
    return {
      linkStatus: "cross_tenant_mismatch",
      hasSchedulingRecord: true,
      hasLifecycleRecord: true,
      hasAuthIdentity,
      warnings,
    };
  }

  const bothPresent = input.hasSchedulingRecord && input.hasLifecycleRecord;

  if (input.lifecycleCandidateCount > 1) {
    warnings.push(
      warn(
        "multiple_lifecycle_candidates",
        `Multiple active fi_staff_members rows (${input.lifecycleCandidateCount}) link to the same fi_staff row.`
      )
    );
    return {
      linkStatus: "ambiguous",
      hasSchedulingRecord: input.hasSchedulingRecord,
      hasLifecycleRecord: input.hasLifecycleRecord,
      hasAuthIdentity,
      warnings,
    };
  }

  let linkStatus: StaffIdentityLinkStatus;
  if (bothPresent) {
    linkStatus = "linked";
  } else if (input.hasSchedulingRecord) {
    linkStatus = "scheduling_only";
    warnings.push(
      warn("missing_lifecycle_record", "No active fi_staff_members projection for this fi_staff row.")
    );
  } else if (input.hasLifecycleRecord) {
    linkStatus = "lifecycle_only";
    warnings.push(
      warn("missing_scheduling_record", "fi_staff_members row has no fi_staff projection link.")
    );
  } else {
    linkStatus = "invalid";
    warnings.push(warn("structurally_invalid", "No scheduling or lifecycle staff record found."));
  }

  if (!hasAuthIdentity) {
    warnings.push(warn("missing_auth_identity", "No linked auth user id on the scheduling record."));
  }

  return {
    linkStatus,
    hasSchedulingRecord: input.hasSchedulingRecord,
    hasLifecycleRecord: input.hasLifecycleRecord,
    hasAuthIdentity,
    warnings,
  };
}

export function isStaffIdentityLinkUsable(linkStatus: StaffIdentityLinkStatus): boolean {
  return linkStatus === "linked" || linkStatus === "scheduling_only" || linkStatus === "lifecycle_only";
}
