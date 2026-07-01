import "server-only";

import { cache } from "react";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadBookingsForCalendarOverlap } from "@/src/lib/bookings/bookings";
import { CALENDAR_VIEW_BOOKINGS_LIMIT } from "@/src/lib/bookings/operatorBookingConstants";
import { parseCalendarSearchParams, type CalendarRoute, type ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { applyCalendarSettingsToQuery } from "@/src/lib/calendar/calendarSettingsCore";
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { logOperationalCalendarServerTiming } from "@/src/lib/calendar/calendarPerfDev";
import { loadPatientLabelsForBookings } from "@/src/lib/surgery/surgeryReadinessBoardLoader.server";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { PatientJourneyState } from "@/src/lib/patientJourney/patientJourneyStateCore";
import {
  paymentRecordNeedsCollection,
  type PaymentStatus,
} from "@/src/lib/payments/paymentRecordModel";
import { calendarDateStringFromInstant } from "@/src/lib/calendar/calendarTimezone";
import {
  buildCalendarOperationalFeedFromBookings,
  calendarOperationalDateWindowForQuery,
  type CalendarOperationalFeedContext,
  type CalendarOperationalFeedResult,
} from "./calendarOperationalFeedCore";

const SLOW_QUERY_MS = 300;

const loadTenantCalendarSettingsCached = cache((tenantId: string, clinicId: string | null) =>
  loadTenantOperationalCalendarSettings(tenantId.trim(), clinicId?.trim() || null)
);

function clinicIdFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): string | null {
  const raw = searchParams.clinicId;
  const s = (Array.isArray(raw) ? String(raw[0] ?? "") : String(raw ?? "")).trim();
  return /^[0-9a-f-]{36}$/i.test(s) ? s : null;
}

async function resolveQueryAsync(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>,
  _route: CalendarRoute
): Promise<ParsedCalendarQuery> {
  const calendarSettings = await loadTenantCalendarSettingsCached(
    tenantId,
    clinicIdFromSearchParams(searchParams)
  );
  const parsed = parseCalendarSearchParams(searchParams, new Date(), {
    calendarTimezone: calendarSettings.calendarTimezone,
  });
  return applyCalendarSettingsToQuery(parsed, calendarSettings.settings, searchParams);
}

async function loadJourneyStatesBatch(
  tenantId: string,
  patientIds: string[]
): Promise<Map<string, PatientJourneyState>> {
  const out = new Map<string, PatientJourneyState>();
  if (!patientIds.length) return out;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patient_journey_states")
    .select("patient_id, current_state, tenant_id")
    .eq("tenant_id", tenantId.trim())
    .in("patient_id", patientIds);
  if (error) {
    if (error.code === "42P01") return out;
    throw new Error(error.message);
  }
  for (const raw of data ?? []) {
    const r = raw as { patient_id: string; current_state: string; tenant_id: string };
    if (String(r.tenant_id).trim() !== tenantId.trim()) continue;
    out.set(String(r.patient_id), r.current_state as PatientJourneyState);
  }
  return out;
}

async function loadDepositFlagsForBookings(
  tenantId: string,
  bookings: FiBookingRow[]
): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  const surgeryIds = bookings
    .filter((b) => b.booking_type.trim().toLowerCase() === "surgery")
    .map((b) => b.id);
  if (!surgeryIds.length) return out;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payment_records")
    .select("booking_id, status, amount_expected, amount_paid, tenant_id")
    .eq("tenant_id", tenantId.trim())
    .in("booking_id", surgeryIds);
  if (error) {
    if (error.code === "42P01") return out;
    throw new Error(error.message);
  }

  const byBooking = new Map<
    string,
    { status: PaymentStatus; amount_expected: number; amount_paid: number }[]
  >();
  for (const raw of data ?? []) {
    const r = raw as {
      booking_id: string | null;
      status: string;
      amount_expected: number;
      amount_paid: number;
      tenant_id: string;
    };
    if (String(r.tenant_id).trim() !== tenantId.trim()) continue;
    const bid = r.booking_id?.trim();
    if (!bid) continue;
    const list = byBooking.get(bid) ?? [];
    list.push({
      status: r.status as PaymentStatus,
      amount_expected: Number(r.amount_expected ?? 0),
      amount_paid: Number(r.amount_paid ?? 0),
    });
    byBooking.set(bid, list);
  }

  const todayYmd = calendarDateStringFromInstant(new Date(), "UTC");
  for (const bid of surgeryIds) {
    const rows = byBooking.get(bid) ?? [];
    if (!rows.length) {
      out.set(bid, false);
      continue;
    }
    const needs = rows.some((r) =>
      paymentRecordNeedsCollection(
        {
          status: r.status,
          amount_expected: r.amount_expected,
          amount_paid: r.amount_paid,
          due_date: null,
        },
        todayYmd
      )
    );
    out.set(bid, !needs);
  }
  return out;
}

