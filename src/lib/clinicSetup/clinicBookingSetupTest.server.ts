import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { findNextAvailableBookingSlots } from "@/src/lib/calendar/findNextAvailableBookingSlots.server";
import { categorizeServiceForWizard } from "@/src/lib/clinicSetup/clinicSetupWizardCore";
import {
  loadClinicRoomsForTenant,
  loadServiceRoomEligibilityForService,
  loadServiceStaffEligibilityForService,
} from "@/src/lib/rooms/fiClinicRooms.server";
import { filterRoomEligibilityForClinic } from "@/src/lib/rooms/roomAvailability.server";
import type { FiClinicRoomRow, FiServiceRoomEligibilityRow } from "@/src/lib/rooms/roomTypes";
import { isStaffEligibleForServiceRules } from "@/src/lib/rooms/roomAvailabilityCore";
import { isSupportStaffRole } from "@/src/lib/staff/clinicalStaffPicker";
import { isStaffBookableForClinicalWorkflow } from "@/src/lib/staff/staffRolePolicy";
import {
  isCalendarVisibleClinicalStaff,
  isNonCalendarSupportRole,
} from "@/src/lib/staff/calendarVisibleStaff";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";
import type {
  ClinicBookingSetupHygieneRow,
  ClinicBookingSetupTestProfile,
  ClinicBookingSetupTestResult,
  ClinicBookingSetupTestRow,
  ClinicBookingSetupTestRowStatus,
} from "@/src/lib/clinicSetup/clinicBookingSetupTestTypes";
import {
  AUTOFIX_KEY_CLINICAL_CALENDAR_RESTORE,
  AUTOFIX_KEY_PERTH_PHYSICAL_ALIASES,
  AUTOFIX_KEY_SUPPORT_CALENDAR,
  preferredRoomFixKey,
  roomEligibilityFixKey,
  staffEligibilityFixKey,
} from "@/src/lib/clinicSetup/clinicBookingSetupAutoFix.server";

export type {
  ClinicBookingSetupHygieneRow,
  ClinicBookingSetupTestProfile,
  ClinicBookingSetupTestResult,
  ClinicBookingSetupTestRow,
  ClinicBookingSetupTestRowStatus,
} from "@/src/lib/clinicSetup/clinicBookingSetupTestTypes";

const BASE = (tenantId: string) => `/fi-admin/${tenantId.trim()}`;

function worstBookingSetupStatus(
  a: ClinicBookingSetupTestRowStatus,
  b: ClinicBookingSetupTestRowStatus
): ClinicBookingSetupTestRowStatus {
  if (a === "fail" || b === "fail") return "fail";
  if (a === "warning" || b === "warning") return "warning";
  return "pass";
}

async function buildBookingSetupHygiene(args: {
  client: SupabaseClient;
  tenantId: string;
  clinicId: string;
  rooms: FiClinicRoomRow[];
}): Promise<ClinicBookingSetupHygieneRow[]> {
  const hygiene: ClinicBookingSetupHygieneRow[] = [];
  const tid = args.tenantId;
  const cid = args.clinicId;

  const { data: staffRaw, error } = await args.client
    .from("fi_staff")
    .select("staff_role, calendar_visible")
    .eq("tenant_id", tid)
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  const allStaff = (staffRaw ?? []).map((raw) => ({
    staff_role: (raw as { staff_role?: string | null }).staff_role,
    calendar_visible: (raw as { calendar_visible?: boolean | null }).calendar_visible,
  }));

  if (allStaff.some((s) => isSupportStaffRole(s.staff_role) && s.calendar_visible === true)) {
    hygiene.push({
      id: "support_roles_calendar",
      label: "Support roles on the calendar",
      status: "warning",
      message:
        "One or more reception / admin / coordinator accounts are explicitly visible on the FI calendar. Clinical workflows normally hide these roles.",
      suggestedAction: "Hide support roles from the calendar or adjust visibility in Staff.",
      href: `${BASE(tid)}/staff`,
      fixKeys: [AUTOFIX_KEY_SUPPORT_CALENDAR],
    });
  }

  if (
    allStaff.some((s) => {
      if (s.calendar_visible !== false) return false;
      if (isNonCalendarSupportRole(s.staff_role)) return false;
      return isCalendarVisibleClinicalStaff({
        is_active: true,
        staff_role: s.staff_role,
        calendar_visible: null,
      });
    })
  ) {
    hygiene.push({
      id: "clinical_calendar_hidden",
      label: "Clinical staff hidden from calendar",
      status: "warning",
      message:
        "At least one clinical provider has “Show on calendar” turned off. Eligible staff may not appear as assignees until visibility is restored.",
      suggestedAction:
        "Clear the calendar visibility override for affected staff, or run “Fix automatically”.",
      href: `${BASE(tid)}/staff`,
      fixKeys: [AUTOFIX_KEY_CLINICAL_CALENDAR_RESTORE],
    });
  }

  const clinicRooms = args.rooms.filter((r) => r.clinic_id === cid);
  const byCode = new Map(clinicRooms.map((r) => [r.room_code.trim().toLowerCase(), r]));
  const cons2 = byCode.get("cons_2");
  const patient2 = byCode.get("patient_room_2");
  const prp2 = byCode.get("prp_2");
  const surg2 = byCode.get("surgery_2");
  if (cons2 && patient2 && prp2 && surg2) {
    const pkMismatch = patient2.physical_room_key.trim() !== cons2.physical_room_key.trim();
    const prpSurgMismatch = prp2.physical_room_key.trim() !== surg2.physical_room_key.trim();
    if (pkMismatch || prpSurgMismatch) {
      hygiene.push({
        id: "perth_second_room_aliases",
        label: "Perth-style second-room physical keys",
        status: "warning",
        message:
          "Evolved Perth second-room pairing expects patient_room_2 to share cons_2’s physical key, and prp_2 / surgery_2 to share one physical treatment suite key.",
        suggestedAction: "Apply the standard alias pairing (skips rooms marked manual override).",
        href: `${BASE(tid)}/settings/clinic-setup`,
        fixKeys: [AUTOFIX_KEY_PERTH_PHYSICAL_ALIASES],
      });
    }
  }

  return hygiene;
}

