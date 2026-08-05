/**
 * Coarse readiness / access composition for StaffIdentity.
 * Pure — does not replace access-centre or readiness-engine scoring.
 */

import type { StaffEmploymentStatus } from "@/src/lib/workforce-os/staffLifecycleTypes";
import type {
  StaffAccessStatus,
  StaffIdentityLinkStatus,
  StaffReadinessStatus,
} from "@/src/lib/team/identity/types";

export type DeriveStaffAccessStatusInput = {
  systemAccessRevoked: boolean;
  employmentStatus: StaffEmploymentStatus | string;
  userId: string | null;
};

export function deriveStaffAccessStatus(input: DeriveStaffAccessStatusInput): StaffAccessStatus {
  if (input.systemAccessRevoked) return "revoked";
  const employment = String(input.employmentStatus ?? "")
    .trim()
    .toLowerCase();
  if (employment === "suspended") return "suspended";
  if (!input.userId?.trim()) return "no_login";
  // Without auth enrichment we cannot distinguish invite_pending vs login_active.
  return "login_active";
}

export type DeriveStaffReadinessStatusInput = {
  employmentStatus: StaffEmploymentStatus | string;
  linkStatus: StaffIdentityLinkStatus;
  archivedAt?: string | null;
};

/**
 * Band for identity consumers. Distinct from scored Workforce readiness engines.
 *
 * - blocked: unusable link, terminated-class employment, or archived
 * - watch: transitional / partial / ambiguous identity
 * - ready: linked active person
 * - unknown: inactive or ambiguous employment without a stronger signal
 */
export function deriveStaffReadinessStatus(
  input: DeriveStaffReadinessStatusInput
): StaffReadinessStatus {
  if (
    input.linkStatus === "cross_tenant_mismatch" ||
    input.linkStatus === "invalid"
  ) {
    return "blocked";
  }

  if (input.archivedAt != null && String(input.archivedAt).trim() !== "") {
    return "blocked";
  }

  const employment = String(input.employmentStatus ?? "")
    .trim()
    .toLowerCase();

  if (
    employment === "terminated" ||
    employment === "resigned" ||
    employment === "contract_ended" ||
    employment === "contract_expired" ||
    employment === "merged"
  ) {
    return "blocked";
  }

  if (
    input.linkStatus === "ambiguous" ||
    input.linkStatus === "scheduling_only" ||
    input.linkStatus === "lifecycle_only" ||
    employment === "pending_onboarding" ||
    employment === "on_leave" ||
    employment === "suspended"
  ) {
    return "watch";
  }

  if (input.linkStatus === "linked" && employment === "active") {
    return "ready";
  }

  return "unknown";
}
