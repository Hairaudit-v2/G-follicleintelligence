import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { AppointmentStaffHoursError } from "@/src/lib/bookings/bookingErrors";
import { checkAppointmentAvailability, DEFAULT_APPOINTMENT_BUFFER_MINUTES } from "@/src/lib/bookings/appointmentAvailability";
import { loadBookingsForOperatorView, loadBookingForTenant } from "@/src/lib/bookings/bookings";
import {
  addDaysToCalendarDate,
  calendarDateStringFromInstant,
  isoFromLocalDayMinutes,
  normalizeCalendarTimezone,
  zonedMidnightUtcMs,
} from "@/src/lib/calendar/calendarTimezone";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import { loadAllStaffForTenant, loadStaffFiUserIdMap, resolveBookingStaffAssignment } from "@/src/lib/staff/staff.server";
import { assertStaffAppointmentWithinWorkingHours } from "@/src/lib/staff/staffSlotHours.server";
import {
  formatStaffWeeklyHoursSummary,
  minutesFromHm,
  parseStaffWeeklyHours,
  staffWeekdayKeyFromUtcMs,
} from "@/src/lib/staff/staffWeeklyHours";

import { nextStaffWorkingLocalDayYmd } from "./calendarTestingSlotHelpers";
import type { CalendarQaRow, CalendarQaSection, CalendarTestingPagePayload } from "./calendarTestingTypes";

function qaRow(id: string, title: string, status: CalendarQaRow["status"], detail?: string, description?: string): CalendarQaRow {
  return { id, title, description, status, detail };
}

function hasWeeklyHoursSummary(staff: { working_hours: Record<string, unknown> }): boolean {
  return Boolean(formatStaffWeeklyHoursSummary(parseStaffWeeklyHours(staff.working_hours)).trim());
}

async function countInactiveStaffBookings(tenantId: string): Promise<number> {
  const supabase = supabaseAdmin();
  const { data: inactive, error: e1 } = await supabase
    .from("fi_staff")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("is_active", false);
  if (e1) throw new Error(e1.message);
  const ids = (inactive ?? []).map((r) => String((r as { id: string }).id)).filter(Boolean);
  if (!ids.length) return 0;
  const { count, error: e2 } = await supabase
    .from("fi_bookings")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId.trim())
    .in("assigned_staff_id", ids)
    .neq("booking_status", "cancelled");
  if (e2) throw new Error(e2.message);
  return count ?? 0;
}

function serviceMatchesCategory(s: FiServiceRow, needle: string): boolean {
  const n = needle.toLowerCase();
  const cat = (s.category ?? "").toLowerCase();
  const bt = (s.booking_type ?? "").toLowerCase();
  const name = s.name.toLowerCase();
  return cat.includes(n) || bt.includes(n) || name.includes(n);
}

