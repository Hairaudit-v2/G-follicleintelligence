import type { CanonicalServiceRoleId } from "@/src/lib/services/setup/canonicalServiceRoles";
import {
  applyServiceFamilyTemplate,
  inferServiceFamilyFromBookingType,
} from "@/src/lib/services/setup/serviceFamilyTemplates";
import { migrateLegacyServiceRoles } from "@/src/lib/services/setup/legacyRoleMigration";
import {
  emptyServiceSetupConfig,
  isEmptyServiceSetupConfig,
  parseServiceSetupConfig,
} from "@/src/lib/services/setup/serviceSetupDefaults";
import type { ServiceSetupConfig } from "@/src/lib/services/setup/serviceSetupTypes";

export type LegacyEligibilityHydrationInput = {
  setupConfigRaw: unknown;
  bookingType: string | null | undefined;
  serviceName: string | null | undefined;
  legacyStaffRoles: string[];
  preferredStaffIds?: string[];
  eligibleRoomIds: string[];
  preferredRoomId: string | null;
  fallbackRoomIds?: string[];
};

/**
 * Build editor state from DB: prefer persisted setup_config; otherwise migrate
 * comma-era eligibility rows into structured config (preserving unknown roles).
 */
export function hydrateServiceSetupConfig(
  input: LegacyEligibilityHydrationInput
): ServiceSetupConfig {
  const parsed = parseServiceSetupConfig(input.setupConfigRaw);
  if (!isEmptyServiceSetupConfig(parsed)) {
    // Merge room ids from eligibility tables when config rooms were emptied accidentally.
    if (parsed.rooms.eligibleRoomIds.length === 0 && input.eligibleRoomIds.length > 0) {
      return {
        ...parsed,
        rooms: {
          ...parsed.rooms,
          eligibleRoomIds: [...input.eligibleRoomIds],
          preferredRoomId: parsed.rooms.preferredRoomId ?? input.preferredRoomId,
          fallbackRoomIds:
            parsed.rooms.fallbackRoomIds.length > 0
              ? parsed.rooms.fallbackRoomIds
              : [...(input.fallbackRoomIds ?? [])],
        },
      };
    }
    return parsed;
  }

  const family = inferServiceFamilyFromBookingType(input.bookingType, input.serviceName);
  const migrated = migrateLegacyServiceRoles(input.legacyStaffRoles);
  const templated = applyServiceFamilyTemplate(family, emptyServiceSetupConfig());

  const eligibleRoles: CanonicalServiceRoleId[] =
    migrated.canonicalRoles.length > 0
      ? migrated.canonicalRoles
      : templated.eligibleRoles;

  return {
    ...templated,
    eligibleRoles,
    legacyRolesForReview: migrated.unknownLegacyRoles,
    staffAllocation: {
      ...templated.staffAllocation,
      preferredStaffIds: [...(input.preferredStaffIds ?? [])],
      preferredRoleOrder:
        migrated.canonicalRoles.length > 0
          ? migrated.canonicalRoles
          : templated.staffAllocation.preferredRoleOrder,
    },
    rooms: {
      ...templated.rooms,
      eligibleRoomIds: [...input.eligibleRoomIds],
      preferredRoomId: input.preferredRoomId,
      fallbackRoomIds: [...(input.fallbackRoomIds ?? [])],
      automaticAllocation: templated.rooms.automaticAllocation,
      requirement:
        input.eligibleRoomIds.length === 0 && templated.rooms.requirement === "required"
          ? "optional"
          : templated.rooms.requirement,
    },
  };
}