function preOpFromMetadata(metadata: Record<string, unknown>): boolean | undefined {
  const raw = metadata.pre_op_checklist;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const items = Object.values(raw as Record<string, unknown>);
  if (!items.length) return undefined;
  return items.every((v) => v === true || v === "done" || v === "complete");
}

export type LoadCalendarOperationalFeedOptions = {
  route?: CalendarRoute;
  enforceCrmReadGate?: boolean;
  adminKey?: string;
  request?: Request;
};

/**
 * Lightweight calendar operational feed — date-windowed bookings with intelligence overlays only.
 * No full patient records, signed URLs, or consultation payloads.
 */
export async function loadCalendarOperationalFeed(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>,
  resources: {
    staffNameById: Record<string, string>;
    roomLabelById: Record<string, string>;
    staffIdByUserId: Map<string, string>;
  },
  opts: LoadCalendarOperationalFeedOptions = {}
): Promise<CalendarOperationalFeedResult> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();

  if (opts.enforceCrmReadGate) {
    await assertCrmTenantReadAllowed({
      tenantId: tid,
      adminKey: opts.adminKey,
      request: opts.request,
    });
  }

  const calendarSettings = await loadTenantCalendarSettingsCached(
    tid,
    clinicIdFromSearchParams(searchParams)
  );
  const query = await resolveQueryAsync(tid, searchParams, opts.route ?? "fi-admin");
  const { rangeStartIso, rangeEndIso } = calendarOperationalDateWindowForQuery(query);

  const tBookingsStart = typeof performance !== "undefined" ? performance.now() : Date.now();
  const bookings = await loadBookingsForCalendarOverlap({
    tenantId: tid,
    rangeStartIso,
    rangeEndIso,
    status: query.status,
    bookingType: query.bookingType,
    assignedUserId: query.assignedUserId,
    assignedStaffId: query.staffId,
    clinicId: query.clinicId,
    roomId: query.roomId,
    includeCancelled: query.includeCancelled,
    limit: CALENDAR_VIEW_BOOKINGS_LIMIT,
  });
  const tBookingsEnd = typeof performance !== "undefined" ? performance.now() : Date.now();
  const bookingsMs = Math.round(tBookingsEnd - tBookingsStart);

  const supabase = supabaseAdmin();
  const patientIds = [
    ...new Set(bookings.map((b) => b.patient_id?.trim()).filter((x): x is string => Boolean(x))),
  ];

  const tBatchStart = typeof performance !== "undefined" ? performance.now() : Date.now();
  const [patientLabels, journeyStates, depositFlags] = await Promise.all([
    loadPatientLabelsForBookings(supabase, tid, bookings),
    loadJourneyStatesBatch(tid, patientIds),
    loadDepositFlagsForBookings(tid, bookings),
  ]);
  const tBatchEnd = typeof performance !== "undefined" ? performance.now() : Date.now();
  const batchMs = Math.round(tBatchEnd - tBatchStart);

  const patientNameByBookingId = new Map<string, string>();
  for (const b of bookings) {
    if (b.patient_id?.trim()) {
      const label = patientLabels.get(`patient:${b.patient_id.trim()}`);
      if (label) patientNameByBookingId.set(b.id, label);
    } else if (b.person_id?.trim()) {
      const label = patientLabels.get(`person:${b.person_id.trim()}`);
      if (label) patientNameByBookingId.set(b.id, label);
    }
  }

  const preOpCompleteByBookingId = new Map<string, boolean>();
  for (const b of bookings) {
    const v = preOpFromMetadata(b.metadata ?? {});
    if (v !== undefined) preOpCompleteByBookingId.set(b.id, v);
  }

  const staffIdToUserId = new Map<string, string | null>();
  for (const [uid, sid] of resources.staffIdByUserId.entries()) {
    if (sid?.trim()) staffIdToUserId.set(sid.trim(), uid.trim());
  }

  const ctx: CalendarOperationalFeedContext = {
    tenantId: tid,
    patientNameByBookingId,
    staffNameById: resources.staffNameById,
    roomLabelById: resources.roomLabelById,
    journeyStateByPatientId: journeyStates,
    depositSatisfiedByBookingId: depositFlags,
    consentSignedByPatientId: new Map(),
    preOpCompleteByBookingId,
    readinessPercentByBookingId: new Map(),
    staffIdToUserId,
    gridConfig: calendarSettings.gridConfig,
    bufferMinutes: calendarSettings.settings.bufferMinutes,
  };

  const feed = buildCalendarOperationalFeedFromBookings(bookings, ctx);
  feed.rangeStartIso = rangeStartIso;
  feed.rangeEndIso = rangeEndIso;

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const durationMs = Math.round(t1 - t0);

  const timing = {
    phase: "loadCalendarOperationalFeed",
    durationMs,
    subMs_bookings: bookingsMs,
    subMs_batchContext: batchMs,
    view: query.view,
    dateAnchor: query.dateAnchor,
    rangeStartIso,
    rangeEndIso,
    bookingCount: bookings.length,
    feedItemCount: feed.items.length,
    approxBytes: new TextEncoder().encode(JSON.stringify(feed.items)).length,
  };

  logOperationalCalendarServerTiming(timing);
  if (process.env.NODE_ENV === "development" && durationMs > SLOW_QUERY_MS) {
    // eslint-disable-next-line no-console -- dev slow-query profiling
    console.warn("[fi-calendar/slow]", timing);
  }

  return feed;
}

