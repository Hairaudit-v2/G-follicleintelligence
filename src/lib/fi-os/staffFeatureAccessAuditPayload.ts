import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import { isFiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";

export const FI_STAFF_FEATURE_ACCESS_AUDIT_EVENT_TYPES = [
  "feature_override_changed",
  "workspace_profile_changed",
  "position_type_changed",
  "tenant_operating_mode_changed",
] as const;

export type FiStaffFeatureAccessAuditEventType =
  (typeof FI_STAFF_FEATURE_ACCESS_AUDIT_EVENT_TYPES)[number];

export type FiStaffFeatureAccessAuditTargetType = "staff" | "tenant";

export type FiStaffFeatureAccessAuditInsert = {
  tenant_id: string;
  staff_id: string | null;
  actor_user_id: string | null;
  actor_fi_user_id: string | null;
  event_type: FiStaffFeatureAccessAuditEventType;
  target_type: FiStaffFeatureAccessAuditTargetType;
  feature_key: string | null;
  old_value: unknown;
  new_value: unknown;
  reason: string | null;
  source: string;
  metadata: Record<string, unknown>;
};

export function buildFeatureOverrideChangedAuditInsert(opts: {
  tenantId: string;
  staffId: string;
  actorUserId: string | null;
  actorFiUserId: string | null;
  oldOverrides: Partial<Record<FiFeatureKey, boolean>>;
  newPatch: Partial<Record<FiFeatureKey, boolean>>;
  source?: string;
}): FiStaffFeatureAccessAuditInsert {
  const keys = Object.keys(opts.newPatch).filter(isFiFeatureKey);
  const oldSubset: Partial<Record<FiFeatureKey, boolean>> = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(opts.oldOverrides, k)) {
      oldSubset[k] = opts.oldOverrides[k]!;
    }
  }
  return {
    tenant_id: opts.tenantId.trim(),
    staff_id: opts.staffId.trim(),
    actor_user_id: opts.actorUserId?.trim() || null,
    actor_fi_user_id: opts.actorFiUserId?.trim() || null,
    event_type: "feature_override_changed",
    target_type: "staff",
    feature_key: null,
    old_value: oldSubset,
    new_value: opts.newPatch,
    reason: null,
    source: opts.source ?? "fi_os_admin",
    metadata: { changedKeys: keys },
  };
}

export function buildWorkspaceProfileChangedAuditInsert(opts: {
  tenantId: string;
  staffId: string;
  actorUserId: string | null;
  actorFiUserId: string | null;
  oldProfile: string | null;
  newProfile: string;
  source?: string;
}): FiStaffFeatureAccessAuditInsert {
  return {
    tenant_id: opts.tenantId.trim(),
    staff_id: opts.staffId.trim(),
    actor_user_id: opts.actorUserId?.trim() || null,
    actor_fi_user_id: opts.actorFiUserId?.trim() || null,
    event_type: "workspace_profile_changed",
    target_type: "staff",
    feature_key: null,
    old_value: { workspace_profile: opts.oldProfile },
    new_value: { workspace_profile: opts.newProfile },
    reason: null,
    source: opts.source ?? "fi_os_admin",
    metadata: { changedKeys: ["workspace_profile"] },
  };
}

export function buildPositionTypeChangedAuditInsert(opts: {
  tenantId: string;
  staffId: string;
  actorUserId: string | null;
  actorFiUserId: string | null;
  oldPositionTypeId: string | null;
  newPositionTypeId: string | null;
  source?: string;
}): FiStaffFeatureAccessAuditInsert {
  return {
    tenant_id: opts.tenantId.trim(),
    staff_id: opts.staffId.trim(),
    actor_user_id: opts.actorUserId?.trim() || null,
    actor_fi_user_id: opts.actorFiUserId?.trim() || null,
    event_type: "position_type_changed",
    target_type: "staff",
    feature_key: null,
    old_value: { position_type_id: opts.oldPositionTypeId },
    new_value: { position_type_id: opts.newPositionTypeId },
    reason: null,
    source: opts.source ?? "fi_os_admin",
    metadata: { changedKeys: ["position_type_id"] },
  };
}

export function buildTenantOperatingModeChangedAuditInsert(opts: {
  tenantId: string;
  actorUserId: string | null;
  actorFiUserId: string | null;
  oldModeKey: string | null;
  newModeKey: string | null;
  source?: string;
}): FiStaffFeatureAccessAuditInsert {
  return {
    tenant_id: opts.tenantId.trim(),
    staff_id: null,
    actor_user_id: opts.actorUserId?.trim() || null,
    actor_fi_user_id: opts.actorFiUserId?.trim() || null,
    event_type: "tenant_operating_mode_changed",
    target_type: "tenant",
    feature_key: null,
    old_value: { fi_os_operating_mode_key: opts.oldModeKey },
    new_value: { fi_os_operating_mode_key: opts.newModeKey },
    reason: null,
    source: opts.source ?? "fi_os_admin",
    metadata: { changedKeys: ["fi_os_operating_mode_key"] },
  };
}
