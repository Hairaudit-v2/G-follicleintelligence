import assert from "node:assert/strict";
import test from "node:test";

import {
  getBookingDisplayName,
  isUuidTruncationDisplayLabel,
  optimisticBookingAnchorLabel,
  personDisplayNameFromMetadata,
} from "@/src/lib/bookings/bookingDisplayName";

test("personDisplayNameFromMetadata prefers first + last name", () => {
  assert.equal(
    personDisplayNameFromMetadata({ first_name: "Jane", last_name: "Doe", display_name: "Other" }),
    "Jane Doe"
  );
});

test("getBookingDisplayName: new patient person metadata shows full name", () => {
  const label = getBookingDisplayName({
    patientPersonMeta: { first_name: "Sam", surname: "Nguyen", phone: "0412345678" },
    patientMeta: {},
    bookingType: "consultation",
  });
  assert.equal(label, "Sam Nguyen");
  assert.equal(isUuidTruncationDisplayLabel(label), false);
});

test("getBookingDisplayName: existing patient uses person display name", () => {
  const label = getBookingDisplayName({
    patientPersonMeta: { display_name: "Alex Chen", email: "alex@example.com" },
    bookingType: "prp",
  });
  assert.equal(label, "Alex Chen");
});

test("getBookingDisplayName: existing lead uses lead contact name", () => {
  const label = getBookingDisplayName({
    leadPersonMeta: { first_name: "Morgan", last_name: "Lee" },
    leadSummary: "Website enquiry",
    bookingType: "consultation",
  });
  assert.equal(label, "Morgan Lee");
});

test("getBookingDisplayName: lead summary when no person name", () => {
  const label = getBookingDisplayName({
    leadSummary: "Phone call-in — Riley Smith",
    bookingType: "consultation",
  });
  assert.equal(label, "Phone call-in — Riley Smith");
});

test("getBookingDisplayName: mobile then email fallback", () => {
  assert.equal(
    getBookingDisplayName({
      patientPersonMeta: { phone: "0400111222" },
      bookingType: "consultation",
    }),
    "0400111222"
  );
  assert.equal(
    getBookingDisplayName({
      leadPersonMeta: { email: "guest@clinic.test" },
      bookingType: "consultation",
    }),
    "guest@clinic.test"
  );
});

test("getBookingDisplayName: unnamed patient when nothing else", () => {
  assert.equal(
    getBookingDisplayName({
      bookingType: "consultation",
    }),
    "Unnamed patient"
  );
  assert.equal(getBookingDisplayName({}), "Unnamed patient");
});

test("getBookingDisplayName never returns uuid truncation labels", () => {
  const label = getBookingDisplayName({
    patientMeta: {},
    bookingTitle: "Consultation",
    bookingType: "consultation",
  });
  assert.equal(isUuidTruncationDisplayLabel(label), false);
  assert.notEqual(label, "Patient 8ebbba…");
});

test("optimisticBookingAnchorLabel avoids uuid-style labels", () => {
  assert.equal(
    optimisticBookingAnchorLabel({ title: "Consultation — Jamie Fox", booking_type: "consultation" }),
    "Jamie Fox"
  );
  assert.equal(isUuidTruncationDisplayLabel(optimisticBookingAnchorLabel({ booking_type: "prp" })), false);
});
