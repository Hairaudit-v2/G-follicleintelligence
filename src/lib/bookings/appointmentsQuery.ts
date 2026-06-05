/**
 * URL parsing for `/fi-admin/[tenantId]/appointments` (Calendar | List | Today tabs).
 */

import { parseCalendarSearchParams, type CalendarViewMode, type ParsedCalendarQuery } from "./calendarQuery";
import { parseOperatorBookingSearchParams, type ParsedOperatorBookingQuery } from "./operatorBookingQuery";
import { defaultRangeIso } from "@/src/components/fi/bookings/bookingFormUtils";
import type { AppointmentCreatePrefill } from "./appointmentCreateTypes";

export type AppointmentsTab = "calendar" | "list" | "today";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v: string): boolean {
  return UUID_RE.test(v.trim());
}

function firstString(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? String(v[0] ?? "") : String(v);
}

function tryParseIso(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export type ParsedAppointmentsQuery = {
  tab: AppointmentsTab;
  calendar: ParsedCalendarQuery;
  operator: ParsedOperatorBookingQuery;
  openCreate: boolean;
  createPrefill: AppointmentCreatePrefill | null;
};

export function parseAppointmentsTab(raw: string | undefined): AppointmentsTab {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "list") return "list";
  if (t === "today") return "today";
  return "calendar";
}

export function parseAppointmentsCreatePrefill(
  searchParams: Record<string, string | string[] | undefined>
): AppointmentCreatePrefill | null {
  const leadId = firstString(searchParams.leadId).trim();
  const patientId = firstString(searchParams.patientId).trim();
  const caseId = firstString(searchParams.caseId).trim();
  const personId = firstString(searchParams.personId).trim();
  const startIso = tryParseIso(firstString(searchParams.start));
  const endIso = tryParseIso(firstString(searchParams.end));
  const bookingType = firstString(searchParams.type).trim() || firstString(searchParams.bookingType).trim();
  const title = firstString(searchParams.title).trim();
  const assignedUserId = firstString(searchParams.assignedUserId).trim();
  const clinicId = firstString(searchParams.clinicId).trim();

  const hasAnchor =
    (leadId && isUuid(leadId)) ||
    (patientId && isUuid(patientId)) ||
    (caseId && isUuid(caseId)) ||
    (personId && isUuid(personId));
  const hasSlot = Boolean(startIso && endIso);
  const hasMeta = Boolean(bookingType || title || (assignedUserId && isUuid(assignedUserId)));

  if (!hasAnchor && !hasSlot && !hasMeta) return null;

  const def = defaultRangeIso();
  return {
    leadId: leadId && isUuid(leadId) ? leadId : null,
    personId: personId && isUuid(personId) ? personId : null,
    patientId: patientId && isUuid(patientId) ? patientId : null,
    caseId: caseId && isUuid(caseId) ? caseId : null,
    bookingType: bookingType || "consultation",
    title: title || null,
    startIso: startIso ?? def.start,
    endIso: endIso ?? def.end,
    assignedUserId: assignedUserId && isUuid(assignedUserId) ? assignedUserId : null,
    clinicId: clinicId && isUuid(clinicId) ? clinicId : null,
  };
}

export function parseAppointmentsSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  now: Date = new Date()
): ParsedAppointmentsQuery {
  const tab = parseAppointmentsTab(firstString(searchParams.tab));
  const calendar = parseCalendarSearchParams(searchParams);
  const operator = parseOperatorBookingSearchParams(searchParams, now);
  const openCreate =
    firstString(searchParams.create).trim() === "1" ||
    firstString(searchParams.new).trim() === "1" ||
    parseBool(firstString(searchParams.openCreate));
  const createPrefill = parseAppointmentsCreatePrefill(searchParams);

  return { tab, calendar, operator, openCreate, createPrefill };
}

function parseBool(s: string): boolean {
  const v = s.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export type AppointmentsHrefQuery = {
  tab?: AppointmentsTab;
  view?: CalendarViewMode;
  date?: string;
  start?: string;
  end?: string;
  status?: string;
  type?: string;
  assignedUserId?: string;
  clinicId?: string;
  includeCancelled?: boolean;
  create?: boolean;
  leadId?: string;
  patientId?: string;
  startPrefill?: string;
  endPrefill?: string;
};

export function buildAppointmentsHref(tenantId: string, q: AppointmentsHrefQuery): string {
  const base = `/fi-admin/${tenantId.trim()}/appointments`;
  const sp = new URLSearchParams();
  if (q.tab && q.tab !== "calendar") sp.set("tab", q.tab);
  if (q.view && q.view !== "week") sp.set("view", q.view);
  if (q.date?.trim()) sp.set("date", q.date.trim());
  if (q.start?.trim()) sp.set("start", q.start.trim());
  if (q.end?.trim()) sp.set("end", q.end.trim());
  if (q.status?.trim()) sp.set("status", q.status.trim());
  if (q.type?.trim()) sp.set("type", q.type.trim());
  if (q.assignedUserId?.trim()) sp.set("assignedUserId", q.assignedUserId.trim());
  if (q.clinicId?.trim()) sp.set("clinicId", q.clinicId.trim());
  if (q.includeCancelled) sp.set("includeCancelled", "1");
  if (q.create) sp.set("create", "1");
  if (q.leadId?.trim()) sp.set("leadId", q.leadId.trim());
  if (q.patientId?.trim()) sp.set("patientId", q.patientId.trim());
  if (q.startPrefill?.trim()) sp.set("start", q.startPrefill.trim());
  if (q.endPrefill?.trim()) sp.set("end", q.endPrefill.trim());
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Deep link from patient profile / slide-over → calendar + create slide-over with patient context. */
export function buildBookAppointmentFromPatientHref(
  tenantId: string,
  patientId: string,
  bookingType = "consultation",
  leadId?: string | null
): string {
  const def = defaultRangeIso();
  const sp = new URLSearchParams();
  sp.set("tab", "calendar");
  sp.set("create", "1");
  sp.set("patientId", patientId.trim());
  if (leadId?.trim()) sp.set("leadId", leadId.trim());
  sp.set("start", def.start);
  sp.set("end", def.end);
  sp.set("type", bookingType.trim() || "consultation");
  return `/fi-admin/${tenantId.trim()}/appointments?${sp.toString()}`;
}

/** Deep link from CRM lead detail → calendar + create slide-over with lead context. */
export function buildBookAppointmentFromLeadHref(
  tenantId: string,
  leadId: string,
  bookingType = "consultation"
): string {
  const def = defaultRangeIso();
  const sp = new URLSearchParams();
  sp.set("tab", "calendar");
  sp.set("create", "1");
  sp.set("leadId", leadId);
  sp.set("start", def.start);
  sp.set("end", def.end);
  sp.set("type", bookingType.trim() || "consultation");
  return `/fi-admin/${tenantId.trim()}/appointments?${sp.toString()}`;
}