/** Build operational feed context + items for an already-loaded booking set (grid loader path). */
export async function buildOperationalFeedForGridBookings(
  tenantId: string,
  bookings: FiBookingRow[],
  resources: {
    staffNameById: Record<string, string>;
    roomDisplayById: Record<string, string>;
    staffIdByUserId: Map<string, string>;
  },
  calendarSettings: Awaited<ReturnType<typeof loadTenantOperationalCalendarSettings>>
): Promise<ReturnType<typeof buildCalendarOperationalFeedFromBookings>> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const patientIds = [
    ...new Set(bookings.map((b) => b.patient_id?.trim()).filter((x): x is string => Boolean(x))),
  ];

  const [patientLabels, journeyStates, depositFlags] = await Promise.all([
    loadPatientLabelsForBookings(supabase, tid, bookings),
    loadJourneyStatesBatch(tid, patientIds),
    loadDepositFlagsForBookings(tid, bookings),
  ]);

  const patientNameByBookingId = new Map<string, string>();
  for (const b of bookings) {
    if (b.patient_id?.trim()) {
      const label = patientLabels.get(`patient:${b.patient_id.trim()}`);
      if (label) patientNameByBookingId.set(b.id, label);
    } else if (b.person_id?.trim()) {
      const label = patientLabels.get(`person:${b.person_id.trim()}`);
      if (label) patientNameByBookingId.set(b.id, label);
    }
  }

  const preOpCompleteByBookingId = new Map<string, boolean>();
  for (const b of bookings) {
    const v = preOpFromMetadata(b.metadata ?? {});
    if (v !== undefined) preOpCompleteByBookingId.set(b.id, v);
  }

  const staffIdToUserId = new Map<string, string | null>();
  for (const [uid, sid] of resources.staffIdByUserId.entries()) {
    if (sid?.trim()) staffIdToUserId.set(sid.trim(), uid.trim());
  }

  const ctx: CalendarOperationalFeedContext = {
    tenantId: tid,
    patientNameByBookingId,
    staffNameById: resources.staffNameById,
    roomLabelById: resources.roomDisplayById,
    journeyStateByPatientId: journeyStates,
    depositSatisfiedByBookingId: depositFlags,
    consentSignedByPatientId: new Map(),
    preOpCompleteByBookingId,
    readinessPercentByBookingId: new Map(),
    staffIdToUserId,
    gridConfig: calendarSettings.gridConfig,
    bufferMinutes: calendarSettings.settings.bufferMinutes,
  };

  return buildCalendarOperationalFeedFromBookings(bookings, ctx);
}

export { calendarOperationalDateWindowForQuery };