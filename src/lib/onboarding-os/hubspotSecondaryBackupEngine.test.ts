import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HUBSPOT_SECONDARY_KINDS, probeHubspotSecondaryCapabilities, secondaryScopeFor } from "./hubspotSecondaryBackupEngine.server";

describe("HubSpot secondary backup", () => {
  it("defines the six requested read capabilities", () => {
    assert.deepEqual(HUBSPOT_SECONDARY_KINDS, ["companies", "tickets", "owners", "calls", "tasks", "meetings"]);
    assert.equal(secondaryScopeFor("companies"), "crm.objects.companies.read");
    assert.equal(secondaryScopeFor("owners"), "crm.objects.owners.read");
  });

  it("probes active and archived with GET-only transport", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = async (input) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    };
    try {
      const result = await probeHubspotSecondaryCapabilities("not-a-real-token");
      assert.equal(Object.values(result).every((item) => item.granted && item.archivedSupported), true);
      assert.equal(calls.length, 12);
    } finally { globalThis.fetch = originalFetch; }
  });

  it("records permission denial without retaining provider bodies", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("secret customer content", { status: 403 });
    try {
      const result = await probeHubspotSecondaryCapabilities("not-a-real-token");
      assert.equal(result.tickets.granted, false);
      assert.equal(result.tickets.status, 403);
      assert.equal(JSON.stringify(result).includes("customer content"), false);
    } finally { globalThis.fetch = originalFetch; }
  });
});
