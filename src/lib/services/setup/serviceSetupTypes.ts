import type { CanonicalServiceRoleId } from "@/src/lib/services/setup/canonicalServiceRoles";

export const SERVICE_SETUP_CONFIG_VERSION = 1 as const;

export const SERVICE_FAMILY_IDS = [
  "consultation",
  "follow_up",
  "hair_treatment",
  "surgery",
  "trichology_diagnostic",
  "administrative",
  "custom",
] as const;

export type ServiceFamilyId = (typeof SERVICE_FAMILY_IDS)[number];

export const STAFF_ALLOCATION_MODES = [
  "automatic",
  "manual",
  "staff_not_required",
  "assign_later",
] as const;

export type StaffAllocationMode = (typeof STAFF_ALLOCATION_MODES)[number];

export const STAFF_ALLOCATION_STRATEGIES = [
  "preferred_role_order",
  "preferred_named_staff",
  "best_availability",
  "continuity_of_care",
  "round_robin",
  "lowest_workload",
] as const;

export type StaffAllocationStrategy = (typeof STAFF_ALLOCATION_STRATEGIES)[number];

export const ROOM_REQUIREMENT_MODES = ["required", "optional", "not_required"] as const;

export type RoomRequirementMode = (typeof ROOM_REQUIREMENT_MODES)[number];

export const SURGICAL_TEAM_SLOTS = ["doctor", "nurse", "technician", "assistant"] as const;

export type SurgicalTeamSlotId = (typeof SURGICAL_TEAM_SLOTS)[number];

export const CLINICAL_TIER_LEVELS = [1, 2, 3, 4, 5] as const;

export type ClinicalTierLevel = (typeof CLINICAL_TIER_LEVELS)[number];

export type ServiceStaffAllocationConfig = {
  mode: StaffAllocationMode;
  strategy: StaffAllocationStrategy;
  preferredRoleOrder: CanonicalServiceRoleId[];
  preferredStaffIds: string[];
};

export type ServiceCompetencyRequirements = {
  minimumClinicalTier: ClinicalTierLevel | null;
  requiredCertificationKeys: string[];
  supervisionAllowed: boolean;
  surgeryLeadRequired: boolean;
};

export type SurgicalTeamSlotConfig = {
  slot: SurgicalTeamSlotId;
  required: boolean;
  minimum: number;
  preferred: number;
  automaticallyAllocate: boolean;
};

export type ServiceRoomSetupConfig = {
  requirement: RoomRequirementMode;
  automaticAllocation: boolean;
  preferredRoomId: string | null;
  fallbackRoomIds: string[];
  eligibleRoomIds: string[];
  /** Free-form keys for service-specific resources (equipment, tray carts, etc.). */
  resourceRequirementKeys: string[];
};

export type ServiceSetupConfig = {
  version: typeof SERVICE_SETUP_CONFIG_VERSION;
  serviceFamily: ServiceFamilyId;
  eligibleRoles: CanonicalServiceRoleId[];
  /** Legacy role strings that could not be mapped — surfaced for admin review. */
  legacyRolesForReview: string[];
  staffAllocation: ServiceStaffAllocationConfig;
  competency: ServiceCompetencyRequirements;
  surgicalTeam: SurgicalTeamSlotConfig[] | null;
  rooms: ServiceRoomSetupConfig;
};

export type ServiceSetupActivationWarning = {
  code:
    | "missing_eligible_role_staff"
    | "missing_required_room"
    | "legacy_roles_pending_review"
    | "surgical_slot_unconfigured";
  message: string;
  severity: "warning" | "blocking";
};

export type ServiceSetupActivationResult = {
  canActivate: boolean;
  warnings: ServiceSetupActivationWarning[];
};

/** Minimal staff candidate used by allocation filters (pure). */
export type ServiceAllocationStaffCandidate = {
  staffId: string;
  role: string;
  isActive: boolean;
  isBookable: boolean;
  clinicIds: string[];
  primaryClinicId: string | null;
  hasClinicAffinity: boolean;
  clinicalTier: number | null;
  certificationKeys: string[];
  isRosteredAvailable: boolean;
  hasSchedulingConflict: boolean;
  underSupervision: boolean;
  isSurgeryLead: boolean;
  workloadScore: number;
  continuityPatientMatch: boolean;
};
