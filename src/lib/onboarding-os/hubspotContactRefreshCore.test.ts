import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertContactRefreshFixedCutoff,
  assertPortalOwnership,
  assertRefreshMutationIsolation,
  computeContactRefreshChecksum,
  normalizeContactRefreshIds,
} from "./hubspotContactRefreshCore";

const CONTACT = {
  id: "229761370222",
  createdAt: "2026-07-16T04:15:52.321Z",
  updatedAt: "2026-07-16T11:33:03.155Z",
  archived: false,
  properties: { email: "review@example.org" },
};

describe("HubSpot fixed-cutoff contact refresh guards", () => {
  it("retains the fixed contact cutoff deterministically across retry", () => {
    const input = {
      tenantId: "tenant-1",
      integrationId: "integration-1",
      portalId: "123",
      cutoffTo: "2026-07-16T16:00:34.530Z",
      contacts: [CONTACT],
    };
    assert.equal(computeContactRefreshChecksum(input), computeContactRefreshChecksum(input));
    assert.notEqual(
      computeContactRefreshChecksum(input),
      computeContactRefreshChecksum({ ...input, cutoffTo: "2026-07-16T16:01:34.530Z" })
    );
  });

  it("fails closed when a live contact is at or beyond the approved cutoff", () => {
    assert.doesNotThrow(() =>
      assertContactRefreshFixedCutoff({
        cutoffTo: "2026-07-16T16:00:34.530Z",
        contacts: [CONTACT],
      })
    );
    assert.throws(
      () =>
        assertContactRefreshFixedCutoff({
          cutoffTo: CONTACT.updatedAt,
          contacts: [CONTACT],
        }),
      /fixed cutoff/
    );
  });

  it("rejects duplicate source contacts before staging", () => {
    assert.throws(
      () => normalizeContactRefreshIds(["229761370222", "229761370222"]),
      /duplicate source contact ID/
    );
  });

  it("fails closed on wrong-tenant portal ownership", () => {
    assert.doesNotThrow(() =>
      assertPortalOwnership({ configuredPortalId: "123", livePortalId: "123" })
    );
    assert.throws(
      () => assertPortalOwnership({ configuredPortalId: "123", livePortalId: "456" }),
      /portal does not match/
    );
  });

  it("keeps FI entities, mappings, and dataset watermarks isolated", () => {
    const stable = {
      leadsBefore: 10,
      leadsAfter: 10,
      patientsBefore: 4,
      patientsAfter: 4,
      staffBefore: 2,
      staffAfter: 2,
      usersBefore: 2,
      usersAfter: 2,
      mappingsBefore: 8,
      mappingsAfter: 8,
      notesWatermarkBefore: "2026-07-16T16:00:34.530Z",
      notesWatermarkAfter: "2026-07-16T16:00:34.530Z",
      contactWatermarkBefore: null,
      contactWatermarkAfter: null,
    };
    assert.doesNotThrow(() => assertRefreshMutationIsolation(stable));
    assert.throws(
      () => assertRefreshMutationIsolation({ ...stable, patientsAfter: 5 }),
      /PATIENT_GUARD/
    );
    assert.throws(
      () =>
        assertRefreshMutationIsolation({
          ...stable,
          notesWatermarkAfter: "2026-07-17T16:00:00.000Z",
        }),
      /notes watermark changed/
    );
  });
});
