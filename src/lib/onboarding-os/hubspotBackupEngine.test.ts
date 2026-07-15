import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HubspotReadError, hubspotReadJson } from "./hubspotBackupEngine.server";

describe("HubSpot resumable backup transport", () => {
  it("uses GET bearer auth and returns only parsed JSON", async () => {
    let seenMethod = "";
    let seenAuth = "";
    const fakeFetch: typeof fetch = async (_input, init) => {
      seenMethod = String(init?.method);
      seenAuth = new Headers(init?.headers).get("authorization") ?? "";
      return new Response(JSON.stringify({ results: [{ id: "1" }] }), { status: 200 });
    };
    const result = await hubspotReadJson<{ results: { id: string }[] }>(
      "/crm/v3/objects/contacts",
      "not-a-real-token",
      { limit: "1" },
      fakeFetch
    );
    assert.equal(seenMethod, "GET");
    assert.equal(seenAuth, "Bearer not-a-real-token");
    assert.equal(result.results.length, 1);
  });

  it("honours Retry-After with bounded retries", async () => {
    let calls = 0;
    const fakeFetch: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) return new Response("sensitive provider body", { status: 429, headers: { "retry-after": "0" } });
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    };
    await hubspotReadJson("/crm/v3/objects/deals", "token", {}, fakeFetch);
    assert.equal(calls, 2);
  });

  it("does not retain provider response bodies in errors", async () => {
    const fakeFetch: typeof fetch = async () => new Response("customer data must not escape", { status: 403 });
    await assert.rejects(
      () => hubspotReadJson("/crm/v3/pipelines/deals", "token", {}, fakeFetch),
      (error: unknown) =>
        error instanceof HubspotReadError &&
        error.category === "permission" &&
        !error.message.includes("customer data")
    );
  });
});
