import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  CLINIC_SETUP_WIZARD_SOURCE,
  buildPlannedRoomsFromCounts,
  buildServiceRoomPlans,
  categorizeServiceForWizard,
  type ClinicSetupRoomCounts,
  type ClinicSetupStaffInput,
  type ServiceRoomPlanRow,
} from "@/src/lib/clinicSetup/clinicSetupWizardCore";
import type { ClinicBookingSetupTestProfile } from "@/src/lib/clinicSetup/clinicBookingSetupTestTypes";
import {
  loadClinicRoomsForTenant,
  loadServiceRoomEligibilityForService,
  loadServiceStaffEligibilityForService,
  updateClinicRoom,
} from "@/src/lib/rooms/fiClinicRooms.server";
import { filterRoomEligibilityForClinic } from "@/src/lib/rooms/roomAvailability.server";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";
import { isCalendarVisibleClinicalStaff, isNonCalendarSupportRole } from "@/src/lib/staff/calendarVisibleStaff";
import { isSupportStaffRole } from "@/src/lib/staff/clinicalStaffPicker";

import type {
  ClinicBookingSetupAutoFixApplied,
  ClinicBookingSetupAutoFixError,
  ClinicBookingSetupAutoFixResult,
  ClinicBookingSetupAutoFixSkipped,
} from "@/src/lib/clinicSetup/clinicBookingSetupAutoFixTypes";

export type {
  ClinicBookingSetupAutoFixApplied,
  ClinicBookingSetupAutoFixError,
  ClinicBookingSetupAutoFixResult,
  ClinicBookingSetupAutoFixSkipped,
} from "@/src/lib/clinicSetup/clinicBookingSetupAutoFixTypes";

export const CLINIC_BOOKING_SETUP_AUTOFIX_SOURCE = "clinic_booking_setup_autofix";

const MANAGED_ELIGIBILITY_SOURCES = new Set([CLINIC_SETUP_WIZARD_SOURCE, CLINIC_BOOKING_SETUP_AUTOFIX_SOURCE]);

export function roomEligibilityFixKey(profile: ClinicBookingSetupTestProfile): string {
  return `room_eligibility:${profile}`;
}

export function staffEligibilityFixKey(profile: ClinicBookingSetupTestProfile): string {
  return `staff_eligibility:${profile}`;
}

export function preferredRoomFixKey(profile: ClinicBookingSetupTestProfile): string {
  return `preferred_room:${profile}`;
}

export const AUTOFIX_KEY_SUPPORT_CALENDAR = "support_roles_calendar_false";
export const AUTOFIX_KEY_CLINICAL_CALENDAR_RESTORE = "clinical_calendar_restore";
export const AUTOFIX_KEY_PERTH_PHYSICAL_ALIASES = "perth_physical_aliases";

function isManualRoom(room: FiClinicRoomRow): boolean {
  const m = room.metadata;
  return Boolean(
    m && typeof m === "object" && !Array.isArray(m) && (m as { manual_room_override?: boolean }).manual_room_override
  );
}

function eligibilityMetadataManaged(meta: Record<string, unknown>): boolean {
  const src = String((meta as { source?: string }).source ?? "").trim();
  return src.length === 0 || MANAGED_ELIGIBILITY_SOURCES.has(src);
}

function staffMatchesServiceCategory(
  staff: ClinicSetupStaffInput,
  cat: "consult" | "regenerative" | "surgery"
): boolean {
  if (cat === "consult") return staff.performsConsultations;
  if (cat === "regenerative") return staff.performsPrp;
  if (cat === "surgery") return staff.performsSurgery || staff.assistsSurgery;
  return false;
}

function inferStaffInputFromRow(s: {
  id: string;
  full_name: string;
  staff_role: string | null;
  calendar_visible: boolean | null;
}): ClinicSetupStaffInput {
  const role = String(s.staff_role ?? "").trim().toLowerCase();
  const performsConsultations =
    /\b(doctor|physician|consult|trich|surgeon|gp|dermatologist)\b/.test(role) ||
    role.includes("consultant") ||
    role.includes("trichologist");
  const performsPrp =
    /\b(nurse|technician|doctor|physician)\b/.test(role) || role.includes("technician") || role.includes("nurse");
  const performsSurgery = role.includes("surgeon") || role.includes("doctor");
  const assistsSurgery =
    /\b(nurse|technician|assistant)\b/.test(role) || role.includes("clinical_assistant") || role.includes("assistant");
  const showOnCalendar =
    s.calendar_visible === true
      ? true
      : s.calendar_visible === false
        ? false
        : isCalendarVisibleClinicalStaff({
            is_active: true,
            staff_role: s.staff_role,
            calendar_visible: null,
          });
  return {
    staffId: s.id,
    performsConsultations,
    performsPrp,
    performsSurgery,
    assistsSurgery,
    showOnCalendar,
  };
}

