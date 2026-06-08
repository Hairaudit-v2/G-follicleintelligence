import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadBookingsForTenantRange } from "@/src/lib/bookings/bookings";
import { formatCalendarRangeTitle } from "@/src/lib/bookings/calendarLabels";
import {
  bucketBookingsIntoCalendar,
  buildCalendarLanesForView,
} from "@/src/lib/bookings/calendarView";
import { calendarRangeIsoForQuery, parseCalendarSearchParams, type ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import { CALENDAR_VIEW_BOOKINGS_LIMIT } from "@/src/lib/bookings/operatorBookingConstants";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";

import type {
  OperationalCalendarBookingDisplay,
  OperationalCalendarPageData,
  OperationalCalendarResourceColumn,
} from "@/src/lib/calendar/operationalCalendarTypes";

export type {
  OperationalCalendarBookingDisplay,
  OperationalCalendarPageData,
  OperationalCalendarResourceColumn,
} from "@/src/lib/calendar/operationalCalendarTypes";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { isCrmMutationRole } from "@/src/lib/crm/crmGatePolicy";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import { loadCrmShellStaffPickerOptions, loadCrmShellUserPickerOptions } from "@/src/lib/crm/crmShellLoaders";
import { staffOptionPrimaryLabel, staffOptionSubtitle } from "@/src/lib/staff/staffAssigneeDisplay";
import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";
import { formatClinicalScalesSummary } from "@/src/lib/patients/hairLossScales";
import { loadReminderJobsForBookings } from "@/src/lib/reminders/reminderJobs.server";
import { formatNextReminderHint } from "@/src/lib/reminders/remindersCore";
import type { FiReminderJobWithTemplate } from "@/src/lib/reminders/reminderTypes";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";
import { serviceForBookingType } from "@/src/lib/bookings/servicesCatalog";

function readPatientLabel(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const dn = metadata.display_name;
  const pn = metadata.patient_name;
  if (typeof dn === "string" && dn.trim()) return dn.trim();
  if (typeof pn === "string" && pn.trim()) return pn.trim();
  return null;
}

async function loadPatientNameAndContactMaps(
  tenantId: string,
  patientIds: string[]
): Promise<{
  labels: Map<string, string>;
  contacts: Map<string, { email: string | null; phone: string | null }>;
}> {
  const labels = new Map<string, string>();
  const contacts = new Map<string, { email: string | null; phone: string | null }>();
  const ids = Array.from(new Set(patientIds.map((x) => x.trim()).filter(Boolean)));
  if (!ids.length) return { labels, contacts };

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id, metadata")
    .eq("tenant_id", tenantId.trim())
    .in("id", ids);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const r = raw as { id: string; metadata: unknown };
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    const label = readPatientLabel(meta);
    if (label) labels.set(String(r.id), label);
    const { email, phone } = displayFromPersonMetadata(meta);
    contacts.set(String(r.id), { email, phone });
  }
  return { labels, contacts };
}

async function loadLeadTitleMap(tenantId: string, leadIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = Array.from(new Set(leadIds.map((x) => x.trim()).filter(Boolean)));
  if (!ids.length) return out;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_crm_leads")
    .select("id, summary")
    .eq("tenant_id", tenantId.trim())
    .in("id", ids);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const r = raw as { id: string; summary: string | null };
    const s = r.summary?.trim();
    if (s) out.set(String(r.id), s);
  }
  return out;
}

type ClinicalLite = {
  norwood_scale: string | null;
  ludwig_scale: string | null;
  hairline_pattern: string | null;
  primary_concern: string | null;
};

async function loadClinicalDetailsMap(tenantId: string, patientIds: string[]): Promise<Map<string, ClinicalLite>> {
  const out = new Map<string, ClinicalLite>();
  const ids = Array.from(new Set(patientIds.map((x) => x.trim()).filter(Boolean)));
  if (!ids.length) return out;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patient_clinical_details")
    .select("patient_id, norwood_scale, ludwig_scale, hairline_pattern, primary_concern")
    .eq("tenant_id", tenantId.trim())
    .in("patient_id", ids);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const r = raw as {
      patient_id: string;
      norwood_scale: string | null;
      ludwig_scale: string | null;
      hairline_pattern: string | null;
      primary_concern: string | null;
    };
    out.set(String(r.patient_id), {
      norwood_scale: r.norwood_scale,
      ludwig_scale: r.ludwig_scale,
      hairline_pattern: r.hairline_pattern,
      primary_concern: r.primary_concern,
    });
  }
  return out;
}