function pickFirstByName(services: FiServiceRow[]): FiServiceRow | null {
  if (!services.length) return null;
  return [...services].sort((a, b) => a.name.localeCompare(b.name))[0] ?? null;
}

function pickConsultService(services: FiServiceRow[]): FiServiceRow | null {
  const candidates = services.filter(
    (s) =>
      s.is_active &&
      (s.booking_type === "consultation" || categorizeServiceForWizard(s) === "consult_strict")
  );
  return pickFirstByName(candidates);
}

function pickRegenerativeService(services: FiServiceRow[]): FiServiceRow | null {
  const bt = new Set(["prp", "exosomes", "mesotherapy", "prf"]);
  const byBt = services.filter((s) => s.is_active && s.booking_type && bt.has(s.booking_type));
  if (byBt.length) return pickFirstByName(byBt);
  const byCat = services.filter(
    (s) => s.is_active && categorizeServiceForWizard(s) === "regenerative"
  );
  return pickFirstByName(byCat);
}

function pickSurgeryService(services: FiServiceRow[]): FiServiceRow | null {
  const byBt = services.filter((s) => s.is_active && s.booking_type === "surgery");
  if (byBt.length) return pickFirstByName(byBt);
  const byCat = services.filter((s) => s.is_active && categorizeServiceForWizard(s) === "surgery");
  return pickFirstByName(byCat);
}

function pickFollowUpService(services: FiServiceRow[]): FiServiceRow | null {
  const byBt = services.filter(
    (s) => s.is_active && (s.booking_type === "follow_up" || s.booking_type === "review")
  );
  if (byBt.length) return pickFirstByName(byBt);
  const byCat = services.filter(
    (s) => s.is_active && categorizeServiceForWizard(s) === "consult_loose"
  );
  return pickFirstByName(byCat);
}

function pickServiceForProfile(
  services: FiServiceRow[],
  profile: ClinicBookingSetupTestProfile
): FiServiceRow | null {
  switch (profile) {
    case "consult":
      return pickConsultService(services);
    case "regenerative":
      return pickRegenerativeService(services);
    case "surgery":
      return pickSurgeryService(services);
    case "follow_up":
      return pickFollowUpService(services);
    default:
      return null;
  }
}

type StaffRow = {
  id: string;
  full_name: string;
  staff_role: string;
  is_active: boolean;
  calendar_visible: boolean | null;
};

function loadVisibleClinicalStaffRows(
  supabase: SupabaseClient,
  tenantId: string
): Promise<StaffRow[]> {
  return (async () => {
    const { data, error } = await supabase
      .from("fi_staff")
      .select("id, full_name, staff_role, is_active, calendar_visible")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    return (data ?? [])
      .map((raw) => {
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
          staff_role: String(r.staff_role ?? ""),
          is_active: Boolean(r.is_active),
          calendar_visible: r.calendar_visible == null ? null : Boolean(r.calendar_visible),
        };
      })
      .filter((s) => isStaffBookableForClinicalWorkflow(s))
      .filter((s) => !isSupportStaffRole(s.staff_role))
      .filter((s) =>
        isCalendarVisibleClinicalStaff({
          is_active: s.is_active,
          staff_role: s.staff_role,
          calendar_visible: s.calendar_visible,
        })
      );
  })();
}

