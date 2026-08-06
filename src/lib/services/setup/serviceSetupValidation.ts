import type {
  ServiceSetupActivationResult,
  ServiceSetupActivationWarning,
  ServiceSetupConfig,
} from "@/src/lib/services/setup/serviceSetupTypes";

export type ServiceSetupResourceInventory = {
  /** Role → count of active bookable staff matching that role at the clinic. */
  staffCountByRole: Record<string, number>;
  /** Active rooms available for eligibility (ids). */
  availableRoomIds: string[];
};

/**
 * Activation rules: prevent activation when a required role or room has no eligible resource.
 * Warnings are always returned; `canActivate` is false when any blocking warning exists.
 * Callers may still save as draft (`is_active = false`).
 */
export function evaluateServiceSetupActivation(
  config: ServiceSetupConfig,
  inventory: ServiceSetupResourceInventory
): ServiceSetupActivationResult {
  const warnings: ServiceSetupActivationWarning[] = [];

  if (config.legacyRolesForReview.length > 0) {
    warnings.push({
      code: "legacy_roles_pending_review",
      severity: "warning",
      message: `Review unknown legacy roles before activation: ${config.legacyRolesForReview.join(", ")}.`,
    });
  }

  const staffNeeded =
    config.staffAllocation.mode !== "staff_not_required" &&
    config.staffAllocation.mode !== "assign_later";

  if (staffNeeded) {
    if (config.eligibleRoles.length > 0) {
      const anyRoleCovered = config.eligibleRoles.some(
        (role) => (inventory.staffCountByRole[role] ?? 0) > 0
      );
      if (!anyRoleCovered) {
        warnings.push({
          code: "missing_eligible_role_staff",
          severity: "blocking",
          message: `No eligible staff found for any selected role (${config.eligibleRoles.join(", ")}). Save as draft until matching staff exist.`,
        });
      }
    }

    if (config.surgicalTeam) {
      for (const slot of config.surgicalTeam) {
        if (!slot.required || slot.minimum <= 0) continue;
        const roleKey =
          slot.slot === "assistant"
            ? "clinical_assistant"
            : slot.slot === "doctor"
              ? "doctor"
              : slot.slot;
        const count = inventory.staffCountByRole[roleKey] ?? 0;
        // Doctor slot may also be filled by surgeon.
        const alt =
          slot.slot === "doctor"
            ? (inventory.staffCountByRole.surgeon ?? 0)
            : 0;
        if (count + alt < slot.minimum) {
          warnings.push({
            code: "surgical_slot_unconfigured",
            severity: "blocking",
            message: `Surgical team slot “${slot.slot}” requires ${slot.minimum} but only ${count + alt} matching staff are available.`,
          });
        }
      }
    }
  }

  if (config.rooms.requirement === "required") {
    const eligible = config.rooms.eligibleRoomIds.filter((id) =>
      inventory.availableRoomIds.includes(id)
    );
    if (eligible.length === 0) {
      warnings.push({
        code: "missing_required_room",
        severity: "blocking",
        message:
          "This service requires a room, but no eligible active room is configured. Save as draft or add room eligibility.",
      });
    }
  }

  const canActivate = !warnings.some((w) => w.severity === "blocking");
  return { canActivate, warnings };
}

/** Prefer preferred room, then fallbacks, then remaining eligible — when automatic room allocation is on. */
export function selectAutomaticRoomAllocation(config: ServiceSetupConfig): string | null {
  if (config.rooms.requirement === "not_required") return null;
  if (!config.rooms.automaticAllocation) return config.rooms.preferredRoomId;

  const eligible = new Set(config.rooms.eligibleRoomIds);
  const preferred = config.rooms.preferredRoomId?.trim() || null;
  if (preferred && eligible.has(preferred)) return preferred;

  for (const id of config.rooms.fallbackRoomIds) {
    const rid = id.trim();
    if (rid && eligible.has(rid)) return rid;
  }

  return config.rooms.eligibleRoomIds[0]?.trim() || null;
}
