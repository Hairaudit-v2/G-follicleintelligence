import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getSitemapPaths,
  NAV_FOOTER_PATHS_REQUIRED_IN_SITEMAP,
  PUBLIC_SITEMAP_PAGES,
} from "./sitemap-pages";

test("sitemap includes every nav/footer marketing path", () => {
  const paths = new Set(getSitemapPaths());
  for (const required of NAV_FOOTER_PATHS_REQUIRED_IN_SITEMAP) {
    assert.ok(paths.has(required), `missing sitemap entry for ${required}`);
  }
});

test("sitemap paths are unique", () => {
  const paths = getSitemapPaths();
  assert.equal(paths.length, new Set(paths).size);
});

test("sitemap has expanded public coverage", () => {
  assert.ok(PUBLIC_SITEMAP_PAGES.length >= 38);
});