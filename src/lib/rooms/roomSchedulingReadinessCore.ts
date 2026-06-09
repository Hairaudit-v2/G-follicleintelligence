import { isNonRoomRequiredService } from "@/src/lib/rooms/evolvedPerthServiceEligibilitySeedPlan";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import {
  isCalendarVisibleClinicalStaff,
  isNonCalendarSupportRole,
} from "@/src/lib/staff/calendarVisibleStaff";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";

export type ReadinessCheckStatus = "pass" | "warning" | "fail";

export type OverallReadinessStatus = "ready" | "warning" | "needs_setup";

export type RoomSchedulingReadinessCheck = {
  key: string;
  label: string;
  status: ReadinessCheckStatus;
  message: string;
  href?: string;
  actionLabel?: string;
};

export type RoomSchedulingReadinessResult = {
  overallStatus: OverallReadinessStatus;
  clinicId: string | null;
  clinicName: string | null;
  checks: RoomSchedulingReadinessCheck[];
};

export type RoomSchedulingReadinessStaffRow = {
  id: string;
  full_name: string;
  staff_role: string | null;
  is_active: boolean;
  calendar_visible: boolean | null;
};

export type RoomSchedulingReadinessRoomEligibilityRow = {
  room_id: string;
  is_preferred: boolean;
  is_active: boolean;
};

export type RoomSchedulingReadinessStaffEligibilityRow = {
  staff_id: string | null;
  staff_role: string | null;
  is_active: boolean;
};

export type RoomSchedulingReadinessInput = {
  tenantId: string;
  clinicId: string;
  clinicName: string;
  rooms: FiClinicRoomRow[];
  services: FiServiceRow[];
  roomEligibilityByServiceId: Map<string, RoomSchedulingReadinessRoomEligibilityRow[]>;
  staffEligibilityByServiceId: Map<string, RoomSchedulingReadinessStaffEligibilityRow[]>;
  staff: RoomSchedulingReadinessStaffRow[];
};

const EXPECTED_PHYSICAL_ALIASES: Array<{ codes: [string, string]; label: string }> = [
  { codes: ["cons_2", "patient_room_2"], label: "Consult Room 2 / Patient Room 2" },
  { codes: ["prp_2", "surgery_2"], label: "PRP Room 2 / Surgery 2" },
];

const PREFERRED_ROOM_BY_BOOKING_TYPE: Record<string, string> = {
  consultation: "cons_1",
  follow_up: "cons_1",
  review: "cons_1",
  prp: "prp_1",
  prf: "prp_1",
  exosomes: "prp_1",
  mesotherapy: "prp_1",
  surgery: "surgery_1",
};

function paths(tenantId: string) {
  const base = `/fi-admin/${tenantId.trim()}`;
  return {
    rooms: `${base}/rooms`,
    services: `${base}/services`,
    calendarRoom: `${base}/calendar?view=day&resourceView=room`,
    staff: `${base}/staff`,
  };
}

function activeRooms(rooms: FiClinicRoomRow[]): FiClinicRoomRow[] {
  return rooms.filter((r) => r.is_active);
}

function roomsOfTypes(rooms: FiClinicRoomRow[], types: string[]): FiClinicRoomRow[] {
  return activeRooms(rooms).filter((r) => types.includes(r.room_type));
}

function roomByCode(rooms: FiClinicRoomRow[], code: string): FiClinicRoomRow | undefined {
  return rooms.find((r) => r.room_code.trim() === code);
}

function serviceNeedsRoomMapping(service: FiServiceRow): boolean {
  if (!service.is_active) return false;
  return !isNonRoomRequiredService({
    id: service.id,
    name: service.name,
    booking_type: service.booking_type,
    category: service.category,
    is_active: service.is_active,
  });
}

export function computeOverallReadinessStatus(checks: RoomSchedulingReadinessCheck[]): OverallReadinessStatus {
  if (checks.some((c) => c.key === "active_rooms" && c.status === "fail")) return "needs_setup";
  if (checks.some((c) => c.status === "fail")) return "needs_setup";
  if (checks.some((c) => c.status === "warning")) return "warning";
  return "ready";
}