async function probeOutsideHoursRejects(tenantId: string): Promise<CalendarQaRow> {
  const staffList = await loadAllStaffForTenant(tenantId);
  const active = staffList.filter((s) => s.is_active);
  const candidate = active.find((s) => hasWeeklyHoursSummary(s));
  if (!candidate) {
    return qaRow("probe_outside_hours", "Outside-hours appointment is rejected", "warning", "No active staff with weekly hours to probe.");
  }
  const weekly = parseStaffWeeklyHours(candidate.working_hours);
  const staffTz = normalizeCalendarTimezone(candidate.default_timezone?.trim() || "Australia/Perth");
  const ymd = nextStaffWorkingLocalDayYmd(staffTz, weekly, Date.now());
  if (!ymd) {
    return qaRow("probe_outside_hours", "Outside-hours appointment is rejected", "warning", "Could not find a working day in the next 3 weeks.");
  }
  const mid = zonedMidnightUtcMs(ymd, staffTz);
  if (mid == null) {
    return qaRow("probe_outside_hours", "Outside-hours appointment is rejected", "failed", "Invalid staff timezone for day math.");
  }
  const anchor = mid + 12 * 3_600_000;
  const wk = staffWeekdayKeyFromUtcMs(anchor, staffTz);
  const day = weekly[wk];
  const openMin = day?.start ? minutesFromHm(day.start) : null;
  if (openMin == null) {
    return qaRow("probe_outside_hours", "Outside-hours appointment is rejected", "warning", "Staff day hours could not be parsed.");
  }
  const outsideMin = Math.max(0, openMin - 120);
  const startIso = isoFromLocalDayMinutes(ymd, outsideMin, staffTz);
  const endIso = isoFromLocalDayMinutes(ymd, outsideMin + 30, staffTz);
  if (!startIso || !endIso) {
    return qaRow("probe_outside_hours", "Outside-hours appointment is rejected", "failed", "Could not build a local wall-clock slot.");
  }
  const supabase = supabaseAdmin();
  try {
    await assertStaffAppointmentWithinWorkingHours(tenantId, candidate.id, startIso, endIso, supabase);
    return qaRow(
      "probe_outside_hours",
      "Outside-hours appointment is rejected",
      "failed",
      "Expected working-hours validation to reject an early-morning slot, but it passed. Check staff configuration."
    );
  } catch (e) {
    if (e instanceof AppointmentStaffHoursError) {
      return qaRow("probe_outside_hours", "Outside-hours appointment is rejected", "ready", "Guard rejected an out-of-hours slot as expected.");
    }
    return qaRow("probe_outside_hours", "Outside-hours appointment is rejected", "warning", e instanceof Error ? e.message : String(e));
  }
}

async function probeMidnightCrossRejects(tenantId: string): Promise<CalendarQaRow> {
  const staffList = await loadAllStaffForTenant(tenantId);
  const candidate = staffList.find((s) => s.is_active && hasWeeklyHoursSummary(s));
  if (!candidate) {
    return qaRow("probe_midnight", "Appointment crossing local midnight is rejected", "warning", "No active staff with weekly hours to probe.");
  }
  const staffTz = normalizeCalendarTimezone(candidate.default_timezone?.trim() || "Australia/Perth");
  const ymd = calendarDateStringFromInstant(new Date(), staffTz);
  const startIso = isoFromLocalDayMinutes(ymd, 23 * 60, staffTz);
  const nextYmd = addDaysToCalendarDate(ymd, 1, staffTz);
  const endIso = isoFromLocalDayMinutes(nextYmd, 1 * 60, staffTz);
  if (!startIso || !endIso) {
    return qaRow("probe_midnight", "Appointment crossing local midnight is rejected", "failed", "Could not build cross-midnight instants.");
  }
  const supabase = supabaseAdmin();
  try {
    await assertStaffAppointmentWithinWorkingHours(tenantId, candidate.id, startIso, endIso, supabase);
    return qaRow("probe_midnight", "Appointment crossing local midnight is rejected", "failed", "Expected cross-midnight rejection but validation passed.");
  } catch (e) {
    if (e instanceof AppointmentStaffHoursError) {
      return qaRow("probe_midnight", "Appointment crossing local midnight is rejected", "ready", "Guard rejected a cross-midnight span as expected.");
    }
    return qaRow("probe_midnight", "Appointment crossing local midnight is rejected", "warning", e instanceof Error ? e.message : String(e));
  }
}

async function probeInactiveStaffAssignmentRejects(tenantId: string): Promise<CalendarQaRow> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff")
    .select("id, full_name")
    .eq("tenant_id", tenantId.trim())
    .eq("is_active", false)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    return qaRow(
      "probe_inactive_staff",
      "Inactive-staff booking is rejected",
      "warning",
      "No inactive staff row exists to probe (create one inactive staff to verify this guard)."
    );
  }
  const sid = String((data as { id: string }).id);
  try {
    await resolveBookingStaffAssignment(supabase, tenantId, { assignedStaffId: sid, assignedUserId: null });
    return qaRow("probe_inactive_staff", "Inactive-staff booking is rejected", "failed", "Expected inactive-staff assignment to fail.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/inactive/i.test(msg)) {
      return qaRow("probe_inactive_staff", "Inactive-staff booking is rejected", "ready", "Assignment resolver rejects inactive staff as expected.");
    }
    return qaRow("probe_inactive_staff", "Inactive-staff booking is rejected", "ready", msg);
  }
}