function maxRoomIndex(rooms: FiClinicRoomRow[], clinicId: string, pattern: RegExp): number {
  let max = 0;
  for (const r of rooms) {
    if (r.clinic_id !== clinicId) continue;
    const m = r.room_code.trim().match(pattern);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

function inferRoomCounts(rooms: FiClinicRoomRow[], clinicId: string): ClinicSetupRoomCounts {
  const consult = maxRoomIndex(rooms, clinicId, /^cons_(\d+)$/i);
  const prp = maxRoomIndex(rooms, clinicId, /^prp_(\d+)$/i);
  const surgery = maxRoomIndex(rooms, clinicId, /^surgery_(\d+)$/i);
  const patient = maxRoomIndex(rooms, clinicId, /^patient_room_(\d+)$/i);
  return { consult, surgery, prp, patient };
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

function planCategoryForStaff(p: ServiceRoomPlanRow): "consult" | "regenerative" | "surgery" | null {
  if (p.category === "consult_strict" || p.category === "consult_loose") return "consult";
  if (p.category === "regenerative") return "regenerative";
  if (p.category === "surgery") return "surgery";
  return null;
}

async function applyRoomEligibilityProfile(args: {
  supabase: SupabaseClient;
  tenantId: string;
  clinicId: string;
  profile: ClinicBookingSetupTestProfile;
  services: FiServiceRow[];
  rooms: FiClinicRoomRow[];
}): Promise<{ applied: string; skipped?: string }> {
  const { supabase, tenantId: tid, clinicId: cid, profile, services, rooms } = args;
  const service = pickServiceForProfile(services, profile);
  if (!service) return { skipped: "No matching catalogue service for this profile.", applied: "" };

  const counts = inferRoomCounts(rooms, cid);
  const useAlias =
    counts.consult >= 2 && counts.patient >= 2 && counts.prp >= 2 && counts.surgery >= 2;
  const planned = buildPlannedRoomsFromCounts({
    clinicId: cid,
    counts,
    useStandardSecondRoomAliases: useAlias,
  });
  const roomIdByCode = new Map(rooms.filter((r) => r.clinic_id === cid).map((r) => [r.room_code.trim(), r.id]));
  const plans = buildServiceRoomPlans({ services, plannedRooms: planned });
  const p = plans.find((x) => x.serviceId === service.id);
  if (!p || p.roomCodes.length === 0) return { skipped: "No planned room mapping for this service.", applied: "" };

  const existing = await loadServiceRoomEligibilityForService(tid, service.id, supabase);
  const insertedRoomIds = new Set<string>();

  let inserted = 0;
  const now = new Date().toISOString();
  const meta = { source: CLINIC_BOOKING_SETUP_AUTOFIX_SOURCE };

  for (const code of p.roomCodes) {
    const roomId = roomIdByCode.get(code);
    if (!roomId) continue;
    const row = existing.find((e) => e.room_id === roomId);
    const pending = insertedRoomIds.has(roomId);
    if (row || pending) {
      if (row && !eligibilityMetadataManaged(row.metadata)) continue;
      continue;
    }
    const prefCode = p.preferredRoomCode?.trim() ?? "";
    const preferred = Boolean(prefCode && roomIdByCode.get(prefCode) === roomId);
    const { error } = await supabase.from("fi_service_room_eligibility").insert({
      tenant_id: tid,
      clinic_id: cid,
      service_id: service.id,
      room_id: roomId,
      is_preferred: preferred,
      is_active: true,
      metadata: meta,
      created_at: now,
      updated_at: now,
    });
    if (error) throw new Error(error.message);
    inserted += 1;
    insertedRoomIds.add(roomId);
  }

  if (inserted === 0) return { skipped: "Room eligibility already present or blocked by manual rows.", applied: "" };
  return { applied: `Added ${inserted} room eligibility link(s) for “${service.name.trim()}”.` };
}

async function applyStaffEligibilityProfile(args: {
  supabase: SupabaseClient;
  tenantId: string;
  clinicId: string;
  profile: ClinicBookingSetupTestProfile;
  services: FiServiceRow[];
  rooms: FiClinicRoomRow[];
  staffInputs: ClinicSetupStaffInput[];
}): Promise<{ applied: string; skipped?: string }> {
  const { supabase, tenantId: tid, clinicId: cid, profile, services, rooms, staffInputs } = args;
  const service = pickServiceForProfile(services, profile);
  if (!service) return { skipped: "No matching catalogue service.", applied: "" };

  const counts = inferRoomCounts(rooms, cid);
  const useAlias =
    counts.consult >= 2 && counts.patient >= 2 && counts.prp >= 2 && counts.surgery >= 2;
  const planned = buildPlannedRoomsFromCounts({ clinicId: cid, counts, useStandardSecondRoomAliases: useAlias });
  const plans = buildServiceRoomPlans({ services, plannedRooms: planned });
  const p = plans.find((x) => x.serviceId === service.id);
  const cat = p ? planCategoryForStaff(p) : null;
  if (!cat || p?.category === "block") return { skipped: "Service category does not use staff mapping.", applied: "" };

  const existing = await loadServiceStaffEligibilityForService(tid, service.id, supabase);
  const hasStaffRow = (staffId: string) =>
    existing.some((r) => r.staff_id != null && String(r.staff_id).trim() === staffId.trim());

  let inserted = 0;
  const now = new Date().toISOString();
  const meta = { source: CLINIC_BOOKING_SETUP_AUTOFIX_SOURCE };

  for (const st of staffInputs) {
    if (!staffMatchesServiceCategory(st, cat)) continue;
    if (hasStaffRow(st.staffId)) continue;
    const { error } = await supabase.from("fi_service_staff_eligibility").insert({
      tenant_id: tid,
      service_id: service.id,
      staff_id: st.staffId.trim(),
      staff_role: null,
      is_required: false,
      is_active: true,
      metadata: meta,
      created_at: now,
      updated_at: now,
    });
    if (error) throw new Error(error.message);
    inserted += 1;
  }

  if (inserted === 0) return { skipped: "Staff eligibility already present or no matching staff inferred.", applied: "" };
  return { applied: `Added ${inserted} staff eligibility row(s) for “${service.name.trim()}”.` };
}

async function applyPreferredRoomProfile(args: {
  supabase: SupabaseClient;
  tenantId: string;
  clinicId: string;
  profile: ClinicBookingSetupTestProfile;
  services: FiServiceRow[];
  rooms: FiClinicRoomRow[];
}): Promise<{ applied: string; skipped?: string }> {
  const { supabase, tenantId: tid, clinicId: cid, profile, services, rooms } = args;
  const service = pickServiceForProfile(services, profile);
  if (!service) return { skipped: "No matching catalogue service.", applied: "" };

  const counts = inferRoomCounts(rooms, cid);
  const useAlias =
    counts.consult >= 2 && counts.patient >= 2 && counts.prp >= 2 && counts.surgery >= 2;
  const planned = buildPlannedRoomsFromCounts({ clinicId: cid, counts, useStandardSecondRoomAliases: useAlias });
  const roomIdByCode = new Map(rooms.filter((r) => r.clinic_id === cid).map((r) => [r.room_code.trim(), r.id]));
  const plans = buildServiceRoomPlans({ services, plannedRooms: planned });
  const p = plans.find((x) => x.serviceId === service.id);
  const prefCode = p?.preferredRoomCode?.trim() ?? "";
  const prefRoomId = prefCode ? roomIdByCode.get(prefCode) : undefined;
  if (!prefRoomId) return { skipped: "Preferred room code not available for this clinic.", applied: "" };

  const prefRoom = rooms.find((r) => r.id === prefRoomId);
  if (!prefRoom?.is_active) return { skipped: "Preferred room is inactive.", applied: "" };

  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const elig = filterRoomEligibilityForClinic(await loadServiceRoomEligibilityForService(tid, service.id, supabase), cid).filter(
    (e) => e.is_active
  );

  const hasActivePreferred = elig.some((e) => {
    if (!e.is_preferred) return false;
    const rm = roomById.get(e.room_id);
    return rm?.is_active;
  });
  if (hasActivePreferred) return { skipped: "Preferred room already set.", applied: "" };

  const target = elig.find((e) => e.room_id === prefRoomId);
  const now = new Date().toISOString();

  if (target) {
    if (!eligibilityMetadataManaged(target.metadata)) {
      return { skipped: "Preferred room row is manually managed; not changed.", applied: "" };
    }
    const { error } = await supabase
      .from("fi_service_room_eligibility")
      .update({
        is_preferred: true,
        metadata: { ...target.metadata, source: CLINIC_BOOKING_SETUP_AUTOFIX_SOURCE },
        updated_at: now,
      })
      .eq("tenant_id", tid)
      .eq("id", target.id);
    if (error) throw new Error(error.message);

    for (const o of elig) {
      if (o.id === target.id || !o.is_preferred) continue;
      if (!eligibilityMetadataManaged(o.metadata)) continue;
      const { error: e2 } = await supabase
        .from("fi_service_room_eligibility")
        .update({ is_preferred: false, updated_at: now })
        .eq("tenant_id", tid)
        .eq("id", o.id);
      if (e2) throw new Error(e2.message);
    }
    return { applied: `Set preferred room for “${service.name.trim()}”.` };
  }

  const { error } = await supabase.from("fi_service_room_eligibility").insert({
    tenant_id: tid,
    clinic_id: cid,
    service_id: service.id,
    room_id: prefRoomId,
    is_preferred: true,
    is_active: true,
    metadata: { source: CLINIC_BOOKING_SETUP_AUTOFIX_SOURCE },
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(error.message);
  return { applied: `Added preferred room link for “${service.name.trim()}”.` };
}

async function applySupportCalendarFalse(args: {
  supabase: SupabaseClient;
  tenantId: string;
}): Promise<{ applied: string; skipped?: string }> {
  const tid = args.tenantId;
  const { data, error } = await args.supabase
    .from("fi_staff")
    .select("id, staff_role, calendar_visible")
    .eq("tenant_id", tid)
    .eq("is_active", true);
  if (error) throw new Error(error.message);

  const targets = (data ?? []).filter((raw) => {
    const role = String((raw as { staff_role?: string | null }).staff_role ?? "");
    const vis = (raw as { calendar_visible?: boolean | null }).calendar_visible;
    if (!isSupportStaffRole(role)) return false;
    return vis !== false;
  });

  if (targets.length === 0) return { skipped: "No reception/admin/coordinator staff needed calendar visibility updates.", applied: "" };

  const now = new Date().toISOString();
  let n = 0;
  for (const t of targets) {
    const id = String((t as { id: string }).id);
    const { error: up } = await args.supabase
      .from("fi_staff")
      .update({ calendar_visible: false, updated_at: now })
      .eq("tenant_id", tid)
      .eq("id", id);
    if (up) throw new Error(up.message);
    n += 1;
  }
  return { applied: `Hid ${n} support staff member(s) from the calendar.` };
}

async function applyClinicalCalendarRestore(args: { supabase: SupabaseClient; tenantId: string }): Promise<{
  applied: string;
  skipped?: string;
}> {
  const tid = args.tenantId;
  const { data, error } = await args.supabase
    .from("fi_staff")
    .select("id, staff_role, calendar_visible")
    .eq("tenant_id", tid)
    .eq("is_active", true);
  if (error) throw new Error(error.message);

  const targets = (data ?? []).filter((raw) => {
    const role = (raw as { staff_role?: string | null }).staff_role;
    const vis = (raw as { calendar_visible?: boolean | null }).calendar_visible;
    if (vis !== false) return false;
    if (isNonCalendarSupportRole(role)) return false;
    return isCalendarVisibleClinicalStaff({
      is_active: true,
      staff_role: role,
      calendar_visible: null,
    });
  });

  if (targets.length === 0) {
    return { skipped: "No clinical staff with calendar visibility forced off.", applied: "" };
  }

  const now = new Date().toISOString();
  let n = 0;
  for (const t of targets) {
    const id = String((t as { id: string }).id);
    const { error: up } = await args.supabase
      .from("fi_staff")
      .update({ calendar_visible: null, updated_at: now })
      .eq("tenant_id", tid)
      .eq("id", id);
    if (up) throw new Error(up.message);
    n += 1;
  }
  return { applied: `Restored default calendar visibility for ${n} clinical staff member(s).` };
}

async function applyPerthPhysicalAliases(args: {
  supabase: SupabaseClient;
  tenantId: string;
  clinicId: string;
  rooms: FiClinicRoomRow[];
  confirmPerthAliases: boolean;
}): Promise<{ applied: string; skipped?: string }> {
  const { supabase, tenantId: tid, clinicId: cid, rooms, confirmPerthAliases } = args;
  const clinicRooms = rooms.filter((r) => r.clinic_id === cid);
  const byCode = new Map(clinicRooms.map((r) => [r.room_code.trim().toLowerCase(), r]));

  const cons2 = byCode.get("cons_2");
  const patient2 = byCode.get("patient_room_2");
  const prp2 = byCode.get("prp_2");
  const surg2 = byCode.get("surgery_2");

  const layoutOk = Boolean(cons2 && patient2 && prp2 && surg2);
  if (!layoutOk && !confirmPerthAliases) {
    return { skipped: "Evolved Perth second-room set (cons_2, patient_room_2, prp_2, surgery_2) not detected; pass confirmPerthAliases to apply anyway.", applied: "" };
  }
  if (!layoutOk && confirmPerthAliases) {
    return { skipped: "Required room codes are missing for alias repair.", applied: "" };
  }

  if (!cons2 || !patient2 || !prp2 || !surg2) {
    return { skipped: "Required room codes are missing.", applied: "" };
  }

  const updates: Array<{ room: FiClinicRoomRow; nextKey: string }> = [];
  const consKey = cons2.physical_room_key.trim();
  const prpKey = prp2.physical_room_key.trim();
  const surgKey = surg2.physical_room_key.trim();

  if (patient2.physical_room_key.trim() !== consKey && !isManualRoom(patient2)) {
    updates.push({ room: patient2, nextKey: consKey });
  }

  const pairTarget =
    prpKey && surgKey ? (prpKey === surgKey ? prpKey : prpKey) : prpKey || surgKey;

  if (pairTarget) {
    if (prp2.physical_room_key.trim() !== pairTarget && !isManualRoom(prp2)) {
      updates.push({ room: prp2, nextKey: pairTarget });
    }
    if (surg2.physical_room_key.trim() !== pairTarget && !isManualRoom(surg2)) {
      updates.push({ room: surg2, nextKey: pairTarget });
    }
  }

  const normalized: typeof updates = [];
  const seen = new Set<string>();
  for (const u of updates) {
    const k = `${u.room.id}:${u.nextKey}`;
    if (seen.has(k)) continue;
    seen.add(k);
    normalized.push(u);
  }

  if (normalized.length === 0) {
    return { skipped: "Physical keys already aligned or manual rooms block updates.", applied: "" };
  }

  let updatedRooms = 0;
  for (const { room, nextKey } of normalized) {
    if (isManualRoom(room)) continue;
    const meta = {
      ...(room.metadata && typeof room.metadata === "object" && !Array.isArray(room.metadata) ? room.metadata : {}),
      source: CLINIC_BOOKING_SETUP_AUTOFIX_SOURCE,
    };
    await updateClinicRoom(
      tid,
      room.id,
      {
        physicalRoomKey: nextKey,
        metadata: meta,
      },
      supabase
    );
    updatedRooms += 1;
  }

  if (updatedRooms === 0) {
    return { skipped: "Physical keys already aligned or manual rooms block updates.", applied: "" };
  }

  return { applied: `Updated ${updatedRooms} Perth second-room physical key alias(es).` };
}

function parseProfileFixKey(prefix: string, key: string): ClinicBookingSetupTestProfile | null {
  if (!key.startsWith(`${prefix}:`)) return null;
  const rest = key.slice(prefix.length + 1).trim();
  if (rest === "consult" || rest === "regenerative" || rest === "surgery" || rest === "follow_up") return rest;
  return null;
}

export async function applyClinicBookingSetupAutoFix(args: {
  tenantId: string;
  clinicId: string;
  fixKeys: string[];
  confirmPerthAliases?: boolean;
  client?: SupabaseClient;
}): Promise<ClinicBookingSetupAutoFixResult> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(args.clinicId, "clinicId");
  const supabase = args.client ?? supabaseAdmin();
  const confirmPerthAliases = Boolean(args.confirmPerthAliases);

  const applied: ClinicBookingSetupAutoFixApplied[] = [];
  const skipped: ClinicBookingSetupAutoFixSkipped[] = [];
  const errors: ClinicBookingSetupAutoFixError[] = [];

  const keys = Array.from(new Set(args.fixKeys.map((k) => k.trim()).filter(Boolean)));
  if (keys.length === 0) {
    return { ok: true, applied, skipped, errors };
  }

  const [services, rooms, staffRes] = await Promise.all([
    loadFiServicesForTenant(tid),
    loadClinicRoomsForTenant(tid, { clinicId: cid, activeOnly: false }, supabase),
    supabase
      .from("fi_staff")
      .select("id, full_name, staff_role, calendar_visible")
      .eq("tenant_id", tid)
      .eq("is_active", true)
      .order("full_name"),
  ]);
  if (staffRes.error) throw new Error(staffRes.error.message);

  const staffInputs = (staffRes.data ?? []).map((raw) =>
    inferStaffInputFromRow({
      id: String((raw as { id: string }).id),
      full_name: String((raw as { full_name?: string }).full_name ?? ""),
      staff_role: (raw as { staff_role?: string | null }).staff_role ?? null,
      calendar_visible:
        (raw as { calendar_visible?: boolean | null }).calendar_visible == null
          ? null
          : Boolean((raw as { calendar_visible: boolean | null }).calendar_visible),
    })
  );

  for (const key of keys) {
    try {
      if (key === AUTOFIX_KEY_SUPPORT_CALENDAR) {
        const r = await applySupportCalendarFalse({ supabase, tenantId: tid });
        if (r.skipped) skipped.push({ key, reason: r.skipped });
        else applied.push({ key, message: r.applied });
        continue;
      }
      if (key === AUTOFIX_KEY_CLINICAL_CALENDAR_RESTORE) {
        const r = await applyClinicalCalendarRestore({ supabase, tenantId: tid });
        if (r.skipped) skipped.push({ key, reason: r.skipped });
        else applied.push({ key, message: r.applied });
        continue;
      }
      if (key === AUTOFIX_KEY_PERTH_PHYSICAL_ALIASES) {
        const r = await applyPerthPhysicalAliases({
          supabase,
          tenantId: tid,
          clinicId: cid,
          rooms,
          confirmPerthAliases,
        });
        if (r.skipped) skipped.push({ key, reason: r.skipped });
        else applied.push({ key, message: r.applied });
        continue;
      }

      const roomProf = parseProfileFixKey("room_eligibility", key);
      if (roomProf) {
        const r = await applyRoomEligibilityProfile({
          supabase,
          tenantId: tid,
          clinicId: cid,
          profile: roomProf,
          services,
          rooms,
        });
        if (r.skipped) skipped.push({ key, reason: r.skipped });
        else applied.push({ key, message: r.applied });
        continue;
      }

      const staffProf = parseProfileFixKey("staff_eligibility", key);
      if (staffProf) {
        const r = await applyStaffEligibilityProfile({
          supabase,
          tenantId: tid,
          clinicId: cid,
          profile: staffProf,
          services,
          rooms,
          staffInputs,
        });
        if (r.skipped) skipped.push({ key, reason: r.skipped });
        else applied.push({ key, message: r.applied });
        continue;
      }

      const prefProf = parseProfileFixKey("preferred_room", key);
      if (prefProf) {
        const r = await applyPreferredRoomProfile({
          supabase,
          tenantId: tid,
          clinicId: cid,
          profile: prefProf,
          services,
          rooms,
        });
        if (r.skipped) skipped.push({ key, reason: r.skipped });
        else applied.push({ key, message: r.applied });
        continue;
      }

      skipped.push({ key, reason: "Unknown auto-fix key." });
    } catch (e) {
      errors.push({ key, message: e instanceof Error ? e.message : String(e) });
    }
  }

  const ok = errors.length === 0;
  return { ok, applied, skipped, errors };
}
