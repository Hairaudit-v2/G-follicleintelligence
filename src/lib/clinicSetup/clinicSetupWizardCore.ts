import {
  isNonRoomRequiredService,
  matchEligibilityProfileId,
} from "@/src/lib/rooms/evolvedPerthServiceEligibilitySeedPlan";
import type { ClinicRoomType } from "@/src/lib/rooms/roomTypes";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";

export const CLINIC_SETUP_WIZARD_SOURCE = "clinic_setup_wizard";

export type ClinicSetupRoomCounts = {
  consult: number;
  surgery: number;
  prp: number;
  patient: number;
};

export type ClinicSetupStaffInput = {
  staffId: string;
  performsConsultations: boolean;
  performsPrp: boolean;
  performsSurgery: boolean;
  assistsSurgery: boolean;
  showOnCalendar: boolean;
};

export type PlannedClinicRoomRow = {
  room_code: string;
  display_name: string;
  physical_room_key: string;
  room_type: ClinicRoomType;
  capabilities: string[];
  sort_order: number;
};

export type WizardServiceCategory =
  | "none"
  | "consult_strict"
  | "consult_loose"
  | "regenerative"
  | "surgery"
  | "block";

export function categorizeServiceForWizard(service: FiServiceRow): WizardServiceCategory {
  if (!service.is_active) return "none";
  if (
    isNonRoomRequiredService({
      id: service.id,
      name: service.name,
      booking_type: service.booking_type,
      category: service.category,
      is_active: service.is_active,
    })
  ) {
    return "none";
  }

  const seedRow = {
    id: service.id,
    name: service.name,
    booking_type: service.booking_type,
    category: service.category,
    is_active: service.is_active,
  };
  const pid = matchEligibilityProfileId(seedRow);
  if (pid === "non_room") return "none";
  if (pid === "block_time") return "block";
  if (pid === "regenerative") return "regenerative";
  if (pid === "surgery") return "surgery";
  if (pid === "consult") {
    const bt = service.booking_type?.trim() ?? "";
    const name = service.name.trim().toLowerCase();
    if (bt === "consultation" || /\btrichology\b/.test(name)) return "consult_strict";
    if (
      bt === "follow_up" ||
      bt === "review" ||
      /\bfollow[- ]?up\b/.test(name) ||
      /\breview\b/.test(name)
    ) {
      return "consult_loose";
    }
    return "consult_loose";
  }
  return "none";
}

function clinicKeyShort(clinicId: string): string {
  return clinicId.replace(/-/g, "").slice(0, 8);
}

export function buildDefaultEvolvedPerthCounts(): ClinicSetupRoomCounts {
  return { consult: 2, surgery: 2, prp: 2, patient: 2 };
}

/**
 * Deterministic room plan: stable room_code values (readiness checks expect cons_2 / patient_room_2 / prp_2 / surgery_2 pairs).
 */