async function loadTenantStaffAndClinics(tenantId: string): Promise<{
  assignees: CrmShellUserPickerOption[];
  staffDirectory: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
  resourceColumns: OperationalCalendarResourceColumn[];
  staffUserByStaffId: Map<string, string | null>;
}> {
  const tid = tenantId.trim();
  const [userAssignees, staffDirectory, clinicsRes] = await Promise.all([
    loadCrmShellUserPickerOptions(tid),
    loadCrmShellStaffPickerOptions(tid),
    supabaseAdmin()
      .from("fi_clinics")
      .select("id, display_name, organisation_id")
      .eq("tenant_id", tid)
      .order("display_name", { ascending: true }),
  ]);
  if (clinicsRes.error) throw new Error(clinicsRes.error.message);

  const staffUserByStaffId = new Map<string, string | null>();
  for (const s of staffDirectory) {
    staffUserByStaffId.set(s.id, s.fi_user_id?.trim() || null);
  }

  const clinics: CrmShellClinicOption[] = (clinicsRes.data ?? []).map((c) => {
    const r = c as { id: string; display_name: string; organisation_id: string | null };
    return {
      id: String(r.id),
      display_name: String(r.display_name),
      organisation_id: r.organisation_id != null ? String(r.organisation_id) : null,
    };
  });

  const resourceColumns: OperationalCalendarResourceColumn[] = [
    ...staffDirectory.map((s) => ({
      id: `s:${String(s.id)}`,
      kind: "fi_staff" as const,
      label: staffOptionPrimaryLabel(s),
      subtitle: staffOptionSubtitle(s),
    })),
    ...clinics.map((c) => ({
      id: `c:${c.id}`,
      kind: "clinic" as const,
      label: c.display_name,
      subtitle: "Room / site",
    })),
    { id: "unassigned", kind: "unassigned" as const, label: "Unassigned", subtitle: "No staff column" },
  ];

  return { assignees: userAssignees, staffDirectory, clinics, resourceColumns, staffUserByStaffId };
}

function applyStructuredFilters(
  rows: FiBookingRow[],
  q: ParsedCalendarQuery,
  staffUserByStaffId: Map<string, string | null>,
  staffDirectory: CrmShellUserPickerOption[]
): FiBookingRow[] {
  const roleBucketIds =
    q.staffRoleBucket && !q.staffId?.trim() ? staffIdsMatchingRoleBucket(staffDirectory, q.staffRoleBucket) : null;

  return rows.filter((b) => {
    if (q.status?.trim()) {
      if (b.booking_status !== q.status.trim()) return false;
    } else if (!q.includeCancelled && b.booking_status === "cancelled") {
      return false;
    }
    if (q.bookingType?.trim() && b.booking_type !== q.bookingType.trim()) return false;
    if (q.staffId?.trim()) {
      const sid = q.staffId.trim();
      const uid = staffUserByStaffId.get(sid) ?? null;
      if (b.assigned_staff_id?.trim() === sid) return true;
      if (!b.assigned_staff_id?.trim() && uid && b.assigned_user_id?.trim() === uid) return true;
      return false;
    }
    if (roleBucketIds) {
      if (roleBucketIds.size === 0) return false;
      const sid = b.assigned_staff_id?.trim();
      if (sid) {
        if (!roleBucketIds.has(sid)) return false;
      } else {
        const uid = b.assigned_user_id?.trim();
        if (!uid) return false;
        let ok = false;
        for (const staffId of Array.from(roleBucketIds)) {
          if ((staffUserByStaffId.get(staffId) ?? "").trim() === uid) {
            ok = true;
            break;
          }
        }
        if (!ok) return false;
      }
    }
    if (q.assignedUserId?.trim() && b.assigned_user_id !== q.assignedUserId.trim()) return false;
    if (q.clinicId?.trim() && b.clinic_id !== q.clinicId.trim()) return false;
    if (q.waitingOnly) {
      const st = b.booking_status.trim();
      if (st !== "scheduled" && st !== "confirmed") return false;
    }
    if (q.unassignedOnly) {
      if (b.assigned_staff_id?.trim() || b.assigned_user_id?.trim()) return false;
    }
    return true;
  });
}

