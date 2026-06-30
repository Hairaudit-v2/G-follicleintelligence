import assert from "node:assert/strict";
import { test, afterEach } from "node:test";

import { buildSiteVerificationMetadata } from "./site-verification";

const ORIGINAL = {
  google: process.env.GOOGLE_SITE_VERIFICATION,
  bing: process.env.BING_SITE_VERIFICATION,
};

afterEach(() => {
  if (ORIGINAL.google === undefined) delete process.env.GOOGLE_SITE_VERIFICATION;
  else process.env.GOOGLE_SITE_VERIFICATION = ORIGINAL.google;
  if (ORIGINAL.bing === undefined) delete process.env.BING_SITE_VERIFICATION;
  else process.env.BING_SITE_VERIFICATION = ORIGINAL.bing;
});

test("buildSiteVerificationMetadata returns undefined when unset", () => {
  delete process.env.GOOGLE_SITE_VERIFICATION;
  delete process.env.BING_SITE_VERIFICATION;
  assert.equal(buildSiteVerificationMetadata(), undefined);
});

test("buildSiteVerificationMetadata maps Google and Bing tokens", () => {
  process.env.GOOGLE_SITE_VERIFICATION = "google-token";
  process.env.BING_SITE_VERIFICATION = "bing-token";
  assert.deepEqual(buildSiteVerificationMetadata(), {
    google: "google-token",
    other: { "msvalidate.01": "bing-token" },
  });
});
