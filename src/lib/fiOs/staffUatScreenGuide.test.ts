import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveStaffUatScreenKeyFromPath,
  staffUatModuleFromPath,
  STAFF_UAT_SCREEN_GUIDES,
} from "./staffUatScreenGuide";

describe("staffUatScreenGuide", () => {
  it("exposes guides for every focus screen", () => {
    const keys = [
      "reception_board",
      "calendar",
      "surgery_booking_wizard",
      "patient_profile",
      "patient_journey",
      "procedure_day",
      "workforce_os",
    ] as const;
    for (const key of keys) {
      const guide = STAFF_UAT_SCREEN_GUIDES[key];
      assert.ok(guide.purpose.length > 0);
      assert.ok(guide.nextBestAction.length > 0);
      assert.ok(guide.commonMistakes.length >= 2);
    }
  });

  it("resolves screen keys from fi-admin paths", () => {
    const tid = "tenant-1";
    assert.equal(
      resolveStaffUatScreenKeyFromPath(`/fi-admin/${tid}/reception-board`),
      "reception_board"
    );
    assert.equal(resolveStaffUatScreenKeyFromPath(`/fi-admin/${tid}/calendar`), "calendar");
    assert.equal(
      resolveStaffUatScreenKeyFromPath(`/fi-admin/${tid}/procedure-day`),
      "procedure_day"
    );
    assert.equal(
      resolveStaffUatScreenKeyFromPath(`/fi-admin/${tid}/workforce-os`),
      "workforce_os"
    );
    assert.equal(
      resolveStaffUatScreenKeyFromPath(`/fi-admin/${tid}/patients/p-1`),
      "patient_profile"
    );
    assert.equal(
      resolveStaffUatScreenKeyFromPath(`/fi-admin/${tid}/surgery-booking`),
      "surgery_booking_wizard"
    );
    assert.equal(resolveStaffUatScreenKeyFromPath(`/fi-admin/${tid}/crm`), null);
  });

  it("maps modules for navigation bounce telemetry", () => {
    assert.equal(staffUatModuleFromPath("/fi-admin/t/calendar"), "calendar");
    assert.equal(staffUatModuleFromPath("/fi-admin/t/reception-board"), "reception_board");
    assert.equal(staffUatModuleFromPath("/fi-admin/t/crm/leads"), "crm");
    assert.equal(staffUatModuleFromPath("/fi-admin/t/settings"), "other");
  });
});