import assert from "node:assert/strict";
import { test } from "node:test";

import {
  countAgendaBookingsOnOperationalDayByBucket,
  countDistinctLeadBookingsOnOperationalDay,
} from "@/src/components/fi-admin/operations/operationsAgendaDayStats";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

/** Use UTC so calendar YMD matches ISO calendar dates in tests. */
const TZ = "UTC";
const YMD = "2026-06-10";

function agendaFromBookings(
  rows: Array<{ start_at: string; lead_id: string | null; timezone: string | null; booking_type: string }>
): TenantOperationalDashboard["agendaByBucket"] {
  const empty = { consult: [] as TenantOperationalDashboard["agendaByBucket"]["consult"], surgery: [], follow_up: [], other: [] };
  for (const r of rows) {
    const t = r.booking_type.trim();
    const bucket =
      t === "consultation" ? "consult" : t === "surgery" ? "surgery" : t === "follow_up" || t === "review" ? "follow_up" : "other";
    empty[bucket].push({
      id: "f0000000-0000-4000-8000-000000000001",
      start_at: r.start_at,
      end_at: r.start_at,
      title: "t",
      booking_type: r.booking_type,
      booking_status: "scheduled",
      timezone: r.timezone,
      lead_id: r.lead_id,
      patient_id: null,
      case_id: null,
    });
  }
  return empty;
}

test("countDistinctLeadBookingsOnOperationalDay: only counts lead-linked bookings on operational YMD", () => {
  const leadA = "a1000000-0000-4000-8000-000000000001";
  const leadB = "b1000000-0000-4000-8000-000000000002";
  const agenda = agendaFromBookings([
    { start_at: "2026-06-09T14:00:00.000Z", lead_id: leadA, timezone: TZ, booking_type: "consultation" },
    { start_at: "2026-06-10T14:00:00.000Z", lead_id: leadA, timezone: TZ, booking_type: "consultation" },
    { start_at: "2026-06-10T14:00:00.000Z", lead_id: leadB, timezone: TZ, booking_type: "consultation" },
    { start_at: "2026-06-10T14:00:00.000Z", lead_id: null, timezone: TZ, booking_type: "consultation" },
  ]);
  assert.equal(countDistinctLeadBookingsOnOperationalDay(agenda, YMD, TZ), 2);
});

test("countAgendaBookingsOnOperationalDayByBucket: derived from agenda rows only", () => {
  const agenda = agendaFromBookings([
    { start_at: "2026-06-10T14:00:00.000Z", lead_id: null, timezone: TZ, booking_type: "consultation" },
    { start_at: "2026-06-10T15:00:00.000Z", lead_id: null, timezone: TZ, booking_type: "surgery" },
  ]);
  const c = countAgendaBookingsOnOperationalDayByBucket(agenda, YMD, TZ);
  assert.equal(c.consult, 1);
  assert.equal(c.surgery, 1);
  assert.equal(c.follow_up, 0);
  assert.equal(c.other, 0);
});
