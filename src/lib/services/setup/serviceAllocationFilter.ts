import { staffRoleMatchesEligibility } from "@/src/lib/rooms/roomAvailabilityCore";
import type { CanonicalServiceRoleId } from "@/src/lib/services/setup/canonicalServiceRoles";
import type {
  ServiceAllocationStaffCandidate,
  ServiceSetupConfig,
} from "@/src/lib/services/setup/serviceSetupTypes";

export type ServiceAllocationFilterContext = {
  clinicId: string;
  config: ServiceSetupConfig;
};

export type ServiceAllocationRejectReason =
  | "inactive"
  | "not_bookable"
  | "clinic_mismatch"
  | "role_ineligible"
  | "competency_tier"
  | "certification_missing"
  | "supervision_disallowed"
  | "surgery_lead_required"
  | "not_rostered"
  | "scheduling_conflict"
  | "staff_not_required";

export type ServiceAllocationFilterResult = {
  eligible: ServiceAllocationStaffCandidate[];
  rejected: Array<{
    staffId: string;
    reasons: ServiceAllocationRejectReason[];
  }>;
};

function staffBelongsToClinic(
  staff: ServiceAllocationStaffCandidate,
  clinicId: string
): boolean {
  const cid = clinicId.trim();
  if (!cid) return false;
  if (staff.hasClinicAffinity) return true;
  if (staff.primaryClinicId?.trim() === cid) return true;
  if (staff.clinicIds.some((id) => id.trim() === cid)) return true;
  // Sole-clinic staff: only one clinic membership equals selected clinic.
  if (staff.clinicIds.length === 1 && staff.clinicIds[0]?.trim() === cid) return true;
  return false;
}

function roleMatchesEligible(
  staffRole: string,
  eligibleRoles: CanonicalServiceRoleId[]
): boolean {
  if (eligibleRoles.length === 0) return false;
  return eligibleRoles.some((role) => staffRoleMatchesEligibility(staffRole, role));
}

function meetsCompetency(
  staff: ServiceAllocationStaffCandidate,
  config: ServiceSetupConfig
): ServiceAllocationRejectReason[] {
  const reasons: ServiceAllocationRejectReason[] = [];
  const minTier = config.competency.minimumClinicalTier;
  if (minTier != null) {
    const tier = staff.clinicalTier;
    if (tier == null || tier < minTier) reasons.push("competency_tier");
  }
  for (const key of config.competency.requiredCertificationKeys) {
    const k = key.trim().toLowerCase();
    if (!k) continue;
    if (!staff.certificationKeys.map((c) => c.toLowerCase()).includes(k)) {
      reasons.push("certification_missing");
      break;
    }
  }
  if (!config.competency.supervisionAllowed && staff.underSupervision) {
    reasons.push("supervision_disallowed");
  }
  if (config.competency.surgeryLeadRequired && !staff.isSurgeryLead) {
    reasons.push("surgery_lead_required");
  }
  return reasons;
}

/**
 * During allocation, only include staff who:
 * - belong to the selected clinic or have valid clinic affinity
 * - hold an eligible role
 * - meet competency requirements
 * - are active and bookable
 * - are rostered and available
 * - do not have a scheduling conflict
 */
export function filterStaffForServiceAllocation(
  candidates: ServiceAllocationStaffCandidate[],
  ctx: ServiceAllocationFilterContext
): ServiceAllocationFilterResult {
  const { config, clinicId } = ctx;
  const eligible: ServiceAllocationStaffCandidate[] = [];
  const rejected: ServiceAllocationFilterResult["rejected"] = [];

  if (config.staffAllocation.mode === "staff_not_required") {
    return {
      eligible: [],
      rejected: candidates.map((c) => ({
        staffId: c.staffId,
        reasons: ["staff_not_required"],
      })),
    };
  }

  for (const staff of candidates) {
    const reasons: ServiceAllocationRejectReason[] = [];
    if (!staff.isActive) reasons.push("inactive");
    if (!staff.isBookable) reasons.push("not_bookable");
    if (!staffBelongsToClinic(staff, clinicId)) reasons.push("clinic_mismatch");
    if (!roleMatchesEligible(staff.role, config.eligibleRoles)) {
      reasons.push("role_ineligible");
    }
    reasons.push(...meetsCompetency(staff, config));
    if (!staff.isRosteredAvailable) reasons.push("not_rostered");
    if (staff.hasSchedulingConflict) reasons.push("scheduling_conflict");

    if (reasons.length === 0) eligible.push(staff);
    else rejected.push({ staffId: staff.staffId, reasons });
  }

  return { eligible, rejected };
}

/**
 * Rank eligible staff for automatic allocation strategies.
 * Returns ordered staff IDs (best first).
 */
export function rankStaffForAllocationStrategy(
  eligible: ServiceAllocationStaffCandidate[],
  config: ServiceSetupConfig
): string[] {
  const strategy = config.staffAllocation.strategy;
  const preferredStaff = new Set(config.staffAllocation.preferredStaffIds);
  const roleOrder = config.staffAllocation.preferredRoleOrder;

  const roleRank = (role: string): number => {
    const normalized = role.trim().toLowerCase();
    for (let i = 0; i < roleOrder.length; i++) {
      if (normalized === roleOrder[i]) return i;
    }
    for (let i = 0; i < roleOrder.length; i++) {
      if (staffRoleMatchesEligibility(role, roleOrder[i]!)) return i + roleOrder.length;
    }
    return roleOrder.length * 2 + 1;
  };

  const sorted = [...eligible];
  sorted.sort((a, b) => {
    switch (strategy) {
      case "preferred_named_staff": {
        const ap = preferredStaff.has(a.staffId) ? 0 : 1;
        const bp = preferredStaff.has(b.staffId) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return a.staffId.localeCompare(b.staffId);
      }
      case "preferred_role_order": {
        const ar = roleRank(a.role);
        const br = roleRank(b.role);
        if (ar !== br) return ar - br;
        return a.workloadScore - b.workloadScore;
      }
      case "continuity_of_care": {
        const ac = a.continuityPatientMatch ? 0 : 1;
        const bc = b.continuityPatientMatch ? 0 : 1;
        if (ac !== bc) return ac - bc;
        return roleRank(a.role) - roleRank(b.role);
      }
      case "lowest_workload":
        return a.workloadScore - b.workloadScore || a.staffId.localeCompare(b.staffId);
      case "round_robin":
        // Caller supplies workloadScore as assignment count; lowest first.
        return a.workloadScore - b.workloadScore || a.staffId.localeCompare(b.staffId);
      case "best_availability":
      default:
        // Lower workload as a proxy for capacity when no explicit availability score.
        return a.workloadScore - b.workloadScore || roleRank(a.role) - roleRank(b.role);
    }
  });

  return sorted.map((s) => s.staffId);
}