async function probeOverlapRejects(tenantId: string): Promise<CalendarQaRow> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_bookings")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .neq("booking_status", "cancelled")
    .not("assigned_staff_id", "is", null)
    .order("start_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    return qaRow(
      "probe_overlap",
      "Overlapping appointment is rejected",
      "warning",
      "No non-cancelled booking with assigned staff found — create two bookings for the same clinician to validate overlap."
    );
  }
  const b = await loadBookingForTenant(tenantId, String((data as { id: string }).id), supabase);
  if (!b?.assigned_staff_id?.trim()) {
    return qaRow("probe_overlap", "Overlapping appointment is rejected", "warning", "Sample booking has no staff assignee.");
  }
  const staffIds = [b.assigned_staff_id.trim()];
  const staffIdToUserId = await loadStaffFiUserIdMap(tenantId, staffIds, supabase);
  const padStart = new Date(Date.parse(b.start_at) - 86_400_000).toISOString();
  const padEnd = new Date(Date.parse(b.end_at) + 86_400_000).toISOString();
  const neighbours = await loadBookingsForOperatorView({
    tenantId,
    rangeStartIso: padStart,
    rangeEndIso: padEnd,
    includeCancelled: false,
  });
  const result = checkAppointmentAvailability({
    candidateStartIso: b.start_at,
    candidateEndIso: b.end_at,
    candidateStaffId: b.assigned_staff_id,
    candidateUserId: b.assigned_user_id,
    existing: neighbours,
    staffIdToUserId,
    excludeBookingId: null,
    bufferMinutes: DEFAULT_APPOINTMENT_BUFFER_MINUTES,
  });
  if (!result.ok) {
    return qaRow("probe_overlap", "Overlapping appointment is rejected", "ready", "Duplicate slot for the same assignee is flagged (including buffer).");
  }
  return qaRow(
    "probe_overlap",
    "Overlapping appointment is rejected",
    "warning",
    "A duplicate of the latest booking was not flagged — check buffer rules or assignee identity matching."
  );
}

async function probeValidAppointmentPlaceholder(tenantId: string): Promise<CalendarQaRow> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_crm_leads")
    .select("id, person_id")
    .eq("tenant_id", tenantId.trim())
    .not("person_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    return qaRow(
      "probe_valid_create",
      "Create valid appointment (smoke)",
      "not_tested",
      "Run the smoke test after at least one CRM lead with a person exists, or create a booking manually from the calendar."
    );
  }
  return qaRow(
    "probe_valid_create",
    "Create valid appointment (smoke)",
    "not_tested",
    "A lead with person_id is available — use “Run smoke test” to create and cancel a short consultation booking."
  );
}