function hasEligibleVisibleStaff(
  staffRows: StaffRow[],
  rules: Awaited<ReturnType<typeof loadServiceStaffEligibilityForService>>
): boolean {
  const active = rules.filter((r) => r.is_active);
  if (active.length === 0) return false;
  for (const st of staffRows) {
    if (isStaffEligibleForServiceRules(st.id, st.staff_role, active)) return true;
  }
  return false;
}

function simplifyPreferredRoomLabel(
  roomElig: FiServiceRoomEligibilityRow[],
  roomById: Map<string, { display_name: string; is_active: boolean }>
): string {
  const pref = roomElig.find((e) => e.is_preferred);
  if (pref) {
    const r = roomById.get(pref.room_id);
    if (r?.is_active) return r.display_name;
  }
  const any = roomElig[0];
  const r0 = any ? roomById.get(any.room_id) : null;
  return r0?.display_name ?? "an eligible room";
}

/** Refine success message preferred room label without duplicated lookup logic. */
function buildSuccessMessage(args: {
  serviceName: string;
  roomElig: FiServiceRoomEligibilityRow[];
  roomById: Map<string, { display_name: string; is_active: boolean }>;
  visibleStaff: StaffRow[];
  staffRules: Awaited<ReturnType<typeof loadServiceStaffEligibilityForService>>;
  slotsOpen: Awaited<ReturnType<typeof findNextAvailableBookingSlots>>;
  pieces: string[];
  staffSlotTail: string;
}): string {
  const primaryRoomLabel = simplifyPreferredRoomLabel(args.roomElig, args.roomById);
  const activeRules = args.staffRules.filter((r) => r.is_active);
  const preferredStaff = args.visibleStaff.find((st) =>
    isStaffEligibleForServiceRules(st.id, st.staff_role, activeRules)
  );
  const roleHint =
    preferredStaff?.full_name ??
    (activeRules.length ? "an eligible clinical assignee" : "a clinical assignee");
  const first = args.slotsOpen.slots[0];
  const slotBit = first ? ` ${first.reason.replace(/\.$/, "")}.` : "";
  const note = args.pieces.length ? ` Note: ${args.pieces.join(" ")}` : "";
  return `“${args.serviceName}” is ready. FI OS can assign ${primaryRoomLabel} and ${roleHint}.${slotBit}${note}${args.staffSlotTail}`;
}

