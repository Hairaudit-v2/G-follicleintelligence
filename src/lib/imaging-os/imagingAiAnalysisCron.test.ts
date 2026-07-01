import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NextRequest } from "next/server";

import { assertCronAuthorized } from "@/src/lib/server/cronAuth";

const SECRET = "0123456789abcdef";

describe("fi-imaging-ai-analysis cron auth", () => {
  it("rejects unauthenticated requests", () => {
    const res = assertCronAuthorized(
      new NextRequest("https://x.test/api/cron/fi-imaging-ai-analysis", { method: "GET" }),
      [SECRET]
    );
    assert.ok(res);
    assert.equal(res!.status, 401);
  });

  it("accepts bearer secret", () => {
    const res = assertCronAuthorized(
      new NextRequest("https://x.test/api/cron/fi-imaging-ai-analysis", {
        method: "GET",
        headers: { authorization: `Bearer ${SECRET}` },
      }),
      [SECRET],
      { alternateTimingSafeHeaderName: "x-fi-imaging-ai-analysis-secret" }
    );
    assert.equal(res, null);
  });
});