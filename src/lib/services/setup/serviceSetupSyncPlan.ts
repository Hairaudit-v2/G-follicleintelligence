import type { ServiceSetupConfig } from "@/src/lib/services/setup/serviceSetupTypes";

export type StaffEligibilitySyncRow = {
  staffId: string | null;
  staffRole: string | null;
  isRequired: boolean;
  isActive: boolean;
};

export type RoomEligibilitySyncRow = {
  roomId: string;
  isPreferred: boolean;
  isActive: boolean;
  metadata?: Record<string, unknown>;
};

export type ResourceRequirementSyncRow = {
  resource_type: "staff_role" | "staff_member" | "room_type" | "room_id";
  resource_key: string;
  requirement_label: string;
  is_required: boolean;
  quantity: number;
  sort_order: number;
  metadata: Record<string, unknown>;
};

export type ServiceSetupSyncPlan = {
  staffRows: StaffEligibilitySyncRow[];
  roomRows: RoomEligibilitySyncRow[];
  resourceRows: ResourceRequirementSyncRow[];
};

const SLOT_ROLE_KEY: Record<string, string> = {
  doctor: "surgeon|doctor",
  nurse: "nurse",
  technician: "technician",
  assistant: "clinical_assistant|assistant",
};

/**
 * Derive eligibility + resource-requirement write plans from structured setup config
 * so legacy tables stay in sync for booking engines.
 */
export function buildServiceSetupSyncPlan(config: ServiceSetupConfig): ServiceSetupSyncPlan {
  const staffRows: StaffEligibilitySyncRow[] = [];

  if (config.staffAllocation.mode !== "staff_not_required") {
    for (const role of config.eligibleRoles) {
      staffRows.push({
        staffId: null,
        staffRole: role,
        isRequired: true,
        isActive: true,
      });
    }
    for (const staffId of config.staffAllocation.preferredStaffIds) {
      const id = staffId.trim();
      if (!id) continue;
      staffRows.push({
        staffId: id,
        staffRole: null,
        isRequired: false,
        isActive: true,
      });
    }
  }

  const preferred = config.rooms.preferredRoomId?.trim() || null;
  const fallback = new Set(config.rooms.fallbackRoomIds.map((id) => id.trim()).filter(Boolean));
  const roomRows: RoomEligibilitySyncRow[] = [];

  if (config.rooms.requirement !== "not_required") {
    for (const roomId of config.rooms.eligibleRoomIds) {
      const id = roomId.trim();
      if (!id) continue;
      roomRows.push({
        roomId: id,
        isPreferred: preferred === id,
        isActive: true,
        metadata: fallback.has(id) ? { fallback: true } : {},
      });
    }
  }

  const resourceRows: ResourceRequirementSyncRow[] = [];
  let sort = 0;

  if (config.rooms.requirement === "required" && preferred) {
    resourceRows.push({
      resource_type: "room_id",
      resource_key: preferred,
      requirement_label: "Preferred room",
      is_required: true,
      quantity: 1,
      sort_order: sort++,
      metadata: { source: "service_setup", automatic: config.rooms.automaticAllocation },
    });
  }

  for (const key of config.rooms.resourceRequirementKeys) {
    const k = key.trim();
    if (!k) continue;
    resourceRows.push({
      resource_type: "room_type",
      resource_key: k,
      requirement_label: `Resource: ${k}`,
      is_required: config.rooms.requirement === "required",
      quantity: 1,
      sort_order: sort++,
      metadata: { source: "service_setup" },
    });
  }

  if (config.surgicalTeam) {
    for (const slot of config.surgicalTeam) {
      if (slot.minimum <= 0 && !slot.required) continue;
      resourceRows.push({
        resource_type: "staff_role",
        resource_key: SLOT_ROLE_KEY[slot.slot] ?? slot.slot,
        requirement_label: `Surgical ${slot.slot}`,
        is_required: slot.required,
        quantity: Math.max(slot.minimum, slot.required ? 1 : 0) || 1,
        sort_order: sort++,
        metadata: {
          source: "service_setup",
          surgical_slot: slot.slot,
          preferred_quantity: slot.preferred,
          automatically_allocate: slot.automaticallyAllocate,
        },
      });
    }
  }

  return { staffRows, roomRows, resourceRows };
}
