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
import { isStaffEligibleForServiceRules } from "@/src/lib/rooms/roomAvailabilityCore";
import { isSupportStaffRole } from "@/src/lib/staff/clinicalStaffPicker";
import { isStaffBookableForClinicalWorkflow } from "@/src/lib/staff/staffRolePolicy";
import { isCalendarVisibleClinicalStaff } from "@/src/lib/staff/calendarVisibleStaff";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";
import type {
  ClinicBookingSetupTestProfile,
  ClinicBookingSetupTestResult,
  ClinicBookingSetupTestRow,
} from "@/src/lib/clinicSetup/clinicBookingSetupTestTypes";

export type {
  ClinicBookingSetupTestProfile,
  ClinicBookingSetupTestResult,
  ClinicBookingSetupTestRow,
  ClinicBookingSetupTestRowStatus,
} from "@/src/lib/clinicSetup/clinicBookingSetupTestTypes";

const BASE = (tenantId: string) => `/fi-admin/${tenantId.trim()}`;

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
  const byCat = services.filter((s) => s.is_active && categorizeServiceForWizard(s) === "regenerative");
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
  const byCat = services.filter((s) => s.is_active && categorizeServiceForWizard(s) === "consult_loose");
  return pickFirstByName(byCat);
}

function pickServiceForProfile(services: FiServiceRow[], profile: ClinicBookingSetupTestProfile): FiServiceRow | null {
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
          calendar_visible: r.calendar_visible == null ? null : Boolean(r.calendar_visible),
        };
      })
      .filter((s) => isStaffBookableForClinicalWorkflow(s))
      .filter((s) => !isSupportStaffRole(s.staff_role))
      .filter((s) =>
        isCalendarVisibleClinicalStaff({
          is_active: true,
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
  roomElig: ReturnType<typeof filterRoomEligibilityForClinic>,
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
  roomElig: ReturnType<typeof filterRoomEligibilityForClinic>;
  roomById: Map<string, { display_name: string; is_active: boolean }>;
  visibleStaff: StaffRow[];
  staffRules: Awaited<ReturnType<typeof loadServiceStaffEligibilityForService>>;
  slotsOpen: Awaited<ReturnType<typeof findNextAvailableBookingSlots>>;
  pieces: string[];
  staffSlotTail: string;
}): string {
  const primaryRoomLabel = simplifyPreferredRoomLabel(args.roomElig, args.roomById);
  const activeRules = args.staffRules.filter((r) => r.is_active);
  const preferredStaff = args.visibleStaff.find((st) => isStaffEligibleForServiceRules(st.id, st.staff_role, activeRules));
  const roleHint =
    preferredStaff?.full_name ?? (activeRules.length ? "an eligible clinical assignee" : "a clinical assignee");
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
        suggestedAction: "Add or activate a matching service and set its booking type where possible.",
        href: `${BASE(tid)}/services`,
      });
      continue;
    }

    const roomEligRaw = await loadServiceRoomEligibilityForService(tid, service.id, client);
    const roomElig = filterRoomEligibilityForClinic(roomEligRaw, cid).filter((e) => e.is_active);
    const roomById = new Map(rooms.map((r) => [r.id, { display_name: r.display_name, is_active: r.is_active }]));

    if (roomElig.length === 0) {
      tests.push({
        profile,
        label,
        status: "fail",
        message: `“${service.name}” has no room links for this clinic — FI OS cannot assign a room.`,
        suggestedAction: "Run Clinic setup or map eligible rooms under Services.",
        href: `${BASE(tid)}/services`,
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
      if (!prefOk) pieces.push("Preferred room is missing or inactive; another eligible room may be used.");
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
        suggestedAction: "Adjust staff eligibility, turn on “Show on calendar” for a qualified provider, or use Clinic setup.",
        href: `${BASE(tid)}/staff`,
      });
      continue;
    }

    const preferredStaff =
      staffRules.length > 0
        ? visibleStaff.find((st) => isStaffEligibleForServiceRules(st.id, st.staff_role, staffRules))
        : null;

    const preferredStartAt = new Date().toISOString();
    const durationMinutes = Math.max(5, Math.min(24 * 60, Math.floor(service.duration_minutes) || 30));

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
    });
  }

  let overallStatus: ClinicBookingSetupTestRowStatus = "pass";
  if (tests.some((t) => t.status === "fail")) overallStatus = "fail";
  else if (tests.some((t) => t.status === "warning")) overallStatus = "warning";

  return { overallStatus, tests };
}
