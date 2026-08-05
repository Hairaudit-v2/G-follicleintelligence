/**
 * Normalise loaded scheduling + lifecycle rows into StaffIdentity.
 * Pure — integrity classification and status composition happen here.
 */

import { parseStaffProfileExtras } from "@/src/lib/staff/staffProfileExtras";
import {
  STAFF_EMPLOYMENT_STATUSES,
  type StaffEmploymentStatus,
} from "@/src/lib/team/identity/staffLifecycleTypes";
import { buildStaffPersonKey } from "@/src/lib/team/identity/staffIdentityKeys";
import { classifyStaffIdentityIntegrity } from "@/src/lib/team/identity/staffIdentityIntegrity";
import {
  deriveStaffAccessStatus,
  deriveStaffReadinessStatus,
} from "@/src/lib/team/identity/staffIdentityReadiness";
import type { StaffIdentity } from "@/src/lib/team/identity/types";
import type {
  StaffIdentityLifecycleRow,
  StaffIdentitySchedulingRow,
} from "@/src/lib/team/identity/internal/staffIdentityRowTypes";
import {
  isActiveLifecycleRow,
  isUsableLifecycleRow,
} from "@/src/lib/team/identity/internal/staffIdentityRowTypes";

/** Local parse to avoid importing staffLifecycleCore (cycle risk with hr eligibility). */
function parseEmploymentStatus(raw: unknown): StaffEmploymentStatus {
  const value = String(raw ?? "active")
    .trim()
    .toLowerCase();
  if ((STAFF_EMPLOYMENT_STATUSES as readonly string[]).includes(value)) {
    return value as StaffEmploymentStatus;
  }
  return "active";
}

/** Inline HR-link check — do not import hrReconciliationEligibleCore (cycle risk). */
function deriveHrLinked(lifecycle: StaffIdentityLifecycleRow | null): boolean {
  if (!lifecycle) return false;
  if (lifecycle.iiohr_staff_record_id?.trim()) return true;
  if (lifecycle.iiohr_user_id?.trim()) return true;
  if (
    lifecycle.source_system === "iiohr_evolved_hr" &&
    lifecycle.source_synced_at != null &&
    String(lifecycle.source_synced_at).trim() !== ""
  ) {
    return true;
  }
  return false;
}

export type NormaliseStaffIdentityInput = {
  tenantId: string;
  scheduling: StaffIdentitySchedulingRow | null;
  /** Preferred lifecycle row when one was requested / selected. */
  lifecycle: StaffIdentityLifecycleRow | null;
  /**
   * Active (non-archived) candidates for ambiguity detection.
   * Archived-only rows should still be supplied via `lifecycle` for status.
   */
  lifecycleCandidates?: StaffIdentityLifecycleRow[];
  /** Tenant id of scheduling row when found outside requested tenant. */
  foreignSchedulingTenantId?: string | null;
  brokenStaffFk?: boolean;
  structurallyInvalid?: boolean;
};

function sortById(rows: StaffIdentityLifecycleRow[]): StaffIdentityLifecycleRow[] {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Prefer active non-merged rows; fall back to archived non-merged so
 * employment/archive signals remain visible (directory proof).
 */
export function pickLifecycleForIdentity(input: {
  preferred: StaffIdentityLifecycleRow | null;
  allForStaff: StaffIdentityLifecycleRow[];
}): {
  lifecycle: StaffIdentityLifecycleRow | null;
  activeCandidates: StaffIdentityLifecycleRow[];
} {
  const usable = input.allForStaff.filter(isUsableLifecycleRow);
  const activeCandidates = usable.filter(isActiveLifecycleRow);
  if (input.preferred && isUsableLifecycleRow(input.preferred)) {
    if (isActiveLifecycleRow(input.preferred) || activeCandidates.length === 0) {
      return { lifecycle: input.preferred, activeCandidates };
    }
  }
  if (activeCandidates.length > 0) {
    return { lifecycle: sortById(activeCandidates)[0] ?? null, activeCandidates };
  }
  const archived = usable.filter((r) => Boolean(r.archived_at?.trim()));
  return {
    lifecycle: sortById(archived)[0] ?? sortById(usable)[0] ?? input.preferred,
    activeCandidates,
  };
}

export function normaliseStaffIdentity(input: NormaliseStaffIdentityInput): StaffIdentity {
  const allForStaff = input.lifecycleCandidates?.length
    ? input.lifecycleCandidates
    : input.lifecycle
      ? [input.lifecycle]
      : [];
  const { lifecycle, activeCandidates } = pickLifecycleForIdentity({
    preferred: input.lifecycle,
    allForStaff,
  });
  const scheduling = input.scheduling;

  const staffId = scheduling?.id ?? lifecycle?.fi_staff_id ?? null;
  const staffMemberId = lifecycle?.id ?? null;
  const userId = scheduling?.fi_user_id ?? null;

  const hasSchedulingRecord = Boolean(scheduling);
  const hasLifecycleRecord = Boolean(lifecycle);

  const schedulingTenantId =
    scheduling?.tenant_id ??
    (input.foreignSchedulingTenantId ? input.foreignSchedulingTenantId : null);
  const lifecycleTenantId = lifecycle?.tenant_id ?? null;

  const integrity = classifyStaffIdentityIntegrity({
    tenantId: input.tenantId,
    schedulingTenantId,
    lifecycleTenantId,
    staffId,
    staffMemberId,
    userId,
    hasSchedulingRecord,
    hasLifecycleRecord,
    lifecycleCandidateCount:
      activeCandidates.length > 0
        ? activeCandidates.length
        : hasLifecycleRecord
          ? 1
          : 0,
    brokenStaffFk: input.brokenStaffFk,
    structurallyInvalid: input.structurallyInvalid,
  });

  const employmentStatus = parseEmploymentStatus(
    lifecycle?.employment_status ?? (scheduling?.is_active === false ? "inactive" : "active")
  );

  const accessStatus = deriveStaffAccessStatus({
    systemAccessRevoked: Boolean(lifecycle?.system_access_revoked),
    employmentStatus,
    userId,
  });

  const archivedAt = lifecycle?.archived_at?.trim() ? lifecycle.archived_at : null;

  const readinessStatus = deriveStaffReadinessStatus({
    employmentStatus,
    linkStatus: integrity.linkStatus,
    archivedAt,
  });

  const extras = parseStaffProfileExtras(scheduling?.working_hours);
  const primaryClinicId = lifecycle?.clinic_id?.trim() || extras.primary_clinic_id || null;
  const clinicIds = primaryClinicId ? [primaryClinicId] : [];

  const roles = Array.from(
    new Set(
      [lifecycle?.role_code, scheduling?.staff_role]
        .map((r) => (r != null ? String(r).trim() : ""))
        .filter(Boolean)
    )
  );

  const displayName =
    lifecycle?.full_name?.trim() || scheduling?.full_name?.trim() || "Staff";
  const email = lifecycle?.email ?? scheduling?.email ?? null;

  const personKey = buildStaffPersonKey({ staffId, staffMemberId, userId });

  return {
    tenantId: input.tenantId,
    personKey,
    staffId,
    staffMemberId,
    userId,
    displayName,
    email,
    employmentStatus,
    accessStatus,
    readinessStatus,
    archivedAt,
    hrLinked: deriveHrLinked(lifecycle),
    primaryClinicId,
    clinicIds,
    roles,
    capabilities: [],
    integrity,
  };
}
