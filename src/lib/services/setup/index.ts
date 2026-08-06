export {
  CANONICAL_SERVICE_ROLES,
  CANONICAL_SERVICE_ROLE_DEFINITIONS,
  isCanonicalServiceRole,
  resolveCanonicalServiceRole,
  type CanonicalServiceRoleId,
} from "@/src/lib/services/setup/canonicalServiceRoles";

export {
  SERVICE_FAMILY_TEMPLATES,
  applyServiceFamilyTemplate,
  inferServiceFamilyFromBookingType,
  type ServiceFamilyTemplate,
} from "@/src/lib/services/setup/serviceFamilyTemplates";

export {
  emptyServiceSetupConfig,
  parseServiceSetupConfig,
  isEmptyServiceSetupConfig,
} from "@/src/lib/services/setup/serviceSetupDefaults";

export {
  migrateLegacyServiceRoles,
  splitCommaSeparatedRoles,
} from "@/src/lib/services/setup/legacyRoleMigration";

export {
  filterStaffForServiceAllocation,
  rankStaffForAllocationStrategy,
} from "@/src/lib/services/setup/serviceAllocationFilter";

export {
  evaluateServiceSetupActivation,
  selectAutomaticRoomAllocation,
} from "@/src/lib/services/setup/serviceSetupValidation";

export { hydrateServiceSetupConfig } from "@/src/lib/services/setup/hydrateServiceSetupConfig";

export { buildServiceSetupSyncPlan } from "@/src/lib/services/setup/serviceSetupSyncPlan";

export type {
  ServiceFamilyId,
  ServiceSetupConfig,
  ServiceSetupActivationResult,
  ServiceSetupActivationWarning,
  ServiceAllocationStaffCandidate,
  StaffAllocationMode,
  StaffAllocationStrategy,
  RoomRequirementMode,
  SurgicalTeamSlotConfig,
  SurgicalTeamSlotId,
} from "@/src/lib/services/setup/serviceSetupTypes";

export {
  SERVICE_FAMILY_IDS,
  STAFF_ALLOCATION_MODES,
  STAFF_ALLOCATION_STRATEGIES,
  ROOM_REQUIREMENT_MODES,
  SURGICAL_TEAM_SLOTS,
  CLINICAL_TIER_LEVELS,
} from "@/src/lib/services/setup/serviceSetupTypes";
