import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildPrepReminders,
  detectSchedulingConflicts,
  isHighPrepBookingType,
  prepBufferMinutesForBookingType,
  rankSuggestedSlots,
} from "../src/lib/calendar/smart-scheduling/smartSchedulingCore";
import {
  mergeBookingMetadataWithSchedulingPrep,
  SCHEDULING_PREP_METADATA_KEY,
} from "../src/lib/calendar/smart-scheduling/schedulingPrepMetadata";

const STAFF = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ROOM = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("Smart Scheduling Assistant", () => {
  it("flags high-prep booking types and prep buffers", () => {
    assert.equal(isHighPrepBookingType("surgery"), true);
    assert.equal(isHighPrepBookingType("consultation"), false);
    assert.ok(prepBufferMinutesForBookingType("surgery") >= 45);
  });

  it("detectSchedulingConflicts finds doctor double-book", () => {
    const result = detectSchedulingConflicts({
      candidate: {
        startAt: "2026-07-17T10:00:00.000Z",
        endAt: "2026-07-17T11:00:00.000Z",
        assignedStaffId: STAFF,
        bookingType: "consultation",
      },
      existing: [
        {
          id: "b1",
          start_at: "2026-07-17T10:30:00.000Z",
          end_at: "2026-07-17T11:30:00.000Z",
          assigned_staff_id: STAFF,
          booking_type: "review",
          booking_status: "scheduled",
          title: "Review visit",
        },
      ],
      staffLabel: "Dr. Smith",
      bufferMinutes: 0,
    });
    assert.equal(result.status, "blocked");
    assert.ok(result.conflicts.some((c) => c.kind === "doctor_double_booked"));
    assert.match(result.conflicts[0]!.message, /Dr\. Smith/i);
  });

  it("detects room conflicts with warm messaging", () => {
    const result = detectSchedulingConflicts({
      candidate: {
        startAt: "2026-07-17T12:00:00.000Z",
        endAt: "2026-07-17T13:00:00.000Z",
        roomId: ROOM,
        bookingType: "prp",
      },
      existing: [
        {
          id: "b2",
          start_at: "2026-07-17T12:15:00.000Z",
          end_at: "2026-07-17T12:45:00.000Z",
          room_id: ROOM,
          booking_status: "confirmed",
          title: "PRP session",
        },
      ],
      roomLabel: "Procedure 1",
      bufferMinutes: 0,
    });
    assert.equal(result.status, "blocked");
    assert.ok(result.conflicts.some((c) => c.kind === "room_double_booked"));
    assert.match(result.conflicts[0]!.message, /Procedure 1/);
  });

  it("requires clinician for surgery", () => {
    const result = detectSchedulingConflicts({
      candidate: {
        startAt: "2026-07-17T08:00:00.000Z",
        endAt: "2026-07-17T16:00:00.000Z",
        bookingType: "surgery",
      },
      existing: [],
    });
    assert.equal(result.status, "blocked");
    assert.ok(result.conflicts.some((c) => c.kind === "surgery_missing_staff"));
  });

  it("builds operational prep reminders for surgery", () => {
    const prep = buildPrepReminders({ bookingType: "surgery", hasPatient: true });
    assert.ok(prep.some((p) => p.code === "photo_audit"));
    assert.ok(prep.some((p) => p.code === "consent_form"));
    assert.ok(prep.every((p) => !/diagnos|prescri/i.test(p.detail + p.label)));
  });

  it("ranks suggested slots preferring same staff", () => {
    const ranked = rankSuggestedSlots(
      [
        {
          startAt: "2026-07-18T09:00:00.000Z",
          endAt: "2026-07-18T09:30:00.000Z",
          staffId: "other",
          roomId: ROOM,
          reason: "open",
        },
        {
          startAt: "2026-07-18T10:00:00.000Z",
          endAt: "2026-07-18T10:30:00.000Z",
          staffId: STAFF,
          roomId: ROOM,
          reason: "open",
        },
      ],
      { preferStaffId: STAFF, max: 2 }
    );
    assert.equal(ranked[0]!.staffId, STAFF);
  });

  it("merges scheduling_prep into booking metadata without wiping other keys", () => {
    const meta = mergeBookingMetadataWithSchedulingPrep(
      { template_label: "Consult" },
      { bookingType: "surgery", hasPatient: true }
    );
    assert.equal(meta.template_label, "Consult");
    const prep = meta[SCHEDULING_PREP_METADATA_KEY] as {
      version: number;
      items: { code: string; completed: boolean }[];
    };
    assert.equal(prep.version, 1);
    assert.ok(prep.items.length >= 2);
    assert.ok(prep.items.every((i) => i.completed === false));
  });
});
