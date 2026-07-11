import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildFrontDeskLegacyRedirectPath,
  FRONT_DESK_REDIRECT_QUERY_WHITELIST,
} from "@/src/lib/fiOs/frontDesk/frontDeskRedirect";

const TID = "11111111-1111-1111-1111-111111111111";

test("redirects to today without query", () => {
  assert.equal(
    buildFrontDeskLegacyRedirectPath(TID, { kind: "today" }),
    `/fi-admin/${TID}/front-desk`
  );
});

test("redirects to tomorrow", () => {
  assert.equal(
    buildFrontDeskLegacyRedirectPath(TID, { kind: "tomorrow" }),
    `/fi-admin/${TID}/front-desk/tomorrow`
  );
});

test("preserves bookingId and date", () => {
  const sp = new URLSearchParams({
    bookingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    date: "2026-07-11",
    demo: "1",
    junk: "x",
  });
  const path = buildFrontDeskLegacyRedirectPath(TID, { kind: "today" }, sp);
  assert.ok(path.startsWith(`/fi-admin/${TID}/front-desk?`));
  assert.ok(path.includes("bookingId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
  assert.ok(path.includes("date=2026-07-11"));
  assert.ok(!path.includes("demo"));
  assert.ok(!path.includes("junk"));
});

test("whitelist is bookingId and date only", () => {
  assert.deepEqual([...FRONT_DESK_REDIRECT_QUERY_WHITELIST], ["bookingId", "date"]);
});

test("no redirect loop path (target is front-desk, not legacy)", () => {
  const path = buildFrontDeskLegacyRedirectPath(TID, { kind: "today" });
  assert.ok(!path.includes("/reception"));
  assert.ok(!path.includes("/operations"));
  assert.ok(path.includes("/front-desk"));
});
