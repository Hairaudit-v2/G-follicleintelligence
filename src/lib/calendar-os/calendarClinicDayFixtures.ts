/**
 * CalendarOS V2 — Evolved Hair Restoration clinic-day simulation fixtures (pure).
 * Used for operational QA: heavy surgery, sparse clinic, front-desk workflow, stress load.
 */

import type { ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import { buildCalendarWeek } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { DEFAULT_BUSINESS_GRID } from "@/src/lib/calendar/operationalCalendarLayout";
import type {
  OperationalCalendarBookingDisplay,
  OperationalCalendarResourceColumn,
} from "@/src/lib/calendar/operationalCalendarTypes";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import { staffColumnId } from "@/src/lib/calendar/operationalCalendarColumns";

export const EVOLVED_QA_TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
export const EVOLVED_QA_CLINIC_ID = "e1111111-1111-4111-8111-111111111111";
export const EVOLVED_QA_DAY_HEAVY = "2026-07-02";
export const EVOLVED_QA_DAY_SPARSE = "2026-07-03";
export const EVOLVED_QA_DAY_FRONT_DESK = "2026-07-04";

export const EVOLVED_STAFF = {
  drSeetal: "a1000001-0001-4001-8001-000000000001",
  nurseJessie: "a1000002-0002-4002-8002-000000000002",
  nurseAnna: "a1000003-0003-4003-8003-000000000003",
  assistantSandra: "a1000004-0004-4004-8004-000000000004",
  assistantJenefyer: "a1000005-0005-4005-8005-000000000005",
  receptionMia: "a1000006-0006-4006-8006-000000000006",
  drPatel: "a1000007-0007-4007-8007-000000000007",
  nurseKim: "a1000008-0008-4008-8008-000000000008",
} as const;

export const EVOLVED_ROOMS = {
  surgery1: "r1000001-0001-4001-8001-000000000001",
  surgery2: "r1000002-0002-4002-8002-000000000002",
  consult1: "r1000003-0003-4003-8003-000000000003",
  consult2: "r1000004-0004-4004-8004-000000000004",
  treatmentA: "r1000005-0005-4005-8005-000000000005",
  treatmentB: "r1000006-0006-4006-8006-000000000006",
} as const;

function isoAtUtcDayHour(ymd: string, hour: number, minute = 0): string {
  const y = Number(ymd.slice(0, 4));
  const mo = Number(ymd.slice(5, 7)) - 1;
  const d = Number(ymd.slice(8, 10));
  return new Date(Date.UTC(y, mo, d, hour, minute, 0, 0)).toISOString();
}

function baseBooking(
  partial: Partial<FiBookingRow> & Pick<FiBookingRow, "id" | "booking_type" | "start_at" | "end_at" | "title">
): FiBookingRow {
  const now = "2026-07-01T00:00:00.000Z";
  const { booking_type, title, booking_status, ...rest } = partial;
  return {
    tenant_id: EVOLVED_QA_TENANT_ID,
    lead_id: null,
    person_id: null,
    patient_id: null,
    case_id: null,
    clinic_id: EVOLVED_QA_CLINIC_ID,
    room_id: null,
    room_required: false,
    assigned_staff_id: null,
    assigned_user_id: null,
    booking_type,
    booking_status: booking_status ?? "scheduled",
    title,
    description: null,
    timezone: "UTC",
    location: "Evolved Perth — South Perth",
    metadata: {},
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: now,
    updated_at: now,
    ...rest,
  };
}

const readyReadiness = {
  clinically_available: true,
  block_reason: null,
  readiness_state: "ready" as const,
  warning_label: null,
};

const rdoReadiness = {
  clinically_available: false,
  block_reason: "RDO",
  readiness_state: "inactive" as const,
  warning_label: "RDO — not rostered",
};

function staffMember(
  id: string,
  fullName: string,
  staffRole: string,
  opts?: { rdo?: boolean; workingHours?: Record<string, unknown> | null }
): ClinicalStaffPickerOption {
  return {
    id,
    email: `${fullName.toLowerCase().replace(/\s+/g, ".")}@evolvedhair.com.au`,
    full_name: fullName,
    fi_user_id: null,
    staff_role: staffRole,
    is_active: true,
    working_hours: opts?.workingHours ?? null,
    clinical_readiness: opts?.rdo ? rdoReadiness : readyReadiness,
  };
}

function room(
  id: string,
  displayName: string,
  roomType: FiClinicRoomRow["room_type"],
  sortOrder: number
): FiClinicRoomRow {
  return {
    id,
    tenant_id: EVOLVED_QA_TENANT_ID,
    clinic_id: EVOLVED_QA_CLINIC_ID,
    room_code: displayName.replace(/\s+/g, "-").toUpperCase(),
    display_name: displayName,
    physical_room_key: id,
    room_type: roomType,
    capabilities: [],
    is_active: true,
    sort_order: sortOrder,
    metadata: {},
  };
}

export function evolvedQaStaffDirectory(): ClinicalStaffPickerOption[] {
  const rdoHours = {
    weekly: {
      wed: { start: "08:00", end: "17:00", enabled: false },
    },
  };
  return [
    staffMember(EVOLVED_STAFF.drSeetal, "Dr Seetal", "surgeon"),
    staffMember(EVOLVED_STAFF.nurseJessie, "Nurse Jessie", "senior_nurse"),
    staffMember(EVOLVED_STAFF.nurseAnna, "Nurse Anna", "nurse"),
    staffMember(EVOLVED_STAFF.assistantSandra, "Sandra", "clinical_assistant"),
    staffMember(EVOLVED_STAFF.assistantJenefyer, "Jenefyer", "clinical_assistant"),
    staffMember(EVOLVED_STAFF.receptionMia, "Mia", "reception"),
    staffMember(EVOLVED_STAFF.drPatel, "Dr Patel", "consultant"),
    staffMember(EVOLVED_STAFF.nurseKim, "Nurse Kim", "nurse"),
    staffMember("a1000009-0009-4009-8009-000000000009", "Dr Lee", "consultant", {
      rdo: true,
      workingHours: rdoHours,
    }),
    staffMember("a1000010-0010-4010-8010-000000000010", "Nurse Taylor", "nurse", {
      rdo: true,
      workingHours: rdoHours,
    }),
    staffMember("a1000011-0011-4011-8011-000000000011", "Nurse Brooks", "nurse", {
      rdo: true,
      workingHours: rdoHours,
    }),
    staffMember("a1000012-0012-4012-8012-000000000012", "Dr Nguyen", "consultant", {
      rdo: true,
      workingHours: rdoHours,
    }),
  ];
}

export function evolvedQaRooms(): FiClinicRoomRow[] {
  return [
    room(EVOLVED_ROOMS.surgery1, "Surgery Room 1", "surgery", 1),
    room(EVOLVED_ROOMS.surgery2, "Surgery Room 2", "surgery", 2),
    room(EVOLVED_ROOMS.consult1, "Consult Room 1", "consult", 3),
    room(EVOLVED_ROOMS.consult2, "Consult Room 2", "consult", 4),
    room(EVOLVED_ROOMS.treatmentA, "Treatment Suite A", "prp", 5),
    room(EVOLVED_ROOMS.treatmentB, "Treatment Suite B", "prp", 6),
  ];
}

function staffColumn(staffId: string, label: string, subtitle: string): OperationalCalendarResourceColumn {
  return {
    id: staffColumnId(staffId),
    kind: "fi_staff",
    label,
    subtitle,
    staffId,
    clinicallyAvailable: true,
    readinessWarning: null,
  };
}

function roomColumn(roomId: string, label: string): OperationalCalendarResourceColumn {
  return {
    id: `r:${roomId}`,
    kind: "room",
    label,
    subtitle: null,
    clinicallyAvailable: true,
    readinessWarning: null,
  };
}

export function evolvedQaStaffResourceColumns(): OperationalCalendarResourceColumn[] {
  return [
    staffColumn(EVOLVED_STAFF.drSeetal, "Dr Seetal", "Surgeon"),
    staffColumn(EVOLVED_STAFF.nurseJessie, "Nurse Jessie", "Senior Nurse"),
    staffColumn(EVOLVED_STAFF.nurseAnna, "Nurse Anna", "Nurse"),
    staffColumn(EVOLVED_STAFF.assistantSandra, "Sandra", "Surgical Assistant"),
    staffColumn(EVOLVED_STAFF.assistantJenefyer, "Jenefyer", "Surgical Assistant"),
    staffColumn(EVOLVED_STAFF.receptionMia, "Mia", "Reception"),
    staffColumn(EVOLVED_STAFF.drPatel, "Dr Patel", "Consultant"),
    staffColumn(EVOLVED_STAFF.nurseKim, "Nurse Kim", "Nurse"),
    { id: "unassigned", kind: "unassigned", label: "Unassigned", subtitle: "Needs assignment" },
  ];
}

export function evolvedQaRoomResourceColumns(): OperationalCalendarResourceColumn[] {
  return [
    roomColumn(EVOLVED_ROOMS.surgery1, "Surgery Room 1"),
    roomColumn(EVOLVED_ROOMS.surgery2, "Surgery Room 2"),
    roomColumn(EVOLVED_ROOMS.consult1, "Consult Room 1"),
    roomColumn(EVOLVED_ROOMS.consult2, "Consult Room 2"),
    roomColumn(EVOLVED_ROOMS.treatmentA, "Treatment Suite A"),
    roomColumn(EVOLVED_ROOMS.treatmentB, "Treatment Suite B"),
    { id: "unassigned", kind: "unassigned", label: "Unassigned", subtitle: null },
  ];
}

export function evolvedQaQuery(overrides: Partial<ParsedCalendarQuery> = {}): ParsedCalendarQuery {
  return {
    view: "day",
    dateAnchor: EVOLVED_QA_DAY_HEAVY,
    calendarTimezone: "UTC",
    status: null,
    bookingType: null,
    assignedUserId: null,
    staffId: null,
    clinicId: EVOLVED_QA_CLINIC_ID,
    roomId: null,
    resourceView: "staff",
    includeCancelled: false,
    search: null,
    sampleMode: false,
    staffRoleBucket: null,
    waitingOnly: false,
    unassignedOnly: false,
    ...overrides,
  };
}

/** Scenario A — heavy surgery day with parallel follow-ups and afternoon PRP. */
export function scenarioAHeavySurgeryDay(): {
  dayKey: string;
  bookings: FiBookingRow[];
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>;
} {
  const day = EVOLVED_QA_DAY_HEAVY;
  const bookings: FiBookingRow[] = [
    baseBooking({
      id: "qa-a-surgery-1",
      booking_type: "surgery",
      booking_status: "confirmed",
      title: "Marcus Webb — FUE Hair Transplant",
      start_at: isoAtUtcDayHour(day, 7, 0),
      end_at: isoAtUtcDayHour(day, 13, 0),
      room_id: EVOLVED_ROOMS.surgery1,
      room_required: true,
      assigned_staff_id: EVOLVED_STAFF.drSeetal,
      metadata: { planned_graft_count: 3200, display_name: "Marcus Webb" },
    }),
    baseBooking({
      id: "qa-a-surgery-2",
      booking_type: "surgery",
      booking_status: "confirmed",
      title: "Priya Sharma — FUE Hair Transplant",
      start_at: isoAtUtcDayHour(day, 8, 0),
      end_at: isoAtUtcDayHour(day, 14, 0),
      room_id: EVOLVED_ROOMS.surgery2,
      room_required: true,
      assigned_staff_id: EVOLVED_STAFF.drSeetal,
      metadata: { planned_graft_count: 2800, display_name: "Priya Sharma" },
    }),
    baseBooking({
      id: "qa-a-follow-1",
      booking_type: "follow_up",
      booking_status: "scheduled",
      title: "James Holt — 7-day review",
      start_at: isoAtUtcDayHour(day, 9, 0),
      end_at: isoAtUtcDayHour(day, 9, 30),
      assigned_staff_id: EVOLVED_STAFF.nurseJessie,
      room_id: EVOLVED_ROOMS.consult1,
    }),
    baseBooking({
      id: "qa-a-follow-2",
      booking_type: "follow_up",
      booking_status: "scheduled",
      title: "Emma Walsh — PRP check",
      start_at: isoAtUtcDayHour(day, 10, 0),
      end_at: isoAtUtcDayHour(day, 10, 30),
      assigned_staff_id: EVOLVED_STAFF.nurseAnna,
      room_id: EVOLVED_ROOMS.treatmentA,
    }),
    baseBooking({
      id: "qa-a-consult-1",
      booking_type: "consultation",
      booking_status: "confirmed",
      title: "Alex Rivera — New patient consult",
      start_at: isoAtUtcDayHour(day, 11, 0),
      end_at: isoAtUtcDayHour(day, 11, 45),
      assigned_staff_id: EVOLVED_STAFF.drPatel,
      room_id: EVOLVED_ROOMS.consult2,
    }),
    baseBooking({
      id: "qa-a-prp-1",
      booking_type: "prp",
      booking_status: "confirmed",
      title: "Lisa Nguyen — PRP Session 2",
      start_at: isoAtUtcDayHour(day, 13, 0),
      end_at: isoAtUtcDayHour(day, 14, 0),
      assigned_staff_id: EVOLVED_STAFF.nurseKim,
      room_id: EVOLVED_ROOMS.treatmentB,
    }),
    baseBooking({
      id: "qa-a-assist-1",
      booking_type: "surgery",
      booking_status: "scheduled",
      title: "Assist block — Surgery Room 1",
      start_at: isoAtUtcDayHour(day, 7, 0),
      end_at: isoAtUtcDayHour(day, 13, 0),
      assigned_staff_id: EVOLVED_STAFF.assistantSandra,
      room_id: EVOLVED_ROOMS.surgery1,
      metadata: { team_support: true },
    }),
    baseBooking({
      id: "qa-a-assist-2",
      booking_type: "surgery",
      booking_status: "scheduled",
      title: "Assist block — Surgery Room 2",
      start_at: isoAtUtcDayHour(day, 8, 0),
      end_at: isoAtUtcDayHour(day, 14, 0),
      assigned_staff_id: EVOLVED_STAFF.assistantJenefyer,
      room_id: EVOLVED_ROOMS.surgery2,
      metadata: { team_support: true },
    }),
  ];

  const bookingDisplay: Record<string, OperationalCalendarBookingDisplay> = {
    "qa-a-surgery-1": {
      anchorLabel: "Marcus Webb",
      scalesSummary: null,
      durationMin: 360,
      reminderHint: null,
      roomLabel: "Surgery Room 1",
      operational: {
        riskStatus: "attention",
        readinessPercent: 85,
        readinessReady: true,
        journeyState: null,
        journeyStateLabel: null,
        paymentFlag: "satisfied",
        consentFlag: "signed",
        blockers: [],
        blockerCount: 0,
        nextAction: null,
        isSurgery: true,
      },
    },
    "qa-a-surgery-2": {
      anchorLabel: "Priya Sharma",
      scalesSummary: null,
      durationMin: 360,
      reminderHint: null,
      roomLabel: "Surgery Room 2",
      operational: {
        riskStatus: "attention",
        readinessPercent: 72,
        readinessReady: false,
        journeyState: null,
        journeyStateLabel: null,
        paymentFlag: "due",
        consentFlag: "missing",
        blockers: [],
        blockerCount: 0,
        nextAction: { label: "Collect consent", href: null },
        isSurgery: true,
      },
    },
  };

  return { dayKey: day, bookings, bookingDisplay };
}

/** Scenario B — sparse clinic day with RDO staff and open rooms. */
export function scenarioBSparseClinicDay(): {
  dayKey: string;
  bookings: FiBookingRow[];
  staffDirectory: ClinicalStaffPickerOption[];
} {
  const day = EVOLVED_QA_DAY_SPARSE;
  const bookings: FiBookingRow[] = [
    baseBooking({
      id: "qa-b-consult-1",
      booking_type: "consultation",
      title: "Michael Torres — Virtual consult",
      start_at: isoAtUtcDayHour(day, 10, 0),
      end_at: isoAtUtcDayHour(day, 10, 45),
      assigned_staff_id: EVOLVED_STAFF.drPatel,
      room_id: EVOLVED_ROOMS.consult1,
    }),
    baseBooking({
      id: "qa-b-consult-2",
      booking_type: "consultation",
      title: "Sarah Chen — In-clinic consult",
      start_at: isoAtUtcDayHour(day, 14, 0),
      end_at: isoAtUtcDayHour(day, 14, 45),
      assigned_staff_id: EVOLVED_STAFF.drSeetal,
      room_id: EVOLVED_ROOMS.consult2,
    }),
    baseBooking({
      id: "qa-b-prp-1",
      booking_type: "prp",
      title: "David Okonkwo — PRP Session 1",
      start_at: isoAtUtcDayHour(day, 11, 30),
      end_at: isoAtUtcDayHour(day, 12, 30),
      assigned_staff_id: EVOLVED_STAFF.nurseJessie,
      room_id: EVOLVED_ROOMS.treatmentA,
    }),
    baseBooking({
      id: "qa-b-follow-1",
      booking_type: "follow_up",
      title: "Emma Walsh — Nurse review",
      start_at: isoAtUtcDayHour(day, 15, 0),
      end_at: isoAtUtcDayHour(day, 15, 30),
      assigned_staff_id: EVOLVED_STAFF.nurseAnna,
      room_id: EVOLVED_ROOMS.treatmentB,
    }),
  ];

  return { dayKey: day, bookings, staffDirectory: evolvedQaStaffDirectory() };
}

/** Scenario C — front desk booking workflow with clear availability gaps. */
export function scenarioCFrontDeskWorkflow(): {
  dayKey: string;
  bookings: FiBookingRow[];
  freeDoctorIds: string[];
  freeNurseIds: string[];
  freeRoomIds: string[];
} {
  const day = EVOLVED_QA_DAY_FRONT_DESK;
  const bookings: FiBookingRow[] = [
    baseBooking({
      id: "qa-c-consult-1",
      booking_type: "consultation",
      title: "Morning consult — Dr Patel",
      start_at: isoAtUtcDayHour(day, 9, 0),
      end_at: isoAtUtcDayHour(day, 9, 45),
      assigned_staff_id: EVOLVED_STAFF.drPatel,
      room_id: EVOLVED_ROOMS.consult1,
    }),
    baseBooking({
      id: "qa-c-prp-1",
      booking_type: "prp",
      title: "PRP — Nurse Jessie AM",
      start_at: isoAtUtcDayHour(day, 10, 0),
      end_at: isoAtUtcDayHour(day, 11, 0),
      assigned_staff_id: EVOLVED_STAFF.nurseJessie,
      room_id: EVOLVED_ROOMS.treatmentA,
    }),
  ];

  return {
    dayKey: day,
    bookings,
    freeDoctorIds: [EVOLVED_STAFF.drSeetal],
    freeNurseIds: [EVOLVED_STAFF.nurseAnna, EVOLVED_STAFF.nurseKim],
    freeRoomIds: [
      EVOLVED_ROOMS.consult2,
      EVOLVED_ROOMS.surgery1,
      EVOLVED_ROOMS.surgery2,
      EVOLVED_ROOMS.treatmentB,
    ],
  };
}

/** Scenario D — production stress load (50+ bookings, 15+ staff). */
export function scenarioDStressLoadDay(): {
  dayKey: string;
  bookings: FiBookingRow[];
  staffDirectory: ClinicalStaffPickerOption[];
  rooms: FiClinicRoomRow[];
} {
  const day = "2026-07-07";
  const staffDirectory = evolvedQaStaffDirectory();
  for (let i = 0; i < 6; i++) {
    staffDirectory.push(
      staffMember(
        `a1000${20 + i}-00${20 + i}-40${20 + i}-80${20 + i}-00000000${20 + i}`,
        `Staff ${20 + i}`,
        i % 3 === 0 ? "consultant" : i % 3 === 1 ? "nurse" : "clinical_assistant"
      )
    );
  }

  const rooms = evolvedQaRooms();
  const bookings: FiBookingRow[] = [];
  const types: FiBookingRow["booking_type"][] = [
    "consultation",
    "follow_up",
    "prp",
    "surgery",
    "consultation",
  ];
  const staffIds = staffDirectory.map((s) => s.id);
  const roomIds = rooms.map((r) => r.id);

  for (let i = 0; i < 52; i++) {
    const hour = 7 + Math.floor(i / 4);
    const minute = (i % 4) * 15;
    const staffId = staffIds[i % staffIds.length]!;
    const type = types[i % types.length]!;
    const durationMin = type === "surgery" ? 180 : type === "consultation" ? 45 : 30;
    const endHour = hour + Math.floor((minute + durationMin) / 60);
    const endMinute = (minute + durationMin) % 60;

    bookings.push(
      baseBooking({
        id: `qa-stress-${i}`,
        booking_type: type,
        title: `Patient ${i} — ${type}`,
        start_at: isoAtUtcDayHour(day, hour, minute),
        end_at: isoAtUtcDayHour(day, endHour, endMinute),
        assigned_staff_id: staffId,
        room_id: roomIds[i % roomIds.length]!,
        room_required: type === "surgery",
        metadata: type === "surgery" ? { planned_graft_count: 2000 + i * 10 } : {},
      })
    );
  }

  return { dayKey: day, bookings, staffDirectory, rooms };
}

export function evolvedQaDayLane(dayKey: string) {
  const lanes = buildCalendarWeek(dayKey, "UTC");
  const lane = lanes.find((l) => l.dayKey === dayKey);
  if (!lane) throw new Error(`No lane for ${dayKey}`);
  return lane;
}

export function evolvedQaGridConfig() {
  return { ...DEFAULT_BUSINESS_GRID, timeZone: "UTC" };
}