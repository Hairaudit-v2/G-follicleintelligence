"use client";

import {
  CANONICAL_SERVICE_ROLE_DEFINITIONS,
  CANONICAL_SERVICE_ROLES,
  type CanonicalServiceRoleId,
} from "@/src/lib/services/setup/canonicalServiceRoles";
import {
  SERVICE_FAMILY_TEMPLATES,
  applyServiceFamilyTemplate,
} from "@/src/lib/services/setup/serviceFamilyTemplates";
import {
  CLINICAL_TIER_LEVELS,
  ROOM_REQUIREMENT_MODES,
  SERVICE_FAMILY_IDS,
  STAFF_ALLOCATION_MODES,
  STAFF_ALLOCATION_STRATEGIES,
  SURGICAL_TEAM_SLOTS,
  type ServiceFamilyId,
  type ServiceSetupConfig,
  type StaffAllocationMode,
  type StaffAllocationStrategy,
  type SurgicalTeamSlotConfig,
} from "@/src/lib/services/setup/serviceSetupTypes";
import { evaluateServiceSetupActivation } from "@/src/lib/services/setup/serviceSetupValidation";
import type { ServicesCatalogStaffOption } from "@/src/lib/services/fiServiceTypes";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";

const MODE_LABELS: Record<StaffAllocationMode, string> = {
  automatic: "Automatic allocation",
  manual: "Manual staff selection",
  staff_not_required: "Staff not required",
  assign_later: "Assign later",
};

const STRATEGY_LABELS: Record<StaffAllocationStrategy, string> = {
  preferred_role_order: "Preferred role order",
  preferred_named_staff: "Preferred named staff",
  best_availability: "Best availability",
  continuity_of_care: "Continuity of care",
  round_robin: "Round robin",
  lowest_workload: "Lowest workload",
};

function toggleId(list: string[], id: string, on: boolean): string[] {
  if (on) return list.includes(id) ? list : [...list, id];
  return list.filter((x) => x !== id);
}

function toggleRole(
  list: CanonicalServiceRoleId[],
  role: CanonicalServiceRoleId,
  on: boolean
): CanonicalServiceRoleId[] {
  if (on) return list.includes(role) ? list : [...list, role];
  return list.filter((x) => x !== role);
}

