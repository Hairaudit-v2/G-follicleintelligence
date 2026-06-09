import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadCrmShellScopePickerOptions } from "@/src/lib/crm/crmShellLoaders";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { EVOLVED_PERTH_CLINIC_DISPLAY_NAME } from "@/src/lib/staffImport/evolvedPayrollStaffImportConstants";
import { loadClinicRoomsForTenant, loadServiceEligibilityMapsForTenant } from "@/src/lib/rooms/fiClinicRooms.server";
import {
  buildRoomSchedulingReadinessResult,
  type RoomSchedulingReadinessResult,
  type RoomSchedulingReadinessRoomEligibilityRow,
  type RoomSchedulingReadinessStaffEligibilityRow,
  type RoomSchedulingReadinessStaffRow,
} from "@/src/lib/rooms/roomSchedulingReadinessCore";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";

export type { RoomSchedulingReadinessCheck, RoomSchedulingReadinessResult, OverallReadinessStatus } from "@/src/lib/rooms/roomSchedulingReadinessCore";

async function resolveClinicForReadiness(
  tenantId: string,
  clinicId?: string | null
): Promise<{ id: string; display_name: string } | null> {
  const scope = await loadCrmShellScopePickerOptions(tenantId);
  const clinics = scope.clinics;
  if (!clinics.length) return null;

  if (clinicId?.trim()) {
    const hit = clinics.find((c) => c.id === clinicId.trim());
    if (hit) return { id: hit.id, display_name: hit.display_name };
  }

  const exact = clinics.find((c) => c.display_name.trim() === EVOLVED_PERTH_CLINIC_DISPLAY_NAME);
  if (exact) return { id: exact.id, display_name: exact.display_name };

  const lower = (s: string) => s.trim().toLowerCase();
  const evolvedPerth = clinics.find((c) => {
    const d = lower(c.display_name);
    return d.includes("perth") && (d.includes("evolved") || d.includes("restoration") || d.includes("hair"));
  });
  if (evolvedPerth) return { id: evolvedPerth.id, display_name: evolvedPerth.display_name };

  const rooms = await loadClinicRoomsForTenant(tenantId);
  const countByClinic = new Map<string, number>();
  for (const r of rooms) {
    countByClinic.set(r.clinic_id, (countByClinic.get(r.clinic_id) ?? 0) + 1);
  }
  let best = clinics[0]!;
  let bestCount = countByClinic.get(best.id) ?? 0;
  for (const c of clinics) {
    const n = countByClinic.get(c.id) ?? 0;
    if (n > bestCount) {
      best = c;
      bestCount = n;
    }
  }
  return { id: best.id, display_name: best.display_name };
}

export async function getRoomSchedulingReadiness(args: {
  tenantId: string;
  clinicId?: string | null;
}): Promise<RoomSchedulingReadinessResult> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const clinic = await resolveClinicForReadiness(tid, args.clinicId);

  if (!clinic) {
    return {
      overallStatus: "needs_setup",
      clinicId: null,
      clinicName: null,
      checks: [
        {
          key: "clinic",
          label: "Clinic site",
          status: "fail",
          message: "No clinic sites found for this tenant. Add a clinic in Configuration first.",
          href: `/fi-admin/${tid}/configuration`,
          actionLabel: "Configuration",
        },
      ],
    };
  }

  const supabase = supabaseAdmin();
  const [rooms, services, eligibilityMaps, staffRes] = await Promise.all([
    loadClinicRoomsForTenant(tid, { clinicId: clinic.id }),
    loadFiServicesForTenant(tid),
    loadServiceEligibilityMapsForTenant(tid),
    supabase
      .from("fi_staff")
      .select("id, full_name, staff_role, is_active, calendar_visible")
      .eq("tenant_id", tid)
      .eq("is_active", true)
      .order("full_name"),
  ]);

  if (staffRes.error) throw new Error(staffRes.error.message);

  const roomEligibilityByServiceId = new Map<string, RoomSchedulingReadinessRoomEligibilityRow[]>();
  for (const [serviceId, rows] of eligibilityMaps.roomByServiceId) {
    roomEligibilityByServiceId.set(
      serviceId,
      rows.map((r) => ({ room_id: r.room_id, is_preferred: r.is_preferred, is_active: r.is_active }))
    );
  }

  const staffEligibilityByServiceId = new Map<string, RoomSchedulingReadinessStaffEligibilityRow[]>();
  for (const [serviceId, rows] of eligibilityMaps.staffByServiceId) {
    staffEligibilityByServiceId.set(
      serviceId,
      rows.map((r) => ({
        staff_id: r.staff_id,
        staff_role: r.staff_role,
        is_active: r.is_active,
      }))
    );
  }

  const staff: RoomSchedulingReadinessStaffRow[] = (staffRes.data ?? []).map((raw) => {
    const r = raw as {
      id: string;
      full_name: string;
      staff_role: string | null;
      is_active: boolean;
      calendar_visible: boolean | null;
    };
    return {
      id: String(r.id),
      full_name: String(r.full_name ?? "").trim() || "Staff",
      staff_role: r.staff_role != null ? String(r.staff_role) : null,
      is_active: Boolean(r.is_active),
      calendar_visible: r.calendar_visible == null ? null : Boolean(r.calendar_visible),
    };
  });

  return buildRoomSchedulingReadinessResult({
    tenantId: tid,
    clinicId: clinic.id,
    clinicName: clinic.display_name,
    rooms,
    services,
    roomEligibilityByServiceId,
    staffEligibilityByServiceId,
    staff,
  });
}