function staffIdsMatchingRoleBucket(
  staffDirectory: CrmShellUserPickerOption[],
  bucket: "doctor" | "nurse"
): Set<string> {
  const out = new Set<string>();
  for (const s of staffDirectory) {
    const r = (s.staff_role ?? "").toLowerCase();
    if (bucket === "doctor") {
      if (
        /\b(doctor|physician|surgeon|consultant|dermatologist|gp)\b/.test(r) ||
        r.includes("doctor") ||
        r.includes("surgeon") ||
        r.includes("physician")
      ) {
        out.add(s.id);
      }
    } else if (/\b(nurse|rn|en)\b/.test(r) || r.includes("nurse")) {
      out.add(s.id);
    }
  }
  return out;
}

function humanizeBookingType(type: string): string {
  const t = type.trim();
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function anchorLabelForRow(
  row: FiBookingRow,
  patientLabels: Map<string, string>,
  leadTitles: Map<string, string>
): string {
  if (row.patient_id?.trim()) {
    const lab = patientLabels.get(row.patient_id.trim());
    if (lab) return lab;
    return `Patient ${row.patient_id.trim().slice(0, 8)}…`;
  }
  if (row.lead_id?.trim()) {
    const t = leadTitles.get(row.lead_id.trim());
    if (t) return t;
    return `Lead ${row.lead_id.trim().slice(0, 8)}…`;
  }
  if (row.person_id?.trim()) return `Person ${row.person_id.trim().slice(0, 8)}…`;
  if (row.case_id?.trim()) return `Case ${row.case_id.trim().slice(0, 8)}…`;
  return row.title?.trim() || humanizeBookingType(row.booking_type);
}

async function resolveBookingMutationGate(tenantId: string): Promise<{
  canMutateBookings: boolean;
  bookingMutationBlockedReason: string | null;
}> {
  const tid = tenantId.trim();
  const authUserId = await resolveAuthUserId(null);
  if (!authUserId?.trim()) {
    return {
      canMutateBookings: false,
      bookingMutationBlockedReason:
        "Sign in to create or move appointments. The calendar is view-only until you are authenticated.",
    };
  }
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("role")
    .eq("tenant_id", tid)
    .eq("auth_user_id", authUserId.trim())
    .maybeSingle();
  if (error) {
    return {
      canMutateBookings: false,
      bookingMutationBlockedReason: "Could not verify your tenant membership for calendar edits.",
    };
  }
  if (!data) {
    return {
      canMutateBookings: false,
      bookingMutationBlockedReason: "You are not a member of this tenant, so the calendar is read-only.",
    };
  }
  const role = (data as { role: string | null }).role;
  if (!isCrmMutationRole(role)) {
    return {
      canMutateBookings: false,
      bookingMutationBlockedReason:
        "Your role can view the calendar but not create or move bookings. Ask a tenant admin to grant admin, fi_admin, or crm_operator access.",
    };
  }
  return { canMutateBookings: true, bookingMutationBlockedReason: null };
}

/**
 * FI Admin operational calendar: uses {@link loadBookingsForTenantRange} for the same overlap
 * semantics as the tenant dashboard agenda, then applies URL filters + a hard row cap.
 */
export async function loadOperationalCalendarPageData(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>
): Promise<OperationalCalendarPageData> {
  const tid = tenantId.trim();
  const calendarSettings = await loadTenantOperationalCalendarSettings(tid);
  const parsed = parseCalendarSearchParams(searchParams, new Date(), {
    calendarTimezone: calendarSettings.calendarTimezone,
  });
  const viewRaw = Array.isArray(searchParams.view) ? searchParams.view[0] : searchParams.view;
  const query =
    typeof viewRaw === "string" && viewRaw.trim() ? parsed : { ...parsed, view: "day" as const };
  const lanes = buildCalendarLanesForView(query.view, query.dateAnchor, query.calendarTimezone);
  const { rangeStartIso, rangeEndIso } = calendarRangeIsoForQuery(query);

  const [rawBookings, resources, mutationGate, services] = await Promise.all([
    loadBookingsForTenantRange(tid, rangeStartIso, rangeEndIso),
    loadTenantStaffAndClinics(tid),
    resolveBookingMutationGate(tid),
    loadFiServicesForTenant(tid),
  ]);
  const { canMutateBookings, bookingMutationBlockedReason } = mutationGate;
  const gridConfig = calendarSettings.gridConfig;

  const structured = applyStructuredFilters(rawBookings, query, resources.staffUserByStaffId, resources.staffDirectory);

  const patientIds = structured.map((b) => b.patient_id).filter((x): x is string => Boolean(x?.trim()));
  const leadIds = structured.map((b) => b.lead_id).filter((x): x is string => Boolean(x?.trim()));

  const [patientMaps, leadTitles, clinicalMap] = await Promise.all([
    loadPatientNameAndContactMaps(tid, patientIds),
    loadLeadTitleMap(tid, leadIds),
    loadClinicalDetailsMap(tid, patientIds),
  ]);
  const patientLabels = patientMaps.labels;
  const patientContacts = patientMaps.contacts;

  const bookingDisplay: Record<string, OperationalCalendarBookingDisplay> = {};
  for (const row of structured) {
    const startMs = Date.parse(row.start_at);
    const endMs = Date.parse(row.end_at);
    const durationMin =
      Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.max(1, Math.round((endMs - startMs) / 60000)) : 30;

    const clin = row.patient_id?.trim() ? clinicalMap.get(row.patient_id.trim()) : undefined;
    const scalesSummary = clin
      ? formatClinicalScalesSummary({
          norwood_scale: clin.norwood_scale,
          ludwig_scale: clin.ludwig_scale,
          hairline_pattern: clin.hairline_pattern,
          primary_concern: clin.primary_concern,
        })
      : null;

    const cat = serviceForBookingType(services, row.booking_type);
    const pid = row.patient_id?.trim();
    const contact = pid ? patientContacts.get(pid) : undefined;
    bookingDisplay[row.id] = {
      anchorLabel: anchorLabelForRow(row, patientLabels, leadTitles),
      scalesSummary,
      durationMin,
      reminderHint: null,
      procedureCatalogName: cat?.name ?? null,
      procedureCatalogHex: cat?.color ?? null,
      suggestedPrice: cat != null ? cat.base_price : null,
      patientEmail: contact?.email ?? null,
      patientPhone: contact?.phone ?? null,
    };
  }

  const searchNeedle = query.search?.trim().toLowerCase() ?? "";
  const searched = searchNeedle
    ? structured.filter((b) => {
        const d = bookingDisplay[b.id];
        const hay = [
          d?.anchorLabel ?? "",
          b.title ?? "",
          humanizeBookingType(b.booking_type),
          b.booking_status,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(searchNeedle);
      })
    : structured;

  searched.sort((a, b) => a.start_at.localeCompare(b.start_at));

  const listTruncated = searched.length > CALENDAR_VIEW_BOOKINGS_LIMIT;
  const bookings = searched.slice(0, CALENDAR_VIEW_BOOKINGS_LIMIT);

  const reminderMap = await loadReminderJobsForBookings(
    tid,
    bookings.map((b) => b.id)
  );
  const reminderJobsByBookingId: Record<string, FiReminderJobWithTemplate[]> = {};
  for (const b of bookings) {
    const jobs = reminderMap.get(b.id) ?? [];
    reminderJobsByBookingId[b.id] = jobs;
    const hint = formatNextReminderHint(jobs, query.calendarTimezone);
    const prev = bookingDisplay[b.id];
    if (prev) {
      bookingDisplay[b.id] = { ...prev, reminderHint: hint };
    }
  }

  const bucketsMap = bucketBookingsIntoCalendar(bookings, lanes);
  const buckets: Record<string, FiBookingRow[]> = {};
  for (const lane of lanes) {
    buckets[lane.dayKey] = bucketsMap.get(lane.dayKey) ?? [];
  }

  const rangeTitle = formatCalendarRangeTitle(query.view, lanes, query.calendarTimezone);

  return {
    tenantId: tid,
    query,
    calendarTimezone: query.calendarTimezone,
    rangeStartIso,
    rangeEndIso,
    rangeTitle,
    lanes,
    buckets,
    bookings,
    bookingDisplay,
    assignees: resources.assignees,
    staffDirectory: resources.staffDirectory,
    clinics: resources.clinics,
    resourceColumns: resources.resourceColumns,
    gridConfig,
    listTruncated,
    canMutateBookings,
    bookingMutationBlockedReason,
    reminderJobsByBookingId,
    services,
  };
}
