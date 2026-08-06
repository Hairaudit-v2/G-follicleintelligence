import type { CanonicalServiceRoleId } from "@/src/lib/services/setup/canonicalServiceRoles";
import type {
  ClinicalTierLevel,
  RoomRequirementMode,
  ServiceCompetencyRequirements,
  ServiceFamilyId,
  ServiceRoomSetupConfig,
  ServiceSetupConfig,
  ServiceStaffAllocationConfig,
  StaffAllocationMode,
  StaffAllocationStrategy,
  SurgicalTeamSlotConfig,
  SurgicalTeamSlotId,
} from "@/src/lib/services/setup/serviceSetupTypes";
import {
  CLINICAL_TIER_LEVELS,
  ROOM_REQUIREMENT_MODES,
  SERVICE_FAMILY_IDS,
  SERVICE_SETUP_CONFIG_VERSION,
  STAFF_ALLOCATION_MODES,
  STAFF_ALLOCATION_STRATEGIES,
  SURGICAL_TEAM_SLOTS,
} from "@/src/lib/services/setup/serviceSetupTypes";
import { isCanonicalServiceRole } from "@/src/lib/services/setup/canonicalServiceRoles";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
}

function uniquePreserveOrder<T extends string>(values: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function emptyServiceSetupConfig(): ServiceSetupConfig {
  return {
    version: SERVICE_SETUP_CONFIG_VERSION,
    serviceFamily: "custom",
    eligibleRoles: [],
    legacyRolesForReview: [],
    staffAllocation: {
      mode: "manual",
      strategy: "preferred_named_staff",
      preferredRoleOrder: [],
      preferredStaffIds: [],
    },
    competency: {
      minimumClinicalTier: null,
      requiredCertificationKeys: [],
      supervisionAllowed: true,
      surgeryLeadRequired: false,
    },
    surgicalTeam: null,
    rooms: {
      requirement: "optional",
      automaticAllocation: false,
      preferredRoomId: null,
      fallbackRoomIds: [],
      eligibleRoomIds: [],
      resourceRequirementKeys: [],
    },
  };
}

function parseFamily(raw: unknown): ServiceFamilyId {
  const v = String(raw ?? "").trim();
  return (SERVICE_FAMILY_IDS as readonly string[]).includes(v)
    ? (v as ServiceFamilyId)
    : "custom";
}

function parseMode(raw: unknown): StaffAllocationMode {
  const v = String(raw ?? "").trim();
  return (STAFF_ALLOCATION_MODES as readonly string[]).includes(v)
    ? (v as StaffAllocationMode)
    : "manual";
}

function parseStrategy(raw: unknown): StaffAllocationStrategy {
  const v = String(raw ?? "").trim();
  return (STAFF_ALLOCATION_STRATEGIES as readonly string[]).includes(v)
    ? (v as StaffAllocationStrategy)
    : "preferred_role_order";
}

function parseRoomRequirement(raw: unknown): RoomRequirementMode {
  const v = String(raw ?? "").trim();
  return (ROOM_REQUIREMENT_MODES as readonly string[]).includes(v)
    ? (v as RoomRequirementMode)
    : "optional";
}

function parseRoles(raw: unknown): CanonicalServiceRoleId[] {
  return uniquePreserveOrder(
    asStringArray(raw).filter(isCanonicalServiceRole) as CanonicalServiceRoleId[]
  );
}

function parseTier(raw: unknown): ClinicalTierLevel | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return (CLINICAL_TIER_LEVELS as readonly number[]).includes(n)
    ? (n as ClinicalTierLevel)
    : null;
}

function parseSurgicalTeam(raw: unknown): SurgicalTeamSlotConfig[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const out: SurgicalTeamSlotConfig[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const slot = String(row.slot ?? "").trim();
    if (!(SURGICAL_TEAM_SLOTS as readonly string[]).includes(slot)) continue;
    const minimum = Math.max(0, Math.min(20, Number(row.minimum ?? 0) || 0));
    const preferred = Math.max(minimum, Math.min(20, Number(row.preferred ?? minimum) || minimum));
    out.push({
      slot: slot as SurgicalTeamSlotId,
      required: Boolean(row.required),
      minimum,
      preferred,
      automaticallyAllocate: row.automaticallyAllocate !== false,
    });
  }
  return out.length > 0 ? out : null;
}

function parseStaffAllocation(raw: unknown): ServiceStaffAllocationConfig {
  const row =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    mode: parseMode(row.mode),
    strategy: parseStrategy(row.strategy),
    preferredRoleOrder: parseRoles(row.preferredRoleOrder),
    preferredStaffIds: uniquePreserveOrder(asStringArray(row.preferredStaffIds)),
  };
}

function parseCompetency(raw: unknown): ServiceCompetencyRequirements {
  const row =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    minimumClinicalTier: parseTier(row.minimumClinicalTier),
    requiredCertificationKeys: uniquePreserveOrder(
      asStringArray(row.requiredCertificationKeys).map((k) => k.toLowerCase())
    ),
    supervisionAllowed: row.supervisionAllowed !== false,
    surgeryLeadRequired: Boolean(row.surgeryLeadRequired),
  };
}

function parseRooms(raw: unknown): ServiceRoomSetupConfig {
  const row =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const preferredRoomId =
    row.preferredRoomId != null && String(row.preferredRoomId).trim()
      ? String(row.preferredRoomId).trim()
      : null;
  return {
    requirement: parseRoomRequirement(row.requirement),
    automaticAllocation: Boolean(row.automaticAllocation),
    preferredRoomId,
    fallbackRoomIds: uniquePreserveOrder(asStringArray(row.fallbackRoomIds)),
    eligibleRoomIds: uniquePreserveOrder(asStringArray(row.eligibleRoomIds)),
    resourceRequirementKeys: uniquePreserveOrder(
      asStringArray(row.resourceRequirementKeys)
    ),
  };
}

/** Parse unknown JSON (DB column / client body) into a normalised config. */
export function parseServiceSetupConfig(raw: unknown): ServiceSetupConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyServiceSetupConfig();
  }
  const row = raw as Record<string, unknown>;
  if (Object.keys(row).length === 0) {
    return emptyServiceSetupConfig();
  }
  return {
    version: SERVICE_SETUP_CONFIG_VERSION,
    serviceFamily: parseFamily(row.serviceFamily),
    eligibleRoles: parseRoles(row.eligibleRoles),
    legacyRolesForReview: uniquePreserveOrder(asStringArray(row.legacyRolesForReview)),
    staffAllocation: parseStaffAllocation(row.staffAllocation),
    competency: parseCompetency(row.competency),
    surgicalTeam: parseSurgicalTeam(row.surgicalTeam),
    rooms: parseRooms(row.rooms),
  };
}

export function isEmptyServiceSetupConfig(config: ServiceSetupConfig): boolean {
  return (
    config.eligibleRoles.length === 0 &&
    config.legacyRolesForReview.length === 0 &&
    config.rooms.eligibleRoomIds.length === 0 &&
    config.staffAllocation.preferredStaffIds.length === 0 &&
    config.serviceFamily === "custom" &&
    !config.surgicalTeam
  );
}