export function buildPlannedRoomsFromCounts(args: {
  clinicId: string;
  counts: ClinicSetupRoomCounts;
  /** When counts are 2+2+2+2, pair cons_2↔patient_room_2 and prp_2↔surgery_2 like Evolved Perth. */
  useStandardSecondRoomAliases: boolean;
}): PlannedClinicRoomRow[] {
  const pre = `cs_${clinicKeyShort(args.clinicId)}`;
  const c = args.counts;
  const alias =
    args.useStandardSecondRoomAliases &&
    c.consult >= 2 &&
    c.patient >= 2 &&
    c.prp >= 2 &&
    c.surgery >= 2;

  const rows: PlannedClinicRoomRow[] = [];
  let order = 10;

  for (let i = 1; i <= Math.max(0, Math.min(c.consult, 20)); i++) {
    const room_code = `cons_${i}`;
    const isSecond = i === 2;
    const physical = alias && isSecond ? `${pre}_phys_cons2_patient2` : `${pre}_phys_cons_${i}`;
    const caps =
      alias && isSecond
        ? (["consultation", "patient"] as string[])
        : (["consultation"] as string[]);
    rows.push({
      room_code,
      display_name: `Consult Room ${i}`,
      physical_room_key: physical,
      room_type: "consult",
      capabilities: caps,
      sort_order: order,
    });
    order += 10;
  }

  for (let i = 1; i <= Math.max(0, Math.min(c.prp, 20)); i++) {
    const room_code = `prp_${i}`;
    const isSecond = i === 2;
    const physical = alias && isSecond ? `${pre}_phys_prp2_surgery2` : `${pre}_phys_prp_${i}`;
    const caps =
      alias && isSecond
        ? (["prp", "exosomes", "prf", "surgery"] as string[])
        : (["prp", "exosomes", "prf"] as string[]);
    rows.push({
      room_code,
      display_name: `PRP Room ${i}`,
      physical_room_key: physical,
      room_type: "prp",
      capabilities: caps,
      sort_order: order,
    });
    order += 10;
  }

  for (let i = 1; i <= Math.max(0, Math.min(c.surgery, 20)); i++) {
    const room_code = `surgery_${i}`;
    const isSecond = i === 2;
    const physical = alias && isSecond ? `${pre}_phys_prp2_surgery2` : `${pre}_phys_surgery_${i}`;
    const caps =
      alias && isSecond ? (["surgery", "prp", "exosomes"] as string[]) : (["surgery"] as string[]);
    rows.push({
      room_code,
      display_name: `Surgery Room ${i}`,
      physical_room_key: physical,
      room_type: "surgery",
      capabilities: caps,
      sort_order: order,
    });
    order += 10;
  }

  for (let i = 1; i <= Math.max(0, Math.min(c.patient, 20)); i++) {
    const room_code = `patient_room_${i}`;
    const isSecond = i === 2;
    const physical = alias && isSecond ? `${pre}_phys_cons2_patient2` : `${pre}_phys_patient_${i}`;
    const caps = ["patient", "follow_up"] as string[];
    rows.push({
      room_code,
      display_name: `Patient Room ${i}`,
      physical_room_key: physical,
      room_type: "patient",
      capabilities: caps,
      sort_order: order,
    });
    order += 10;
  }

  return rows;
}

export type ServiceRoomPlanRow = {
  serviceId: string;
  serviceName: string;
  category: WizardServiceCategory;
  roomCodes: string[];
  preferredRoomCode: string | null;
};

function roomCodesByType(rooms: PlannedClinicRoomRow[], type: ClinicRoomType): string[] {
  return rooms.filter((r) => r.room_type === type).map((r) => r.room_code);
}

export function buildServiceRoomPlans(args: {
  services: FiServiceRow[];
  plannedRooms: PlannedClinicRoomRow[];
}): ServiceRoomPlanRow[] {
  const consultCodes = roomCodesByType(args.plannedRooms, "consult");
  const patientCodes = roomCodesByType(args.plannedRooms, "patient");
  const prpCodes = roomCodesByType(args.plannedRooms, "prp");
  const surgeryCodes = roomCodesByType(args.plannedRooms, "surgery");
  const allCodes = args.plannedRooms.map((r) => r.room_code);

  const first = (codes: string[]) => codes[0] ?? null;

  const rows: ServiceRoomPlanRow[] = [];

  for (const s of args.services) {
    const cat = categorizeServiceForWizard(s);
    if (cat === "none") continue;

    let roomCodes: string[] = [];
    let preferred: string | null = null;

    if (cat === "consult_strict") {
      roomCodes = [...consultCodes];
      preferred = first(consultCodes);
    } else if (cat === "consult_loose") {
      roomCodes = [...consultCodes, ...patientCodes];
      preferred = first(consultCodes);
    } else if (cat === "regenerative") {
      roomCodes = [...prpCodes];
      preferred = first(prpCodes);
    } else if (cat === "surgery") {
      roomCodes = [...surgeryCodes];
      preferred = first(surgeryCodes);
    } else if (cat === "block") {
      roomCodes = [...allCodes];
      preferred = first(consultCodes) ?? first(allCodes);
    }

    rows.push({
      serviceId: s.id,
      serviceName: s.name.trim(),
      category: cat,
      roomCodes,
      preferredRoomCode: preferred,
    });
  }

  return rows;
}

export type ClinicSetupServicePlanPreview = ServiceRoomPlanRow & {
  existingActiveRoomLinks: number;
  hasNonWizardRoomLinks: boolean;
  alreadyConfigured: boolean;
};

export type ClinicSetupWizardPreviewPayload = {
  plannedRooms: PlannedClinicRoomRow[];
  servicePlans: ClinicSetupServicePlanPreview[];
  warnings: string[];
  completedAt: string | null;
};

export type ApplyClinicSetupResult = {
  roomsCreated: number;
  roomsUpdated: number;
  roomsSkippedManual: number;
  roomEligibilityUpserts: number;
  staffEligibilityRows: number;
  staffCalendarUpdates: number;
  warnings: string[];
};
