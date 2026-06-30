import assert from "node:assert/strict";
import test from "node:test";

import { assertSurgeryOsTenantRowScope } from "@/src/lib/surgeryOs/surgeryOsBoardModel";
import {
  graftSummarySchema,
  parseSurgeryOsCommandCentrePayload,
  surgeryOsCommandCentrePayloadSchema,
} from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";
import { emptySurgeryOsCommandCentrePayload } from "@/src/lib/surgeryOs/surgeryOsLoaderResilience";

const tenantId = "00000000-0000-4000-8000-000000000010";
const surgeryId = "00000000-0000-4000-8000-000000000020";

test("graftSummarySchema validates graft summary shape", () => {
  const parsed = graftSummarySchema.parse({
    surgeryId,
    patientLabel: "Test Patient",
    sessionId: null,
    phase: "extraction",
    phaseLabel: "Extraction",
    targetGrafts: 3000,
    extractedGrafts: 500,
    implantedGrafts: 0,
    discardedGrafts: 0,
    remainingGrafts: 500,
    singles: 100,
    doubles: 200,
    triples: 100,
    multiples: 100,
    totalHairs: 1000,
    averageHairsPerGraft: 2,
    progressPercent: 17,
    reconciliationStatus: "pending",
    reconciliationStatusLabel: "Pending",
    pendingTrayCount: 1,
    confirmedTrayGrafts: 50,
    reconciledAt: null,
    reconciledByLabel: null,
    sessionLocks: {
      extraction: {
        kind: "extraction",
        deviceId: null,
        heldAt: null,
        heldByFiUserId: null,
        heldByLabel: null,
        isHeldByDevice: false,
        isStale: true,
      },
      implantation: {
        kind: "implantation",
        deviceId: null,
        heldAt: null,
        heldByFiUserId: null,
        heldByLabel: null,
        isHeldByDevice: false,
        isStale: true,
      },
    },
    totals: {
      targetGrafts: 3000,
      extractedGrafts: 500,
      implantedGrafts: 0,
      discardedGrafts: 0,
      remainingGrafts: 500,
      totalHairs: 1000,
      averageHairsPerGraft: 2,
      composition: { singles: 100, doubles: 200, triples: 100, multiples: 100 },
    },
    hrefs: { patient: null, case: null, surgery: null },
  });
  assert.equal(parsed.extractedGrafts, 500);
});

test("command centre payload requires graftSummary array", () => {
  const base = emptySurgeryOsCommandCentrePayload({
    tenantId,
    tenantName: "Test Clinic",
    calendarTimezone: "Europe/London",
    todayYmd: "2026-06-19",
    localStartIso: "2026-06-19T00:00:00.000Z",
    localEndIso: "2026-06-19T23:59:59.999Z",
    role: "surgeon",
  });

  const payload = parseSurgeryOsCommandCentrePayload({
    ...base,
    graftSummary: [],
    graftEvents: [],
    vieCapture: [],
  });
  assert.ok(Array.isArray(payload.graftSummary));
  assert.ok(Array.isArray(payload.graftEvents));
  assert.ok(Array.isArray(payload.vieCapture));
  assert.equal(
    surgeryOsCommandCentrePayloadSchema.safeParse({ ...base, graftSummary: undefined }).success,
    false
  );
  assert.equal(
    surgeryOsCommandCentrePayloadSchema.safeParse({ ...base, graftEvents: undefined }).success,
    false
  );
  assert.equal(
    surgeryOsCommandCentrePayloadSchema.safeParse({ ...base, vieCapture: undefined }).success,
    false
  );
});

test("assertSurgeryOsTenantRowScope rejects cross-tenant rows", () => {
  assert.throws(() =>
    assertSurgeryOsTenantRowScope(
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "fi_surgery_graft_sessions"
    )
  );
});
