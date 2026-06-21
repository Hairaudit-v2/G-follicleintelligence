import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildRosterCommandCentreHref,
  defaultRosterCommandCentreDateRange,
  parseRosterCommandCentreSearchParams,
  resolveRosterPreselectedEventKey,
  rosterDisplayStatusMatchesFilter,
} from "@/src/lib/workforce-os/workforceRosterQueryParams";

test("buildRosterCommandCentreHref includes event preselection query params", () => {
  const href = buildRosterCommandCentreHref({
    tenantId: "11111111-1111-4111-8111-111111111111",
    eventSource: "booking",
    eventId: "22222222-2222-4222-8222-222222222222",
    date: "2026-06-22T09:00:00.000Z",
    status: "missing_roles",
  });
  assert.match(href, /\/hr-os\/roster\?/);
  assert.match(href, /eventSource=booking/);
  assert.match(href, /eventId=22222222-2222-4222-8222-222222222222/);
  assert.match(href, /status=missing_roles/);
});

test("parseRosterCommandCentreSearchParams normalizes filters", () => {
  const parsed = parseRosterCommandCentreSearchParams({
    dateFrom: "2026-06-22",
    clinicId: "33333333-3333-4333-8333-333333333333",
    status: "warning",
    eventSource: "booking",
    eventId: "44444444-4444-4444-8444-444444444444",
  });
  assert.equal(parsed.dateFrom, "2026-06-22");
  assert.equal(parsed.status, "warning");
  assert.equal(parsed.eventSource, "booking");
});

test("resolveRosterPreselectedEventKey returns composite key", () => {
  const key = resolveRosterPreselectedEventKey({
    eventSource: "booking",
    eventId: "55555555-5555-4555-8555-555555555555",
  });
  assert.equal(key, "booking:55555555-5555-4555-8555-555555555555");
});

test("defaultRosterCommandCentreDateRange spans today plus seven days", () => {
  const now = new Date("2026-06-22T15:00:00.000Z");
  const range = defaultRosterCommandCentreDateRange(now);
  assert.equal(range.startsAt, "2026-06-22T00:00:00.000Z");
  assert.equal(range.endsAt, "2026-06-30T00:00:00.000Z");
});

test("rosterDisplayStatusMatchesFilter maps no_template to not_configured", () => {
  assert.equal(rosterDisplayStatusMatchesFilter("not_configured", "no_template"), true);
  assert.equal(rosterDisplayStatusMatchesFilter("ready", "missing_roles"), false);
});
