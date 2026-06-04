import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { patientAdminPatchBodySchema } from "./patientApiSchemas";
import {
  buildPatientDirectoryHref,
  parsePatientDirectoryQuery,
  patientDirectoryQueryToHrefQuery,
} from "./patientDirectoryQuery";
import {
  assertAdminNoteWithinBounds,
  isAllowedPatientStatus,
  normalizePatientStatus,
  PATIENT_ADMIN_NOTE_MAX_LENGTH,
  PATIENT_STATUS_VALUES,
} from "./patientPolicy";
import {
  computePatientProfileSummaryMetrics,
  countLinkedLeadsForPatient,
  sortActivityEventsNewestFirst,
  splitBookingsUpcomingPast,
} from "./patientProfileSummary";

describe("Stage 4A — patient profile foundation (pure)", () => {
  it("patient status allow-list", () => {
    assert.equal(isAllowedPatientStatus("active"), true);
    assert.equal(isAllowedPatientStatus("bogus"), false);
    assert.equal(normalizePatientStatus("bogus"), "active");
    assert.equal(normalizePatientStatus("archived"), "archived");
    assert.ok(PATIENT_STATUS_VALUES.includes("deceased"));
  });

  it("admin note length", () => {
    assert.doesNotThrow(() => assertAdminNoteWithinBounds("x".repeat(PATIENT_ADMIN_NOTE_MAX_LENGTH)));
    assert.throws(() => assertAdminNoteWithinBounds("x".repeat(PATIENT_ADMIN_NOTE_MAX_LENGTH + 1)));
  });

  it("directory query parsing and href round-trip keys", () => {
    const q = parsePatientDirectoryQuery({
      q: "  anna ",
      status: "inactive",
      hasActiveCase: "true",
      hasFutureBooking: "false",
      sort: "created_asc",
      page: "2",
      pageSize: "50",
    });
    assert.equal(q.search, "anna");
    assert.equal(q.patientStatus, "inactive");
    assert.equal(q.hasActiveCase, true);
    assert.equal(q.hasFutureBooking, false);
    assert.equal(q.sort, "created_asc");
    assert.equal(q.page, 2);
    assert.equal(q.pageSize, 50);
    const href = buildPatientDirectoryHref("tid", q);
    assert.ok(href.includes("/fi-admin/tid/patients"));
    const back = patientDirectoryQueryToHrefQuery(q);
    assert.equal(back.status, "inactive");
  });

  it("patient admin patch schema requires at least one field", () => {
    const ok = patientAdminPatchBodySchema.safeParse({ patient_status: "inactive" });
    assert.equal(ok.success, true);
    const bad = patientAdminPatchBodySchema.safeParse({});
    assert.equal(bad.success, false);
  });

  it("summary metrics and booking split", () => {
    const nowIso = "2026-06-10T12:00:00.000Z";
    const metrics = computePatientProfileSummaryMetrics({
      leads: [{}, {}],
      cases: [{ status: "draft" }, { status: "complete" }],
      bookings: [
        { start_at: "2026-06-11T10:00:00.000Z", booking_status: "scheduled" },
        { start_at: "2026-06-09T10:00:00.000Z", booking_status: "scheduled" },
        { start_at: "2026-06-08T10:00:00.000Z", booking_status: "completed" },
      ],
      activityEvents: [{ occurred_at: "2026-06-01T08:00:00.000Z" }, { occurred_at: "2026-06-02T08:00:00.000Z" }],
      nowIso,
    });
    assert.equal(metrics.totalLeads, 2);
    assert.equal(metrics.totalCases, 2);
    assert.equal(metrics.upcomingBookings, 1);
    assert.equal(metrics.completedBookings, 1);
    assert.equal(metrics.lastActivityAt, "2026-06-02T08:00:00.000Z");

    const split = splitBookingsUpcomingPast(
      [
        { id: "1", start_at: "2026-06-11T10:00:00.000Z", booking_status: "scheduled", title: "A" },
        { id: "2", start_at: "2026-06-09T10:00:00.000Z", booking_status: "scheduled", title: "B" },
        { id: "3", start_at: "2026-06-08T10:00:00.000Z", booking_status: "completed", title: "C" },
      ],
      nowIso
    );
    assert.equal(split.upcoming.length, 1);
    assert.ok(split.past.length >= 2);
  });

  it("linked lead count", () => {
    const pid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const n = countLinkedLeadsForPatient(
      [{ patient_id: pid }, { patient_id: null }, { patient_id: pid }],
      pid
    );
    assert.equal(n, 2);
  });

  it("activity sorting newest first", () => {
    const sorted = sortActivityEventsNewestFirst([
      { id: "a", occurred_at: "2026-01-01T00:00:00.000Z", activity_kind: "x", title: "1", lead_id: "l1" },
      { id: "b", occurred_at: "2026-06-01T00:00:00.000Z", activity_kind: "y", title: "2", lead_id: "l2" },
    ]);
    assert.equal(sorted[0]?.id, "b");
  });
});
