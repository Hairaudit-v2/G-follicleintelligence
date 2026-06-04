import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bookingStatusLabel, bookingTypeLabel } from "./operatorBookingLabels";
import { DEFAULT_OPERATOR_BOOKINGS_LIMIT } from "./operatorBookingConstants";
import {
  buildOperatorBookingsHref,
  defaultOperatorBookingRangeIso,
  parseOperatorBookingSearchParams,
} from "./operatorBookingQuery";
import {
  computeOperatorBookingSummaryCounts,
  filterOperatorBookingsByCancelledPolicy,
} from "./operatorBookingSummary";
import { sortBookingsByStartAt } from "./bookingTime";
import type { FiBookingRow } from "./types";

const TID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function row(p: Partial<FiBookingRow> & Pick<FiBookingRow, "id">): FiBookingRow {
  return {
    tenant_id: TID,
    lead_id: null,
    person_id: null,
    patient_id: null,
    case_id: null,
    clinic_id: null,
    assigned_user_id: null,
    booking_type: "consultation",
    booking_status: "scheduled",
    title: null,
    description: null,
    start_at: "2026-06-01T10:00:00.000Z",
    end_at: "2026-06-01T11:00:00.000Z",
    timezone: null,
    location: null,
    metadata: {},
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...p,
  };
}

describe("Stage 3B — operator query parsing", () => {
  it("defaults range to start of today UTC through +31 days (exclusive end)", () => {
    const now = new Date("2026-06-05T15:30:00.000Z");
    const q = parseOperatorBookingSearchParams({}, now);
    assert.equal(q.startIso, "2026-06-05T00:00:00.000Z");
    assert.equal(q.endIso, "2026-07-06T00:00:00.000Z");
    const d = defaultOperatorBookingRangeIso(now);
    assert.equal(d.startIso, q.startIso);
    assert.equal(d.endIso, q.endIso);
  });

  it("reverts invalid date range to defaults", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    const q = parseOperatorBookingSearchParams(
      {
        start: "2026-02-01T00:00:00.000Z",
        end: "2026-01-01T00:00:00.000Z",
      },
      now
    );
    assert.equal(q.startIso, "2026-01-10T00:00:00.000Z");
    assert.equal(q.endIso, "2026-02-10T00:00:00.000Z");
  });

  it("forces includeCancelled when status filter is cancelled", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const q = parseOperatorBookingSearchParams({ status: "cancelled" }, now);
    assert.equal(q.status, "cancelled");
    assert.equal(q.includeCancelled, true);
  });

  it("ignores invalid status / type / UUID filters", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const q = parseOperatorBookingSearchParams(
      {
        status: "nope",
        type: "invalid",
        assignedUserId: "not-a-uuid",
        clinicId: "x",
      },
      now
    );
    assert.equal(q.status, null);
    assert.equal(q.bookingType, null);
    assert.equal(q.assignedUserId, null);
    assert.equal(q.clinicId, null);
  });

  it("buildOperatorBookingsHref omits empty query parts", () => {
    const href = buildOperatorBookingsHref("tenant-uuid", {});
    assert.equal(href, "/fi-admin/tenant-uuid/bookings");
  });
});

describe("Stage 3B — summary counts", () => {
  it("counts today, upcoming, overdue, cancelled, and completed", () => {
    const nowMs = Date.parse("2026-06-05T12:00:00.000Z");
    const dayStartMs = Date.parse("2026-06-05T00:00:00.000Z");
    const dayEndMs = Date.parse("2026-06-06T00:00:00.000Z");

    const rows: FiBookingRow[] = [
      row({
        id: "a0000000-0000-4000-8000-000000000001",
        start_at: "2026-06-05T09:00:00.000Z",
        end_at: "2026-06-05T10:00:00.000Z",
        booking_status: "scheduled",
      }),
      row({
        id: "a0000000-0000-4000-8000-000000000002",
        start_at: "2026-06-06T10:00:00.000Z",
        booking_status: "confirmed",
      }),
      row({
        id: "a0000000-0000-4000-8000-000000000003",
        start_at: "2026-06-04T10:00:00.000Z",
        booking_status: "scheduled",
      }),
      row({
        id: "a0000000-0000-4000-8000-000000000004",
        start_at: "2026-06-04T11:00:00.000Z",
        booking_status: "completed",
      }),
      row({
        id: "a0000000-0000-4000-8000-000000000005",
        start_at: "2026-06-05T14:00:00.000Z",
        booking_status: "cancelled",
        cancelled_at: "2026-06-05T13:00:00.000Z",
      }),
    ];

    const c = computeOperatorBookingSummaryCounts(rows, { nowMs, dayStartMs, dayEndMs });
    assert.equal(c.today, 2);
    assert.equal(c.upcoming, 1);
    assert.equal(c.overdue, 2);
    assert.equal(c.cancelled, 1);
    assert.equal(c.completed, 1);
  });
});

describe("Stage 3B — labels", () => {
  it("maps known booking types and statuses", () => {
    assert.equal(bookingTypeLabel("follow_up"), "Follow-up");
    assert.equal(bookingStatusLabel("no_show"), "No-show");
  });
});

describe("Stage 3B — operator sort + cancelled filter", () => {
  it("sorts ascending by start_at then id", () => {
    const a = row({ id: "b0000000-0000-4000-8000-000000000002", start_at: "2026-06-02T10:00:00.000Z" });
    const b = row({ id: "b0000000-0000-4000-8000-000000000001", start_at: "2026-06-02T10:00:00.000Z" });
    const c = row({ id: "b0000000-0000-4000-8000-000000000003", start_at: "2026-06-01T10:00:00.000Z" });
    const sorted = sortBookingsByStartAt([a, b, c]);
    assert.deepEqual(
      sorted.map((x) => x.id),
      [c.id, b.id, a.id]
    );
  });

  it("filterOperatorBookingsByCancelledPolicy excludes cancelled unless includeCancelled", () => {
    const open = row({ id: "c1", booking_status: "scheduled" });
    const cancelled = row({
      id: "c2",
      booking_status: "cancelled",
      cancelled_at: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(filterOperatorBookingsByCancelledPolicy([open, cancelled], false).length, 1);
    assert.equal(filterOperatorBookingsByCancelledPolicy([open, cancelled], true).length, 2);
  });
});

describe("Stage 3B — operator list cap constant", () => {
  it("exposes a bounded default list limit", () => {
    assert.equal(DEFAULT_OPERATOR_BOOKINGS_LIMIT, 500);
  });
});
