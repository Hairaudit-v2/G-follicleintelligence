import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bookingDetailSnapshotFromRowLike,
  collectChangedBookingDetailKeys,
} from "./bookingChangedFields";
import {
  assertAllowedBookingStatus,
  assertAllowedBookingType,
  assertAtLeastOneBookingAnchor,
  assertBookingTypeAllowedForLeadConversion,
  assertEndAfterStart,
  assertMetadataJsonObject,
  assertNonCancelledBookingMutable,
  isBookingRowForTenant,
} from "./bookingPolicy";
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
    assigned_staff_id: null,
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
    room_id: p.room_id ?? null,
    room_required: p.room_required ?? false,
  };
}

describe("Stage 3A — booking type / status allow-list", () => {
  it("accepts valid type", () => {
    assertAllowedBookingType("surgery");
  });

  it("rejects invalid type", () => {
    assert.throws(() => assertAllowedBookingType("haircut"), /Invalid booking_type/);
  });

  it("accepts valid status", () => {
    assertAllowedBookingStatus("confirmed");
  });

  it("rejects invalid status", () => {
    assert.throws(() => assertAllowedBookingStatus("pending"), /Invalid booking_status/);
  });
});

describe("Stage 3A — anchor + time guards", () => {
  it("requires at least one anchor", () => {
    assert.throws(
      () => assertAtLeastOneBookingAnchor({ lead_id: null, person_id: null, patient_id: null, case_id: null }),
      /at least one/
    );
  });

  it("allows lead-only anchor", () => {
    assertAtLeastOneBookingAnchor({ lead_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
  });

  it("requires end after start", () => {
    assert.throws(
      () => assertEndAfterStart("2026-06-01T12:00:00.000Z", "2026-06-01T11:00:00.000Z"),
      /end_at must be after/
    );
  });

  it("accepts valid range", () => {
    assertEndAfterStart("2026-06-01T10:00:00.000Z", "2026-06-01T11:00:00.000Z");
  });
});

describe("Stage 3A — consultation-only before conversion", () => {
  it("blocks non-consultation when lead not converted", () => {
    assert.throws(
      () =>
        assertBookingTypeAllowedForLeadConversion({
          bookingType: "surgery",
          leadId: "x",
          leadConverted: false,
        }),
      /Only consultation/
    );
  });

  it("allows consultation when lead not converted", () => {
    assertBookingTypeAllowedForLeadConversion({
      bookingType: "consultation",
      leadId: "x",
      leadConverted: false,
    });
  });

  it("allows any listed type when converted", () => {
    assertBookingTypeAllowedForLeadConversion({
      bookingType: "prp",
      leadId: "x",
      leadConverted: true,
    });
  });

  it("allows non-consultation when unconverted lead also has patient_id (quick book)", () => {
    assertBookingTypeAllowedForLeadConversion({
      bookingType: "prp",
      leadId: "x",
      leadConverted: false,
      patientId: "patient-1",
    });
  });
});

describe("Stage 3A — cancelled edit guard", () => {
  it("blocks edits when cancelled", () => {
    assert.throws(
      () => assertNonCancelledBookingMutable(row({ id: "1", booking_status: "cancelled", cancelled_at: null })),
      /Cancelled/
    );
  });

  it("blocks edits when cancelled_at set", () => {
    assert.throws(
      () =>
        assertNonCancelledBookingMutable(
          row({ id: "1", booking_status: "scheduled", cancelled_at: "2026-02-01T00:00:00.000Z" })
        ),
      /Cancelled/
    );
  });

  it("allows when active", () => {
    assertNonCancelledBookingMutable(row({ id: "1", booking_status: "scheduled" }));
  });
});

describe("Stage 3A — changed_keys (pure)", () => {
  it("returns only changed keys", () => {
    const a = row({ id: "1", title: "A", booking_type: "consultation" });
    const b = { ...a, title: "B" };
    const keys = collectChangedBookingDetailKeys(bookingDetailSnapshotFromRowLike(a), bookingDetailSnapshotFromRowLike(b));
    assert.deepEqual(keys, ["title"]);
  });

  it("maps metadata_json to metadata label", () => {
    const a = row({ id: "1", metadata: { x: 1 } });
    const b = { ...a, metadata: { x: 2 } };
    const keys = collectChangedBookingDetailKeys(bookingDetailSnapshotFromRowLike(a), bookingDetailSnapshotFromRowLike(b));
    assert.deepEqual(keys, ["metadata"]);
  });
});

describe("Stage 3A — metadata object validation", () => {
  it("rejects array metadata", () => {
    assert.throws(() => assertMetadataJsonObject([]), /JSON object/);
  });

  it("accepts plain object", () => {
    assertMetadataJsonObject({ a: 1 });
  });
});

describe("Stage 3A — tenant ownership helper", () => {
  it("matches tenant id", () => {
    assert.equal(isBookingRowForTenant(row({ id: "1" }), TID), true);
    assert.equal(isBookingRowForTenant(row({ id: "1" }), "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"), false);
  });
});

describe("Stage 3A — sort by start_at", () => {
  it("sorts ascending with stable id tie-break", () => {
    const late = row({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      start_at: "2026-06-02T10:00:00.000Z",
      end_at: "2026-06-02T11:00:00.000Z",
    });
    const earlyB = row({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      start_at: "2026-06-01T10:00:00.000Z",
      end_at: "2026-06-01T11:00:00.000Z",
    });
    const earlyC = row({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      start_at: "2026-06-01T10:00:00.000Z",
      end_at: "2026-06-01T11:30:00.000Z",
    });
    const sorted = sortBookingsByStartAt([late, earlyC, earlyB]);
    assert.deepEqual(
      sorted.map((x) => x.id),
      [earlyB.id, earlyC.id, late.id]
    );
  });
});
