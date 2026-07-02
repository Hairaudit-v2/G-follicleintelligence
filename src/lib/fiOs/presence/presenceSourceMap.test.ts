import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getImplementedPresenceSources,
  getPresenceSourcesByStatus,
  isPresenceSourceExcluded,
  PRESENCE_SOURCE_MAP,
} from "@/src/lib/fiOs/presence/presenceSourceMap";

test("all current sources documented", () => {
  assert.ok(PRESENCE_SOURCE_MAP.length >= 10);
  for (const entry of PRESENCE_SOURCE_MAP) {
    assert.ok(entry.key.trim());
    assert.ok(entry.label.trim());
    assert.ok(entry.source.trim());
    assert.ok(entry.derives.length >= 0);
  }
});

test("future sources marked future", () => {
  const future = getPresenceSourcesByStatus("future");
  assert.ok(future.some((e) => e.key === "door_entry"));
  assert.ok(future.some((e) => e.key === "google_calendar"));
  for (const entry of future) {
    assert.equal(entry.status, "future");
  }
});

test("implemented and derived sources are active", () => {
  const active = getImplementedPresenceSources();
  assert.ok(active.some((e) => e.key === "patient_qr_arrival"));
  assert.ok(active.some((e) => e.key === "reception_check_in"));
  assert.ok(active.some((e) => e.key === "workspace_profile_session"));
  for (const entry of active) {
    assert.ok(entry.status === "implemented" || entry.status === "derived");
  }
});

test("protected sources not used directly", () => {
  const googleCal = PRESENCE_SOURCE_MAP.find((e) => e.key === "google_calendar");
  assert.equal(googleCal?.status, "future");
  assert.equal(googleCal?.derives.length, 0);
  assert.match(googleCal?.notes ?? "", /protected|excluded/i);
});

test("payroll/timesheet excluded", () => {
  assert.equal(isPresenceSourceExcluded("payroll_hours"), true);
  assert.equal(isPresenceSourceExcluded("roster_clock_in"), true);
  assert.equal(isPresenceSourceExcluded("staff_employment_source"), true);
  assert.equal(isPresenceSourceExcluded("patient_qr_arrival"), false);

  const excluded = getPresenceSourcesByStatus("excluded");
  assert.ok(excluded.some((e) => e.key === "payroll_hours"));
  assert.ok(excluded.some((e) => e.key === "roster_clock_in"));
  for (const entry of excluded) {
    assert.equal(entry.derives.length, 0);
  }
});
