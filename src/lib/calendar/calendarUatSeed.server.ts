import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createCalendarAppointment } from "@/src/lib/bookings/appointmentsApi";
import { tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import { assertFiServicesManageAllowed } from "@/src/lib/services/fiServicesManageAccess.server";
import { loadCrmShellScopePickerOptions } from "@/src/lib/crm/crmShellLoaders";
import {
  addDaysToCalendarDate,
  isoFromLocalDayMinutes,
  normalizeCalendarTimezone,
  zonedMidnightUtcMs,
} from "@/src/lib/calendar/calendarTimezone";
import { nextStaffWorkingLocalDayYmd } from "@/src/lib/calendar/calendarTestingSlotHelpers";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { insertFiService, loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";
import { insertFiStaff, loadAllStaffForTenant } from "@/src/lib/staff/staff.server";
import {
  defaultPerthClinicWeeklyHours,
  parseStaffWeeklyHours,
  serializeStaffWeeklyHours,
} from "@/src/lib/staff/staffWeeklyHours";

const UAT_STAFF_PREFIX = "UAT Seed —";
const UAT_BOOKING_TITLE_TAG = "UAT Seed";

export function isCalendarUatSeedEnvironmentEnabled(): boolean {
  return process.env.NODE_ENV === "development" || process.env.FI_ALLOW_CALENDAR_UAT_SEED === "true";
}

export type CalendarUatSeedResult =
  | { ok: true; lines: string[] }
  | { ok: false; error: string };

/**
 * Idempotent demo rows for clinic calendar UAT (development or `FI_ALLOW_CALENDAR_UAT_SEED=true` only).
 * Requires {@link assertFiServicesManageAllowed} (tenant admin / tenant fi_admin, platform OS fi_admin, or `FI_ADMIN_API_KEY`).
 * Does not enable public booking, SMS, or payments.
 */
export async function runCalendarUatSeed(
  tenantId: string,
  adminKey?: string | null
): Promise<CalendarUatSeedResult> {
  if (!isCalendarUatSeedEnvironmentEnabled()) {
    return {
      ok: false,
      error:
        "UAT seed is disabled. Run in development or set server env FI_ALLOW_CALENDAR_UAT_SEED=true (staging only).",
    };
  }

  try {
    await assertFiServicesManageAllowed({ tenantId, adminKey: adminKey ?? undefined, request: undefined });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Not allowed to run UAT seed (service catalogue admin access required).",
    };
  }

  const tid = tenantId.trim();
  const lines: string[] = [];
  const supabase = supabaseAdmin();
  const { calendarTimezone } = await loadTenantOperationalCalendarSettings(tid);
  const tenantTz = normalizeCalendarTimezone(calendarTimezone.trim() || "Australia/Perth");
  const workingDoc = serializeStaffWeeklyHours(defaultPerthClinicWeeklyHours()) as Record<string, unknown>;

  const existingStaff = await loadAllStaffForTenant(tid);
  const uatNames = [`${UAT_STAFF_PREFIX} Clinician A`, `${UAT_STAFF_PREFIX} Clinician B`, `${UAT_STAFF_PREFIX} Clinician C`];
  const uatStaffIds: string[] = [];
  const palette = ["#0ea5e9", "#8b5cf6", "#10b981"];

  for (let i = 0; i < 3; i++) {
    const nm = uatNames[i]!;
    const found = existingStaff.find((s) => s.full_name === nm);
    if (found) {
      uatStaffIds.push(found.id);
      lines.push(`Staff: “${nm}” already exists — reused.`);
      continue;
    }
    const row = await insertFiStaff(tid, {
      full_name: nm,
      staff_role: i === 2 ? "surgeon" : "consultant",
      email: `uat.seed+${i}.${tid.slice(0, 8)}@invalid.local`,
      mobile: null,
      default_timezone: tenantTz,
      working_hours: workingDoc,
      is_active: true,
      calendar_color: palette[i]!,
      fi_user_id: null,
    });
    uatStaffIds.push(row.id);
    lines.push(`Staff: created ${row.full_name} (${row.id.slice(0, 8)}…).`);
  }

  const servicesBefore = await loadFiServicesForTenant(tid);
  const bookedTypes = new Set(
    servicesBefore
      .filter((s) => s.is_active)
      .map((s) => s.booking_type?.trim())
      .filter((bt): bt is string => Boolean(bt))
  );

  const serviceSpecs: { name: string; booking_type: string; duration: number; color: string; category: string }[] = [
    { name: "UAT Seed — Consultation", booking_type: "consultation", duration: 45, color: "#0ea5e9", category: "UAT" },
    { name: "UAT Seed — PRP", booking_type: "prp", duration: 60, color: "#8b5cf6", category: "UAT" },
    { name: "UAT Seed — Surgery block", booking_type: "surgery", duration: 240, color: "#f97316", category: "UAT" },
  ];

  for (const spec of serviceSpecs) {
    if (bookedTypes.has(spec.booking_type)) {
      lines.push(`Service: booking_type “${spec.booking_type}” already has an active row — skipped.`);
      continue;
    }
    try {
      const row = await insertFiService(tid, {
        name: spec.name,
        duration_minutes: spec.duration,
        base_price: 0,
        color: spec.color,
        category: spec.category,
        is_active: true,
        booking_type: spec.booking_type,
      });
      bookedTypes.add(spec.booking_type);
      lines.push(`Service: created ${row.name} (${spec.booking_type}, ${spec.duration}m).`);
    } catch (e) {
      lines.push(`Service: could not create ${spec.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const { data: lead, error: le } = await supabase
    .from("fi_crm_leads")
    .select("id, person_id")
    .eq("tenant_id", tid)
    .not("person_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (le) return { ok: false, error: le.message };
  if (!lead) {
    lines.push("Bookings: skipped — no CRM lead with person_id (create a lead for full booking samples).");
    return { ok: true, lines };
  }

  const scope = await loadCrmShellScopePickerOptions(tid);
  const clinicId = scope.clinics[0]?.id ?? null;
  if (!clinicId) {
    lines.push("Bookings: skipped — no clinic rows for tenant (add a clinic under Configuration).");
    return { ok: true, lines };
  }

  const { count: uatBookingCount, error: cntErr } = await supabase
    .from("fi_bookings")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .ilike("title", `%${UAT_BOOKING_TITLE_TAG}%`);
  if (cntErr) return { ok: false, error: cntErr.message };
  if ((uatBookingCount ?? 0) > 0) {
    lines.push("Bookings: UAT-titled bookings already exist — skipped creating samples.");
    return { ok: true, lines };
  }

  const staffList = await loadAllStaffForTenant(tid);
  const primaryStaff =
    staffList.find((s) => s.id === uatStaffIds[0] && s.is_active) ??
    staffList.find((s) => s.full_name.startsWith(UAT_STAFF_PREFIX) && s.is_active) ??
    staffList.find((s) => s.is_active);
  if (!primaryStaff) {
    lines.push("Bookings: skipped — no active staff after seed.");
    return { ok: true, lines };
  }

  const weekly = parseStaffWeeklyHours(primaryStaff.working_hours);
  const staffTz = normalizeCalendarTimezone(primaryStaff.default_timezone?.trim() || tenantTz);
  const ymd0 = nextStaffWorkingLocalDayYmd(staffTz, weekly, Date.now());
  if (!ymd0) {
    lines.push("Bookings: skipped — could not resolve a working day.");
    return { ok: true, lines };
  }

  const mid0 = zonedMidnightUtcMs(ymd0, staffTz);
  const ymd1 =
    mid0 != null
      ? nextStaffWorkingLocalDayYmd(staffTz, weekly, mid0 + 30 * 3_600_000) ?? ymd0
      : ymd0;
  const ymdSurgery = ymd1 !== ymd0 ? ymd1 : addDaysToCalendarDate(ymd0, 1, staffTz);

  const createdByUserId = await tryResolveFiUserIdForTenant(tid, undefined);

  const bookingsPlan: { procedure: string; ymd: string; startMin: number; endMin: number; title: string }[] = [
    {
      procedure: "consultation",
      ymd: ymd0,
      startMin: 10 * 60,
      endMin: 10 * 60 + 45,
      title: `${UAT_BOOKING_TITLE_TAG} — consultation`,
    },
    {
      procedure: "prp",
      ymd: ymd0,
      startMin: 13 * 60,
      endMin: 14 * 60,
      title: `${UAT_BOOKING_TITLE_TAG} — PRP`,
    },
    {
      procedure: "surgery",
      ymd: ymdSurgery,
      startMin: 9 * 60,
      endMin: 9 * 60 + 240,
      title: `${UAT_BOOKING_TITLE_TAG} — surgery`,
    },
  ];

  for (const b of bookingsPlan) {
    const startIso = isoFromLocalDayMinutes(b.ymd, b.startMin, staffTz);
    const endIso = isoFromLocalDayMinutes(b.ymd, b.endMin, staffTz);
    if (!startIso || !endIso) {
      lines.push(`Bookings: skipped slot for ${b.procedure} (invalid local instants).`);
      continue;
    }
    try {
      await createCalendarAppointment({
        tenantId: tid,
        procedure: b.procedure,
        startAt: startIso,
        endAt: endIso,
        assignedStaffId: primaryStaff.id,
        leadId: String((lead as { id: string }).id),
        personId: String((lead as { person_id: string }).person_id),
        clinicId,
        title: b.title,
        skipAvailabilityCheck: false,
        createdByUserId,
      });
      lines.push(`Booking: created ${b.title} on ${b.ymd}.`);
    } catch (e) {
      lines.push(`Booking: ${b.title} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { ok: true, lines };
}