export function buildRoomSchedulingReadinessChecks(input: RoomSchedulingReadinessInput): RoomSchedulingReadinessCheck[] {
  const p = paths(input.tenantId);
  const active = activeRooms(input.rooms);
  const checks: RoomSchedulingReadinessCheck[] = [];

  checks.push({
    key: "active_rooms",
    label: "Active clinic rooms",
    status: active.length > 0 ? "pass" : "fail",
    message:
      active.length > 0
        ? `${active.length} active room${active.length === 1 ? "" : "s"} configured for ${input.clinicName}.`
        : "No active rooms for this clinic. Add rooms before booking appointments.",
    href: p.rooms,
    actionLabel: "Manage rooms",
  });

  const consultRooms = roomsOfTypes(input.rooms, ["consult", "patient", "multi_use"]);
  checks.push({
    key: "consult_room",
    label: "Consultation rooms",
    status: consultRooms.length > 0 ? "pass" : "fail",
    message:
      consultRooms.length > 0
        ? `${consultRooms.length} active consultation-capable room${consultRooms.length === 1 ? "" : "s"}.`
        : "No active consult or patient rooms. Consultations cannot be scheduled.",
    href: p.rooms,
    actionLabel: "Manage rooms",
  });

  const prpRooms = roomsOfTypes(input.rooms, ["prp", "multi_use"]).filter(
    (r) => r.room_type === "prp" || r.capabilities.some((c) => /prp|exosome|prf|regenerative/i.test(c))
  );
  checks.push({
    key: "prp_room",
    label: "PRP / regenerative rooms",
    status: prpRooms.length > 0 ? "pass" : "fail",
    message:
      prpRooms.length > 0
        ? `${prpRooms.length} active PRP/regenerative room${prpRooms.length === 1 ? "" : "s"}.`
        : "No active PRP or regenerative treatment rooms.",
    href: p.rooms,
    actionLabel: "Manage rooms",
  });

  const surgeryRooms = roomsOfTypes(input.rooms, ["surgery", "multi_use"]).filter(
    (r) => r.room_type === "surgery" || r.capabilities.some((c) => /surgery/i.test(c))
  );
  checks.push({
    key: "surgery_room",
    label: "Surgery rooms",
    status: surgeryRooms.length > 0 ? "pass" : "fail",
    message:
      surgeryRooms.length > 0
        ? `${surgeryRooms.length} active surgery room${surgeryRooms.length === 1 ? "" : "s"}.`
        : "No active surgery rooms.",
    href: p.rooms,
    actionLabel: "Manage rooms",
  });

  const bookableServices = input.services.filter((s) => serviceNeedsRoomMapping(s));
  const unmappedRoomServices = bookableServices.filter((s) => {
    const rows = (input.roomEligibilityByServiceId.get(s.id) ?? []).filter((r) => r.is_active);
    return rows.length === 0;
  });

  checks.push({
    key: "service_room_eligibility",
    label: "Service room eligibility",
    status:
      bookableServices.length === 0
        ? "warning"
        : unmappedRoomServices.length === 0
          ? "pass"
          : "warning",
    message:
      bookableServices.length === 0
        ? "No active in-clinic services in the catalog yet."
        : unmappedRoomServices.length === 0
          ? `All ${bookableServices.length} in-clinic service${bookableServices.length === 1 ? "" : "s"} have eligible rooms.`
          : `${unmappedRoomServices.length} of ${bookableServices.length} in-clinic service${bookableServices.length === 1 ? "" : "s"} lack room eligibility (${unmappedRoomServices
              .slice(0, 3)
              .map((s) => s.name)
              .join(", ")}${unmappedRoomServices.length > 3 ? "…" : ""}).`,
    href: p.services,
    actionLabel: "Edit services",
  });

  const unmappedStaffServices = bookableServices.filter((s) => {
    const rows = (input.staffEligibilityByServiceId.get(s.id) ?? []).filter((r) => r.is_active);
    return rows.length === 0;
  });

  checks.push({
    key: "service_staff_eligibility",
    label: "Service staff eligibility",
    status:
      bookableServices.length === 0
        ? "warning"
        : unmappedStaffServices.length === 0
          ? "pass"
          : unmappedStaffServices.length === bookableServices.length
            ? "warning"
            : "warning",
    message:
      bookableServices.length === 0
        ? "Add services before configuring staff eligibility."
        : unmappedStaffServices.length === 0
          ? "Every in-clinic service has staff role or member eligibility."
          : `${unmappedStaffServices.length} service${unmappedStaffServices.length === 1 ? "" : "s"} missing staff eligibility rules.`,
    href: p.services,
    actionLabel: "Edit services",
  });

  const calendarVisible = input.staff.filter((s) =>
    isCalendarVisibleClinicalStaff({
      is_active: s.is_active,
      staff_role: s.staff_role,
      calendar_visible: s.calendar_visible,
    })
  );

  checks.push({
    key: "calendar_visible_clinical_staff",
    label: "Calendar-visible clinical staff",
    status: calendarVisible.length > 0 ? "pass" : "warning",
    message:
      calendarVisible.length > 0
        ? `${calendarVisible.length} active clinical provider${calendarVisible.length === 1 ? "" : "s"} appear on the calendar.`
        : "No calendar-visible clinical staff. Provider columns will be empty.",
    href: p.staff,
    actionLabel: "Manage staff",
  });

  const supportVisible = input.staff.filter(
    (s) =>
      s.is_active &&
      isNonCalendarSupportRole(s.staff_role) &&
      isCalendarVisibleClinicalStaff({
        is_active: s.is_active,
        staff_role: s.staff_role,
        calendar_visible: s.calendar_visible,
      })
  );

  checks.push({
    key: "reception_excluded_from_calendar",
    label: "Reception / admin excluded from calendar",
    status: supportVisible.length === 0 ? "pass" : "warning",
    message:
      supportVisible.length === 0
        ? "Reception and admin roles are not shown as calendar provider columns."
        : `${supportVisible.length} reception/admin staff ${supportVisible.length === 1 ? "is" : "are"} calendar-visible (check calendar_visible override).`,
    href: p.staff,
    actionLabel: "Review staff",
  });

  const aliasIssues: string[] = [];
  for (const group of EXPECTED_PHYSICAL_ALIASES) {
    const [aCode, bCode] = group.codes;
    const a = roomByCode(input.rooms, aCode);
    const b = roomByCode(input.rooms, bCode);
    if (a && b && a.physical_room_key.trim() !== b.physical_room_key.trim()) {
      aliasIssues.push(`${group.label} use different physical keys (${a.physical_room_key} vs ${b.physical_room_key})`);
    } else if (a && b && a.physical_room_key.trim() === b.physical_room_key.trim()) {
      // ok
    } else if (a || b) {
      aliasIssues.push(`${group.label}: only one label exists — alias pair incomplete`);
    }
  }

  checks.push({
    key: "physical_room_aliases",
    label: "Physical room aliases",
    status: aliasIssues.length === 0 ? "pass" : "warning",
    message:
      aliasIssues.length === 0
        ? "Shared physical rooms (Consult 2 / Patient 2, PRP 2 / Surgery 2) are aligned — overlap protection works across labels."
        : `${aliasIssues.join("; ")}. Misaligned keys risk double-booking the same physical space.`,
    href: p.rooms,
    actionLabel: "Fix room keys",
  });

  const preferredIssues: string[] = [];
  for (const service of bookableServices) {
    const bt = service.booking_type?.trim();
    if (!bt || !PREFERRED_ROOM_BY_BOOKING_TYPE[bt]) continue;
    const expectedCode = PREFERRED_ROOM_BY_BOOKING_TYPE[bt]!;
    const expectedRoom = roomByCode(input.rooms, expectedCode);
    if (!expectedRoom) continue;

    const elig = (input.roomEligibilityByServiceId.get(service.id) ?? []).filter((r) => r.is_active);
    const preferred = elig.find((r) => r.is_preferred);
    if (!preferred) {
      preferredIssues.push(`${service.name}: no preferred room (expected ${expectedCode})`);
    } else if (preferred.room_id !== expectedRoom.id) {
      preferredIssues.push(`${service.name}: preferred room is not ${expectedCode}`);
    }
  }

  checks.push({
    key: "default_preferred_rooms",
    label: "Default preferred rooms",
    status: preferredIssues.length === 0 ? "pass" : "warning",
    message:
      preferredIssues.length === 0
        ? "Consultations → Consult Room 1, PRP/exosomes → PRP Room 1, surgery → Surgery 1 (where mapped)."
        : preferredIssues.slice(0, 3).join("; ") + (preferredIssues.length > 3 ? "…" : ""),
    href: p.services,
    actionLabel: "Set preferred rooms",
  });

  return checks;
}

export function buildRoomSchedulingReadinessResult(input: RoomSchedulingReadinessInput): RoomSchedulingReadinessResult {
  const checks = buildRoomSchedulingReadinessChecks(input);
  return {
    overallStatus: computeOverallReadinessStatus(checks),
    clinicId: input.clinicId,
    clinicName: input.clinicName,
    checks,
  };
}
