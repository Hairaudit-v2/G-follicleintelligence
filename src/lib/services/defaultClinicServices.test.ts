import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isAllowedBookingType } from "@/src/lib/bookings/bookingPolicy";
import {
  DEFAULT_CLINIC_SERVICE_LIBRARY,
  defaultClinicServicesAsImportRows,
} from "./defaultClinicServices";

describe("DEFAULT_CLINIC_SERVICE_LIBRARY", () => {
  it("defines seventeen Evolved default services", () => {
    assert.equal(DEFAULT_CLINIC_SERVICE_LIBRARY.length, 17);
    const names = DEFAULT_CLINIC_SERVICE_LIBRARY.map((s) => s.name);
    assert.ok(names.includes("Phone Consultation"));
    assert.ok(names.includes("Block Time / Admin Hold"));
    assert.equal(new Set(names).size, 17);
  });

  it("uses Evolved default pricing", () => {
    const byName = new Map(DEFAULT_CLINIC_SERVICE_LIBRARY.map((s) => [s.name, s]));
    assert.equal(byName.get("Phone Consultation")?.base_price, 0);
    assert.equal(byName.get("Trichology Consultation")?.base_price, 120);
    assert.equal(byName.get("PRP Treatment")?.base_price, 320);
    assert.equal(byName.get("Hair Transplant Surgery - One Day")?.base_price, 11_000);
    assert.equal(byName.get("Eyebrow Transplant Surgery")?.base_price, 5_500);
  });

  it("has at most one row per non-null booking_type", () => {
    const typed = DEFAULT_CLINIC_SERVICE_LIBRARY.filter((s) => s.booking_type);
    const keys = typed.map((s) => s.booking_type);
    assert.equal(new Set(keys).size, keys.length);
    for (const s of typed) {
      assert.ok(isAllowedBookingType(s.booking_type!));
    }
  });

  it("maps to valid import rows", () => {
    const rows = defaultClinicServicesAsImportRows();
    assert.equal(rows.length, 17);
    for (const r of rows) {
      assert.ok(r.name.trim());
      assert.ok(r.duration_minutes > 0);
      assert.equal(r.is_active, true);
    }
  });
});
