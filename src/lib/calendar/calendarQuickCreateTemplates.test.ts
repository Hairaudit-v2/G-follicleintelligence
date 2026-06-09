import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BOOKING_TYPES, isAllowedBookingType } from "@/src/lib/bookings/bookingPolicy";
import { CALENDAR_QUICK_TEMPLATES } from "./calendarQuickCreateTemplates";

describe("CALENDAR_QUICK_TEMPLATES (Stage 2A MVP)", () => {
  it("exposes all seven receptionist quick-book types", () => {
    const labels = CALENDAR_QUICK_TEMPLATES.map((t) => t.label);
    assert.deepEqual(labels, [
      "Phone Consultation",
      "Consultation",
      "PRP",
      "Exosomes",
      "Follow Up",
      "Surgery Review",
      "Surgery",
    ]);
  });

  it("maps every template to an allowed platform booking_type", () => {
    for (const tpl of CALENDAR_QUICK_TEMPLATES) {
      assert.ok(isAllowedBookingType(tpl.bookingType), `${tpl.id} -> ${tpl.bookingType}`);
      assert.ok(BOOKING_TYPES.includes(tpl.bookingType));
      assert.ok(tpl.durationMinutes > 0, tpl.id);
    }
    assert.equal(CALENDAR_QUICK_TEMPLATES.find((t) => t.id === "surgery")?.durationMinutes, 240);
  });
});
