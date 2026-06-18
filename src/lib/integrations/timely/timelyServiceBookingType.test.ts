import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveTimelyServiceBookingType } from "./timelyServiceBookingType";

describe("deriveTimelyServiceBookingType", () => {
  it("uses explicit booking_type when set", () => {
    assert.equal(
      deriveTimelyServiceBookingType({
        name: "PRP Treatment",
        category: "Treatment",
        booking_type: "prp",
      }),
      "prp"
    );
  });

  it("derives hair_transplant_consultation from service name when booking_type is null", () => {
    assert.equal(
      deriveTimelyServiceBookingType({
        name: "Hair Transplant Consultation",
        category: "Consultation",
        booking_type: null,
      }),
      "hair_transplant_consultation"
    );
  });

  it("derives consultation from phone and in-clinic consultation names", () => {
    assert.equal(
      deriveTimelyServiceBookingType({
        name: "Phone Consultation",
        category: "Consultation",
        booking_type: null,
      }),
      "consultation"
    );
    assert.equal(
      deriveTimelyServiceBookingType({
        name: "In-Clinic Consultation",
        category: "Consultation",
        booking_type: null,
      }),
      "consultation"
    );
  });

  it("derives trichology and transplant consultation variants", () => {
    assert.equal(
      deriveTimelyServiceBookingType({
        name: "Trichology Consultation",
        category: "Consultation",
        booking_type: null,
      }),
      "trichology"
    );
    assert.equal(
      deriveTimelyServiceBookingType({
        name: "Beard Transplant Consultation",
        category: "Consultation",
        booking_type: null,
      }),
      "beard_transplant_consultation"
    );
    assert.equal(
      deriveTimelyServiceBookingType({
        name: "Eyebrow Transplant Consultation",
        category: "Consultation",
        booking_type: null,
      }),
      "eyebrow_transplant_consultation"
    );
  });

  it("derives follow_up and review from follow-up service names", () => {
    assert.equal(
      deriveTimelyServiceBookingType({
        name: "Follow-Up Review",
        category: "Follow-up",
        booking_type: null,
      }),
      "follow_up"
    );
    assert.equal(
      deriveTimelyServiceBookingType({
        name: "Surgery Review",
        category: "Follow-up",
        booking_type: null,
      }),
      "review"
    );
  });

  it("falls back to consultation for Consultation category without a name map", () => {
    assert.equal(
      deriveTimelyServiceBookingType({
        name: "Custom Consultation Variant",
        category: "Consultation",
        booking_type: null,
      }),
      "consultation"
    );
  });

  it("throws when booking_type cannot be derived", () => {
    assert.throws(
      () =>
        deriveTimelyServiceBookingType({
          name: "Mystery Treatment",
          category: "Treatment",
          booking_type: null,
        }),
      /Cannot derive booking_type/
    );
  });
});
