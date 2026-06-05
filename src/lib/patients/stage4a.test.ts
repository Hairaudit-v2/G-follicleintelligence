import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { patientAdminPatchBodySchema } from "./patientApiSchemas";
import {
  buildPatientDirectoryHref,
  parsePatientDirectoryQuery,
  patientDirectoryQueryToHrefQuery,
} from "./patientDirectoryQuery";
import {
  countCompletedProcedures,
  formatPatientLifetimeValueGbp,
  parseTreatmentValueGbp,
  pickLastVisitAt,
  pickNextAppointment,
  sumPatientLifetimeValueGbp,
} from "./patientDirectoryMetrics";
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
import { buildAppointmentCreatePrefillFromPatient } from "@/src/lib/bookings/bookingPatientPrefillShared";
import { deriveRecommendedBookingTypeForPatient } from "@/src/lib/bookings/bookingPatientSummary";
import {
  buildPatientLeadHistoryTimeline,
  pickPrimaryLeadForPatient,
  type PatientPersonLeadHistoryItem,
} from "./patientLeadHistoryShared";

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
      norwoodMin: "III",
      norwoodMax: "V",
      lastVisitFrom: "2026-01-01",
      lastVisitTo: "2026-06-01",
      leadSource: "hubspot",
      sort: "created_asc",
      page: "2",
      pageSize: "50",
    });
    assert.equal(q.search, "anna");
    assert.equal(q.patientStatus, "inactive");
    assert.equal(q.hasActiveCase, true);
    assert.equal(q.hasFutureBooking, false);
    assert.equal(q.norwoodMin, "III");
    assert.equal(q.norwoodMax, "V");
    assert.equal(q.lastVisitFrom, "2026-01-01T00:00:00.000Z");
    assert.equal(q.lastVisitTo, "2026-06-01T23:59:59.999Z");
    assert.equal(q.leadSource, "hubspot");
    assert.equal(q.sort, "created_asc");
    assert.equal(q.page, 2);
    assert.equal(q.pageSize, 50);
    const href = buildPatientDirectoryHref("tid", q);
    assert.ok(href.includes("/fi-admin/tid/patients"));
    const back = patientDirectoryQueryToHrefQuery(q);
    assert.equal(back.status, "inactive");
    assert.equal(back.norwoodMin, "III");
    assert.equal(back.leadSource, "hubspot");
  });

  it("patient admin patch schema requires at least one field", () => {
    const ok = patientAdminPatchBodySchema.safeParse({ patient_status: "inactive" });
    assert.equal(ok.success, true);
    const okReminder = patientAdminPatchBodySchema.safeParse({ reminder_consent: true });
    assert.equal(okReminder.success, true);
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

  it("patient directory commercial and booking metrics", () => {
    const nowIso = "2026-06-10T12:00:00.000Z";
    const bookings = [
      {
        id: "b1",
        start_at: "2026-06-08T10:00:00.000Z",
        booking_status: "completed",
        booking_type: "surgery",
        title: "FUE day",
      },
      {
        id: "b2",
        start_at: "2026-06-11T10:00:00.000Z",
        booking_status: "scheduled",
        booking_type: "follow_up",
        title: "Review",
      },
      {
        id: "b3",
        start_at: "2026-06-12T10:00:00.000Z",
        booking_status: "confirmed",
        booking_type: "consultation",
        title: "Consult",
      },
    ] as const;
    assert.equal(countCompletedProcedures(bookings), 1);
    assert.equal(pickNextAppointment(bookings, nowIso)?.id, "b2");
    assert.equal(pickLastVisitAt(bookings, nowIso), "2026-06-08T10:00:00.000Z");
    assert.equal(parseTreatmentValueGbp({ treatment_value_gbp: 8500 }), 8500);
    assert.equal(parseTreatmentValueGbp({ treatment_value: "£12,500" }), 12500);
    assert.equal(sumPatientLifetimeValueGbp([{ treatment_value: 5000 }, { estimated_value: 2000 }]), 7000);
    assert.equal(formatPatientLifetimeValueGbp(7000), "£7,000");
  });

  it("activity sorting newest first", () => {
    const sorted = sortActivityEventsNewestFirst([
      { id: "a", occurred_at: "2026-01-01T00:00:00.000Z", activity_kind: "x", title: "1", lead_id: "l1" },
      { id: "b", occurred_at: "2026-06-01T00:00:00.000Z", activity_kind: "y", title: "2", lead_id: "l2" },
    ]);
    assert.equal(sorted[0]?.id, "b");
  });

  it("person lead history timeline and primary lead pick", () => {
    const mkLead = (id: string, patientId: string | null, updated: string): PatientPersonLeadHistoryItem => ({
      lead: {
        id,
        tenant_id: "t1",
        organisation_id: null,
        person_id: "per1",
        patient_id: patientId,
        case_id: null,
        clinic_id: null,
        primary_owner_user_id: null,
        current_stage_id: null,
        status: "open",
        priority: null,
        summary: `Lead ${id}`,
        metadata: {},
        converted_person_id: null,
        converted_at: null,
        converted_case_id: null,
        converted_by_user_id: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: updated,
      },
      stageLabel: null,
      ownerLabel: null,
      linkedToThisPatient: patientId === "pat1",
    });

    const items = [mkLead("l-old", null, "2026-02-01T00:00:00.000Z"), mkLead("l-new", "pat1", "2026-06-01T00:00:00.000Z")];
    assert.equal(pickPrimaryLeadForPatient(items)?.id, "l-new");

    const timeline = buildPatientLeadHistoryTimeline(items, [
      {
        id: "act1",
        occurred_at: "2026-05-01T00:00:00.000Z",
        activity_kind: "note.created",
        title: "Called patient",
        lead_id: "l-new",
        leadTitle: "Lead l-new",
        linkedToThisPatient: true,
      },
    ]);
    const activityRow = timeline.find((r) => r.kind === "crm_activity");
    assert.equal(activityRow?.occurredAt, "2026-05-01T00:00:00.000Z");
    assert.equal(timeline[0]?.kind, "lead");
  });

  it("patient booking prefill and recommended type", () => {
    const bookings = [
      {
        id: "b1",
        tenant_id: "t1",
        lead_id: null,
        person_id: "per1",
        patient_id: "pat1",
        case_id: null,
        clinic_id: null,
        assigned_user_id: null,
        booking_type: "consultation",
        booking_status: "completed",
        title: null,
        description: null,
        start_at: "2026-05-01T10:00:00.000Z",
        end_at: "2026-05-01T11:00:00.000Z",
        timezone: null,
        location: null,
        metadata: {},
        cancelled_at: null,
        cancelled_by_user_id: null,
        cancellation_reason: null,
        created_by_user_id: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
      },
    ] as const;

    const rec = deriveRecommendedBookingTypeForPatient({ bookings: [...bookings], primaryLead: null });
    assert.equal(rec.bookingType, "surgery");

    const prefill = buildAppointmentCreatePrefillFromPatient({
      patientId: "pat1",
      personId: "per1",
      displayName: "Anna",
      bookings: [...bookings],
    });
    assert.equal(prefill.patientId, "pat1");
    assert.equal(prefill.personId, "per1");
    assert.equal(prefill.bookingType, "surgery");
    assert.match(prefill.title ?? "", /Anna/);
  });
});