export async function runClinicBookingSetupTest(args: {
  tenantId: string;
  clinicId: string;
  client?: SupabaseClient;
}): Promise<ClinicBookingSetupTestResult> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(args.clinicId, "clinicId");
  const client = args.client ?? supabaseAdmin();

  const [services, rooms, visibleStaff] = await Promise.all([
    loadFiServicesForTenant(tid),
    loadClinicRoomsForTenant(tid, { clinicId: cid, activeOnly: false }, client),
    loadVisibleClinicalStaffRows(client, tid),
  ]);

  const profiles: Array<{ profile: ClinicBookingSetupTestProfile; label: string }> = [
    { profile: "consult", label: "Consultation booking" },
    { profile: "regenerative", label: "PRP / exosomes booking" },
    { profile: "surgery", label: "Surgery booking" },
    { profile: "follow_up", label: "Follow-up booking" },
  ];

  const tests: ClinicBookingSetupTestRow[] = [];

  for (const { profile, label } of profiles) {
    const service = pickServiceForProfile(services, profile);
    if (!service) {
      tests.push({
        profile,
        label,
        status: "fail",
        message: `No active ${label.toLowerCase()} service was found in your catalogue.`,
        suggestedAction:
          "Add or activate a matching service and set its booking type where possible.",
        href: `${BASE(tid)}/services`,
      });
      continue;
    }

    const roomEligRaw = await loadServiceRoomEligibilityForService(tid, service.id, client);
    const roomElig = filterRoomEligibilityForClinic(roomEligRaw, cid).filter(
      (e) => e.is_active
    ) as FiServiceRoomEligibilityRow[];
    const roomById = new Map(
      rooms.map((r) => [r.id, { display_name: r.display_name, is_active: r.is_active }])
    );

    if (roomElig.length === 0) {
      tests.push({
        profile,
        label,
        status: "fail",
        message: `“${service.name}” has no room links for this clinic — FI OS cannot assign a room.`,
        suggestedAction: "Run Clinic setup or map eligible rooms under Services.",
        href: `${BASE(tid)}/services`,
        fixKeys: [roomEligibilityFixKey(profile)],
      });
      continue;
    }

    const preferredRows = roomElig.filter((e) => e.is_preferred);
    const pieces: string[] = [];
    if (preferredRows.length === 0) {
      pieces.push("No preferred room is set; the first eligible room will be used.");
    } else {
      const prefOk = preferredRows.some((e) => {
        const room = roomById.get(e.room_id);
        return room?.is_active;
      });
      if (!prefOk)
        pieces.push("Preferred room is missing or inactive; another eligible room may be used.");
    }

    const staffRulesRaw = await loadServiceStaffEligibilityForService(tid, service.id, client);
    const staffRules = staffRulesRaw.filter((r) => r.is_active);

    if (staffRules.length === 0) {
      pieces.push("No staff eligibility rules are configured for this service.");
    } else if (!hasEligibleVisibleStaff(visibleStaff, staffRules)) {
      tests.push({
        profile,
        label,
        status: "fail",
        message: `“${service.name}” has staff rules, but no calendar-visible clinical assignee matches them (reception and admin are excluded by default).`,
        suggestedAction:
          "Adjust staff eligibility, turn on “Show on calendar” for a qualified provider, or use Clinic setup.",
        href: `${BASE(tid)}/staff`,
        fixKeys: [staffEligibilityFixKey(profile), AUTOFIX_KEY_CLINICAL_CALENDAR_RESTORE],
      });
      continue;
    }

    const preferredStaff =
      staffRules.length > 0
        ? visibleStaff.find((st) =>
            isStaffEligibleForServiceRules(st.id, st.staff_role, staffRules)
          )
        : null;

    const preferredStartAt = new Date().toISOString();
    const durationMinutes = Math.max(
      5,
      Math.min(24 * 60, Math.floor(service.duration_minutes) || 30)
    );

    const slotsOpen = await findNextAvailableBookingSlots({
      tenantId: tid,
      clinicId: cid,
      serviceId: service.id,
      bookingType: service.booking_type,
      staffId: null,
      roomId: null,
      bookingId: null,
      preferredStartAt,
      durationMinutes,
      limit: 3,
      maxDaysForward: 14,
      client,
    });

    if (!slotsOpen.slots.length) {
      tests.push({
        profile,
        label,
        status: "fail",
        message: `“${service.name}”: No free clinic slot was found in the next two weeks for an eligible room.`,
        suggestedAction: "Review the calendar, room eligibility, and business hours.",
        href: `${BASE(tid)}/calendar`,
      });
      continue;
    }

    let staffSlotTail = "";
    if (preferredStaff && staffRules.length > 0) {
      const slotsStaff = await findNextAvailableBookingSlots({
        tenantId: tid,
        clinicId: cid,
        serviceId: service.id,
        bookingType: service.booking_type,
        staffId: preferredStaff.id,
        roomId: null,
        bookingId: null,
        preferredStartAt,
        durationMinutes,
        limit: 2,
        maxDaysForward: 14,
        client,
      });
      if (!slotsStaff.slots.length) {
        staffSlotTail =
          " A room-only slot exists, but the first visible eligible provider has no slot in the same window (check working hours or conflicts).";
      }
    }

    const rowStatus: ClinicBookingSetupTestRowStatus =
      pieces.length > 0 || staffSlotTail ? "warning" : "pass";

    const fixKeys: string[] = [];
    for (const p of pieces) {
      if (p.includes("No preferred room")) fixKeys.push(preferredRoomFixKey(profile));
      if (p.includes("Preferred room is missing or inactive"))
        fixKeys.push(preferredRoomFixKey(profile));
      if (p.includes("No staff eligibility rules")) fixKeys.push(staffEligibilityFixKey(profile));
    }
    const uniqueFixKeys = Array.from(new Set(fixKeys));

    tests.push({
      profile,
      label,
      status: rowStatus,
      message: buildSuccessMessage({
        serviceName: service.name,
        roomElig,
        roomById,
        visibleStaff,
        staffRules: staffRulesRaw,
        slotsOpen,
        pieces,
        staffSlotTail,
      }),
      suggestedAction:
        rowStatus === "warning"
          ? "Review preferred room, staff hours, or calendar visibility if you want stricter defaults."
          : undefined,
      href: rowStatus === "warning" ? `${BASE(tid)}/settings/clinic-setup` : undefined,
      fixKeys: uniqueFixKeys.length ? uniqueFixKeys : undefined,
    });
  }

  let overallStatus: ClinicBookingSetupTestRowStatus = "pass";
  if (tests.some((t) => t.status === "fail")) overallStatus = "fail";
  else if (tests.some((t) => t.status === "warning")) overallStatus = "warning";

  const hygiene = await buildBookingSetupHygiene({ client, tenantId: tid, clinicId: cid, rooms });
  for (const h of hygiene) {
    overallStatus = worstBookingSetupStatus(overallStatus, h.status);
  }

  return { overallStatus, tests, hygiene };
}