export function ServiceSetupEditorPanel({
  setup,
  onChange,
  rooms,
  staffOptions,
  staffCountByRole,
  roomsBaseHref,
}: {
  setup: ServiceSetupConfig;
  onChange: (next: ServiceSetupConfig) => void;
  rooms: FiClinicRoomRow[];
  staffOptions: ServicesCatalogStaffOption[];
  staffCountByRole: Record<string, number>;
  roomsBaseHref: string;
}) {
  const activation = evaluateServiceSetupActivation(setup, {
    staffCountByRole,
    availableRoomIds: rooms.filter((r) => r.is_active).map((r) => r.id),
  });

  const applyFamily = (familyId: ServiceFamilyId) => {
    onChange(applyServiceFamilyTemplate(familyId, setup));
  };

  const patchRooms = (partial: Partial<ServiceSetupConfig["rooms"]>) => {
    onChange({ ...setup, rooms: { ...setup.rooms, ...partial } });
  };

  const patchAllocation = (partial: Partial<ServiceSetupConfig["staffAllocation"]>) => {
    onChange({
      ...setup,
      staffAllocation: { ...setup.staffAllocation, ...partial },
    });
  };

  const patchCompetency = (partial: Partial<ServiceSetupConfig["competency"]>) => {
    onChange({
      ...setup,
      competency: { ...setup.competency, ...partial },
    });
  };

  const updateSurgicalSlot = (
    slotId: SurgicalTeamSlotConfig["slot"],
    partial: Partial<SurgicalTeamSlotConfig>
  ) => {
    const current = setup.surgicalTeam ?? [];
    const next = SURGICAL_TEAM_SLOTS.map((slot) => {
      const existing = current.find((s) => s.slot === slot) ?? {
        slot,
        required: false,
        minimum: 0,
        preferred: 0,
        automaticallyAllocate: true,
      };
      return slot === slotId ? { ...existing, ...partial } : existing;
    });
    onChange({ ...setup, surgicalTeam: next });
  };

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Service family template
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Templates preselect eligible roles, rooms, and allocation behaviour. Everything stays
          editable.
        </p>
        <select
          className="mt-2 block w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
          value={setup.serviceFamily}
          onChange={(e) => applyFamily(e.target.value as ServiceFamilyId)}
        >
          {SERVICE_FAMILY_IDS.map((id) => (
            <option key={id} value={id}>
              {SERVICE_FAMILY_TEMPLATES[id].label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          {SERVICE_FAMILY_TEMPLATES[setup.serviceFamily].description}
        </p>
      </div>

      {setup.legacyRolesForReview.length > 0 ? (
        <div
          className="rounded border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100"
          role="status"
        >
          <p className="font-medium">Legacy roles need review</p>
          <p className="mt-1">
            These values could not be mapped to canonical FiOS roles and were preserved:{" "}
            {setup.legacyRolesForReview.join(", ")}.
          </p>
          <button
            type="button"
            className="mt-2 text-amber-200 underline"
            onClick={() => onChange({ ...setup, legacyRolesForReview: [] })}
          >
            Dismiss after review
          </button>
        </div>
      ) : null}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Eligible roles
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {CANONICAL_SERVICE_ROLES.map((role) => {
            const def = CANONICAL_SERVICE_ROLE_DEFINITIONS[role];
            return (
              <label key={role} className="flex items-start gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={setup.eligibleRoles.includes(role)}
                  onChange={(e) =>
                    onChange({
                      ...setup,
                      eligibleRoles: toggleRole(setup.eligibleRoles, role, e.target.checked),
                    })
                  }
                />
                <span>
                  <span className="font-medium text-slate-200">{def.label}</span>
                  <span className="block text-slate-500">{def.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Staff allocation
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-300">
            Allocation mode
            <select
              className="mt-1 block w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
              value={setup.staffAllocation.mode}
              onChange={(e) =>
                patchAllocation({ mode: e.target.value as StaffAllocationMode })
              }
            >
              {STAFF_ALLOCATION_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-300">
            Strategy
            <select
              className="mt-1 block w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
              value={setup.staffAllocation.strategy}
              onChange={(e) =>
                patchAllocation({ strategy: e.target.value as StaffAllocationStrategy })
              }
            >
              {STAFF_ALLOCATION_STRATEGIES.map((s) => (
                <option key={s} value={s}>
                  {STRATEGY_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3">
          <p className="text-xs font-medium text-slate-300">Preferred role order</p>
          <p className="text-[11px] text-slate-500">
            Click roles in priority order. Selected order:{" "}
            {setup.staffAllocation.preferredRoleOrder.join(" → ") || "none"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {setup.eligibleRoles.map((role) => {
              const idx = setup.staffAllocation.preferredRoleOrder.indexOf(role);
              const selected = idx >= 0;
              return (
                <button
                  key={role}
                  type="button"
                  className={
                    selected
                      ? "rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100"
                      : "rounded border border-slate-700 px-2 py-1 text-xs text-slate-400"
                  }
                  onClick={() => {
                    const order = [...setup.staffAllocation.preferredRoleOrder];
                    if (selected) {
                      patchAllocation({
                        preferredRoleOrder: order.filter((r) => r !== role),
                      });
                    } else {
                      patchAllocation({ preferredRoleOrder: [...order, role] });
                    }
                  }}
                >
                  {selected ? `${idx + 1}. ` : ""}
                  {CANONICAL_SERVICE_ROLE_DEFINITIONS[role].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3">
          <p className="text-xs font-medium text-slate-300">Preferred named staff</p>
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded border border-slate-800 p-2">
            {staffOptions.length === 0 ? (
              <p className="text-xs text-slate-500">No staff loaded for this tenant.</p>
            ) : (
              staffOptions
                .filter((s) => s.is_active)
                .map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={setup.staffAllocation.preferredStaffIds.includes(s.id)}
                      onChange={(e) =>
                        patchAllocation({
                          preferredStaffIds: toggleId(
                            setup.staffAllocation.preferredStaffIds,
                            s.id,
                            e.target.checked
                          ),
                        })
                      }
                    />
                    {s.full_name}
                    {s.staff_role ? (
                      <span className="text-slate-500">({s.staff_role})</span>
                    ) : null}
                  </label>
                ))
            )}
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Competency requirements
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-300">
            Minimum clinical tier
            <select
              className="mt-1 block w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
              value={setup.competency.minimumClinicalTier ?? ""}
              onChange={(e) =>
                patchCompetency({
                  minimumClinicalTier: e.target.value
                    ? (Number(e.target.value) as (typeof CLINICAL_TIER_LEVELS)[number])
                    : null,
                })
              }
            >
              <option value="">None</option>
              {CLINICAL_TIER_LEVELS.map((t) => (
                <option key={t} value={t}>
                  Tier {t}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-300">
            Required certification keys (comma-separated)
            <input
              className="mt-1 block w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
              value={setup.competency.requiredCertificationKeys.join(", ")}
              onChange={(e) =>
                patchCompetency({
                  requiredCertificationKeys: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="e.g. regenerative_treatment"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <input
              type="checkbox"
              checked={setup.competency.supervisionAllowed}
              onChange={(e) => patchCompetency({ supervisionAllowed: e.target.checked })}
            />
            Supervision allowed
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <input
              type="checkbox"
              checked={setup.competency.surgeryLeadRequired}
              onChange={(e) => patchCompetency({ surgeryLeadRequired: e.target.checked })}
            />
            Surgery lead required
          </label>
        </div>
      </div>

      {setup.serviceFamily === "surgery" || setup.surgicalTeam ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Surgical team requirements
          </p>
          <div className="mt-2 space-y-2">
            {SURGICAL_TEAM_SLOTS.map((slot) => {
              const row = setup.surgicalTeam?.find((s) => s.slot === slot) ?? {
                slot,
                required: false,
                minimum: 0,
                preferred: 0,
                automaticallyAllocate: true,
              };
              return (
                <div
                  key={slot}
                  className="grid grid-cols-2 gap-2 rounded border border-slate-800 p-2 sm:grid-cols-5"
                >
                  <p className="col-span-2 text-xs font-medium capitalize text-slate-200 sm:col-span-1">
                    {slot}
                  </p>
                  <label className="flex items-center gap-1 text-[11px] text-slate-400">
                    <input
                      type="checkbox"
                      checked={row.required}
                      onChange={(e) => updateSurgicalSlot(slot, { required: e.target.checked })}
                    />
                    Required
                  </label>
                  <label className="text-[11px] text-slate-400">
                    Min
                    <input
                      type="number"
                      min={0}
                      max={20}
                      className="ml-1 w-14 rounded border border-slate-700 px-1 py-0.5 text-xs"
                      value={row.minimum}
                      onChange={(e) =>
                        updateSurgicalSlot(slot, {
                          minimum: Number.parseInt(e.target.value, 10) || 0,
                        })
                      }
                    />
                  </label>
                  <label className="text-[11px] text-slate-400">
                    Pref
                    <input
                      type="number"
                      min={0}
                      max={20}
                      className="ml-1 w-14 rounded border border-slate-700 px-1 py-0.5 text-xs"
                      value={row.preferred}
                      onChange={(e) =>
                        updateSurgicalSlot(slot, {
                          preferred: Number.parseInt(e.target.value, 10) || 0,
                        })
                      }
                    />
                  </label>
                  <label className="flex items-center gap-1 text-[11px] text-slate-400">
                    <input
                      type="checkbox"
                      checked={row.automaticallyAllocate}
                      onChange={(e) =>
                        updateSurgicalSlot(slot, { automaticallyAllocate: e.target.checked })
                      }
                    />
                    Auto allocate
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Room configuration
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-300">
            Room requirement
            <select
              className="mt-1 block w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
              value={setup.rooms.requirement}
              onChange={(e) =>
                patchRooms({
                  requirement: e.target.value as ServiceSetupConfig["rooms"]["requirement"],
                })
              }
            >
              {ROOM_REQUIREMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m === "not_required"
                    ? "Not required"
                    : m === "optional"
                      ? "Optional"
                      : "Required"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-300 sm:pt-6">
            <input
              type="checkbox"
              checked={setup.rooms.automaticAllocation}
              onChange={(e) => patchRooms({ automaticAllocation: e.target.checked })}
            />
            Automatic room allocation
          </label>
        </div>

        {setup.rooms.requirement === "not_required" ? (
          <p className="mt-2 text-xs text-slate-500">Rooms are not required for this service.</p>
        ) : rooms.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500">
            No rooms configured. Add rooms in{" "}
            <a href={roomsBaseHref} className="text-cyan-300 underline">
              Settings → Rooms
            </a>
            .
          </p>
        ) : (
          <>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {rooms.map((room) => (
                <label key={room.id} className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={setup.rooms.eligibleRoomIds.includes(room.id)}
                    onChange={(e) => {
                      const eligibleRoomIds = toggleId(
                        setup.rooms.eligibleRoomIds,
                        room.id,
                        e.target.checked
                      );
                      const preferredRoomId =
                        !e.target.checked && setup.rooms.preferredRoomId === room.id
                          ? null
                          : setup.rooms.preferredRoomId;
                      const fallbackRoomIds = e.target.checked
                        ? setup.rooms.fallbackRoomIds
                        : setup.rooms.fallbackRoomIds.filter((id) => id !== room.id);
                      patchRooms({ eligibleRoomIds, preferredRoomId, fallbackRoomIds });
                    }}
                  />
                  {room.display_name}
                </label>
              ))}
            </div>
            {setup.rooms.eligibleRoomIds.length > 0 ? (
              <>
                <label className="mt-3 block text-xs font-medium text-slate-300">
                  Preferred room
                  <select
                    className="mt-1 block w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
                    value={setup.rooms.preferredRoomId ?? ""}
                    onChange={(e) =>
                      patchRooms({ preferredRoomId: e.target.value || null })
                    }
                  >
                    <option value="">None</option>
                    {setup.rooms.eligibleRoomIds.map((id) => {
                      const room = rooms.find((r) => r.id === id);
                      return (
                        <option key={id} value={id}>
                          {room?.display_name ?? id}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate-300">Fallback rooms</p>
                  <div className="mt-1 grid gap-1 sm:grid-cols-2">
                    {setup.rooms.eligibleRoomIds
                      .filter((id) => id !== setup.rooms.preferredRoomId)
                      .map((id) => {
                        const room = rooms.find((r) => r.id === id);
                        return (
                          <label
                            key={id}
                            className="flex items-center gap-2 text-xs text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked={setup.rooms.fallbackRoomIds.includes(id)}
                              onChange={(e) =>
                                patchRooms({
                                  fallbackRoomIds: toggleId(
                                    setup.rooms.fallbackRoomIds,
                                    id,
                                    e.target.checked
                                  ),
                                })
                              }
                            />
                            {room?.display_name ?? id}
                          </label>
                        );
                      })}
                  </div>
                </div>
              </>
            ) : null}
          </>
        )}

        <label className="mt-3 block text-xs font-medium text-slate-300">
          Service-specific resource requirements (comma-separated keys)
          <input
            className="mt-1 block w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
            value={setup.rooms.resourceRequirementKeys.join(", ")}
            onChange={(e) =>
              patchRooms({
                resourceRequirementKeys: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="e.g. graft_tray, imaging_cart"
          />
        </label>
      </div>

      {activation.warnings.length > 0 ? (
        <div
          className="rounded border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100"
          role="status"
        >
          <p className="font-medium">
            {activation.canActivate
              ? "Activation warnings"
              : "Cannot activate — save as draft until resources are available"}
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {activation.warnings.map((w) => (
              <li key={`${w.code}-${w.message}`}>{w.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
