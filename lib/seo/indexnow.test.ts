import assert from "node:assert/strict";
import { test, afterEach } from "node:test";

import {
  buildIndexNowPayload,
  getIndexNowKey,
  getIndexNowKeyFileName,
  isIndexNowKeyFileRequest,
} from "./indexnow";

const ORIGINAL_KEY = process.env.INDEXNOW_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.INDEXNOW_KEY;
  else process.env.INDEXNOW_KEY = ORIGINAL_KEY;
});

test("getIndexNowKey rejects invalid keys", () => {
  process.env.INDEXNOW_KEY = "short";
  assert.equal(getIndexNowKey(), null);
});

test("getIndexNowKey accepts valid keys", () => {
  process.env.INDEXNOW_KEY = "fi-indexnow-key-2026";
  assert.equal(getIndexNowKey(), "fi-indexnow-key-2026");
  assert.equal(getIndexNowKeyFileName(), "fi-indexnow-key-2026.txt");
  assert.equal(isIndexNowKeyFileRequest("fi-indexnow-key-2026.txt"), true);
  assert.equal(isIndexNowKeyFileRequest("other.txt"), false);
});

test("buildIndexNowPayload maps sitemap paths to absolute URLs", () => {
  process.env.INDEXNOW_KEY = "fi-indexnow-key-2026";
  const payload = buildIndexNowPayload(["/", "/platform"]);
  assert.ok(payload);
  assert.equal(payload.host, "www.follicleintelligence.ai");
  assert.equal(payload.keyLocation, "https://www.follicleintelligence.ai/fi-indexnow-key-2026.txt");
  assert.deepEqual(payload.urlList, [
    "https://www.follicleintelligence.ai",
    "https://www.follicleintelligence.ai/platform",
  ]);
});
