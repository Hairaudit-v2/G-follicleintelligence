import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CALENDAR_QUICK_TEMPLATES } from "@/src/lib/calendar/calendarQuickCreateTemplates";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import { quickTemplateDurationMinutes, serviceForCatalogName } from "./servicesCatalog";

function row(
  partial: Partial<FiServiceRow> & Pick<FiServiceRow, "name" | "booking_type">
): FiServiceRow {
  return {
    id: "id",
    tenant_id: "t1",
    duration_minutes: partial.duration_minutes ?? 90,
    base_price: 0,
    color: null,
    category: partial.category ?? null,
    is_active: partial.is_active ?? true,
    ...partial,
  };
}

describe("quickTemplateDurationMinutes", () => {
  it("uses catalog name match before booking_type", () => {
    const services = [
      row({
        name: "In-Clinic Consultation",
        booking_type: "consultation",
        category: "Consultation",
        duration_minutes: 45,
      }),
      row({
        name: "Phone Consultation",
        booking_type: null,
        category: "Consultation",
        duration_minutes: 25,
      }),
    ];
    const phone = CALENDAR_QUICK_TEMPLATES.find((t) => t.id === "phone_consult")!;
    assert.equal(quickTemplateDurationMinutes(phone, services), 25);
  });

  it("falls back to template duration when catalog is empty", () => {
    const surgery = CALENDAR_QUICK_TEMPLATES.find((t) => t.id === "surgery")!;
    assert.equal(quickTemplateDurationMinutes(surgery, []), 480);
    assert.equal(quickTemplateDurationMinutes(surgery, null), 480);
  });

  it("resolves PRP duration from fi_services", () => {
    const services = [
      row({
        name: "PRP Treatment",
        booking_type: "prp",
        category: "Treatment",
        duration_minutes: 75,
      }),
    ];
    const prp = CALENDAR_QUICK_TEMPLATES.find((t) => t.id === "prp")!;
    assert.equal(quickTemplateDurationMinutes(prp, services), 75);
  });
});

describe("serviceForCatalogName", () => {
  it("ignores inactive rows", () => {
    const hit = serviceForCatalogName(
      [row({ name: "PRP Treatment", booking_type: "prp", is_active: false, duration_minutes: 60 })],
      "PRP Treatment",
      "Treatment"
    );
    assert.equal(hit, null);
  });
});