export async function loadCalendarTestingPageData(tenantId: string): Promise<CalendarTestingPagePayload> {
  const tid = tenantId.trim();
  const [staff, services, inactiveBookings] = await Promise.all([
    loadAllStaffForTenant(tid),
    loadFiServicesForTenant(tid),
    countInactiveStaffBookings(tid),
  ]);

  const activeStaff = staff.filter((s) => s.is_active);
  const missingHours = activeStaff.filter((s) => !hasWeeklyHoursSummary(s));
  const missingTz = staff.filter((s) => !s.default_timezone?.trim());

  const staffRows: CalendarQaRow[] = [
    qaRow(
      "staff_active_count",
      "Active staff count",
      activeStaff.length > 0 ? "ready" : "failed",
      activeStaff.length ? `${activeStaff.length} active staff` : "No active staff — add staff before go-live."
    ),
    qaRow(
      "staff_missing_hours",
      "Staff missing working_hours",
      missingHours.length === 0 ? "ready" : "failed",
      missingHours.length
        ? `${missingHours.length} without weekly hours: ${missingHours.map((s) => s.full_name).join(", ")}`
        : "All active staff have weekly hours configured."
    ),
    qaRow(
      "staff_missing_tz",
      "Staff missing default_timezone",
      missingTz.length === 0 ? "ready" : "warning",
      missingTz.length
        ? `${missingTz.length} use platform fallback (Perth) for hour math: ${missingTz.map((s) => s.full_name).join(", ")}`
        : "All staff rows set an explicit IANA timezone."
    ),
    qaRow(
      "inactive_staff_bookings",
      "Inactive staff still assigned to bookings",
      inactiveBookings === 0 ? "ready" : "failed",
      inactiveBookings ? `${inactiveBookings} non-cancelled booking(s) reference inactive staff` : "No dangling inactive-staff assignments."
    ),
  ];

  const activeServices = services.filter((s) => s.is_active);
  const badDuration = activeServices.filter((s) => !Number.isFinite(s.duration_minutes) || s.duration_minutes <= 0);
  const longSurgery = activeServices.filter(
    (s) =>
      s.is_active &&
      s.duration_minutes > 240 &&
      (serviceMatchesCategory(s, "surgery") || (s.booking_type ?? "").toLowerCase() === "surgery")
  );
  const hasPrp = activeServices.some((s) => serviceMatchesCategory(s, "prp"));
  const hasReview = activeServices.some((s) => serviceMatchesCategory(s, "review"));
  const hasConsult = activeServices.some(
    (s) => serviceMatchesCategory(s, "consult") || (s.booking_type ?? "").toLowerCase() === "consultation"
  );

  const serviceRows: CalendarQaRow[] = [
    qaRow(
      "svc_active_count",
      "Active service catalog count",
      activeServices.length > 0 ? "ready" : "warning",
      activeServices.length ? `${activeServices.length} active services` : "No active services — configure Services before rollout."
    ),
    qaRow(
      "svc_duration",
      "Services missing duration_minutes",
      badDuration.length === 0 ? "ready" : "failed",
      badDuration.length ? badDuration.map((s) => s.name).join(", ") : "All active services have positive duration."
    ),
    qaRow(
      "svc_long_surgery",
      "Surgery-length services over 4 hours",
      longSurgery.length === 0 ? "ready" : "warning",
      longSurgery.length
        ? `Review: ${longSurgery.map((s) => `${s.name} (${s.duration_minutes}m)`).join("; ")}`
        : "No active surgery-type service exceeds 240 minutes."
    ),
    qaRow("svc_prp", "PRP-style service present", hasPrp ? "ready" : "warning", hasPrp ? "Found PRP-related catalog row." : "No obvious PRP service — add if you offer PRP."),
    qaRow("svc_review", "Review-style service present", hasReview ? "ready" : "warning", hasReview ? "Found review-related catalog row." : "No obvious review service."),
    qaRow(
      "svc_consult",
      "Consultation service present",
      hasConsult ? "ready" : "warning",
      hasConsult ? "Found consultation-related catalog row." : "No obvious consultation service."
    ),
  ];

  const [pOutside, pMid, pInactive, pOverlap, pValid] = await Promise.all([
    probeOutsideHoursRejects(tid),
    probeMidnightCrossRejects(tid),
    probeInactiveStaffAssignmentRejects(tid),
    probeOverlapRejects(tid),
    probeValidAppointmentPlaceholder(tid),
  ]);

  const validationRows = [pOutside, pMid, pInactive, pOverlap, pValid];

  const base = `/fi-admin/${tid}`;
  const workflowRows: CalendarQaRow[] = [
    qaRow(
      "wf_lead_consult",
      "Lead → consultation booking",
      "not_tested",
      `Open ${base}/crm, pick a lead (Overview), use Lead bookings to create a consultation; confirm it on ${base}/calendar and ${base}/appointments.`
    ),
    qaRow(
      "wf_patient_consult",
      "Patient → appointment",
      "not_tested",
      `Open ${base}/patients (or Directory), open a patient with foundation profile, use Appointments / slide-over to schedule; confirm on calendar.`
    ),
    qaRow(
      "wf_case_anchor",
      "Case → appointment (case_id)",
      "not_tested",
      `Open ${base}/cases/[caseId], use Case appointments → New appointment for this case; confirm row has fi_bookings.case_id and appears on calendar when filtered.`
    ),
    qaRow(
      "wf_patient_prp",
      "Patient → PRP (or related) booking",
      "not_tested",
      `From a patient profile, schedule PRP / PRF / mesotherapy / exosomes when your catalog supports it.`
    ),
    qaRow("wf_case_surgery", "Case → surgery booking", "not_tested", `Anchor a surgery-type booking to the SurgeryOS case when planning allows.`),
    qaRow("wf_case_review", "Case → post-op review booking", "not_tested", `Schedule follow_up / review linked to the same case after surgery.`),
    qaRow("wf_cancel", "Cancel booking", "not_tested", `Cancel from the appointment slide-over or booking UI; verify status and calendar refresh.`),
    qaRow("wf_complete", "Complete booking", "not_tested", `Mark complete from appointment UI; verify status and any CRM side-effects.`),
    qaRow("wf_reschedule", "Reschedule booking", "not_tested", `Change time via calendar drag/edit; confirm staff hours + overlap guards still pass.`),
  ];

  const errorCopyRows: CalendarQaRow[] = [
    qaRow(
      "err_staff_hours",
      "Outside staff working hours",
      "not_tested",
      "Expected copy: appointment falls outside configured weekly hours for that staff member (with weekday and wall-time hint). Surfaces from calendar create/drag and booking mutations when a staff assignee is set.",
    ),
    qaRow(
      "err_staff_inactive",
      "Inactive staff assignee",
      "not_tested",
      "Expected copy: inactive staff cannot be assigned — choose another clinician or reactivate in Staff.",
    ),
    qaRow(
      "err_staff_no_hours",
      "Missing staff working hours",
      "not_tested",
      "Expected copy: no weekly hours on file — add hours in Staff before scheduling that person.",
    ),
    qaRow(
      "err_overlap",
      "Overlapping appointment",
      "not_tested",
      "Expected copy: slot overlaps another booking for the same assignee, including the configured buffer (default 15 minutes).",
    ),
    qaRow(
      "err_service_duration",
      "Missing / invalid service duration",
      "not_tested",
      "Catalog rows must have positive duration_minutes (≤ 24h). If a procedure type has no catalog row, the app uses built-in fallback durations — still verify Services for UAT realism.",
    ),
    qaRow(
      "err_clinic",
      "Invalid clinic",
      "not_tested",
      "Expected copy: clinic must belong to this tenant — pick a clinic from the tenant scope list.",
    ),
    qaRow(
      "err_appt_permission",
      "No appointment / scheduling permission",
      "not_tested",
      "Users without booking-operator access cannot open the appointment slide-over from case or patient context (amber notice + deep link to Appointments). loadAppointmentSlideOverBundleAction returns a clear denial when session is missing.",
    ),
  ];

  const sections: CalendarQaSection[] = [
    { id: "staff", title: "Staff setup", description: "Directory and working-hours hygiene.", rows: staffRows },
    { id: "services", title: "Service setup", description: "Catalog coverage for common ClinicOS flows.", rows: serviceRows },
    {
      id: "validation",
      title: "Booking validation (automated probes)",
      description: "Uses the same server guards as production — read-only except the optional smoke test.",
      rows: validationRows,
    },
    {
      id: "workflow",
      title: "Manual UAT workflows",
      description: "Sign off after you run each path in a staging tenant. Progress is stored in this browser only.",
      rows: workflowRows,
    },
    {
      id: "error_copy",
      title: "Expected error messages (reference)",
      description: "What testers should see when guards fire — not automated; use during scripted UAT.",
      rows: errorCopyRows,
    },
  ];

  return { tenantId: tid, sections };
}
