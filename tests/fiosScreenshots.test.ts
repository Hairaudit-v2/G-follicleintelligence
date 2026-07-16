import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  FIOS_CLINIC_OWNERS,
  FIOS_DEMO_DATA_NOTE,
  FIOS_HOME_FEATURED,
  FIOS_HOME_SUPPORTING,
  FIOS_LEADFLOW,
  FIOS_PLATFORM,
  FIOS_SCREENSHOTS,
  FIOS_VISION_SHOWCASE,
  getFiOsScreenshot,
} from "../lib/marketing/fiosScreenshots";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("FI OS marketing screenshots (FI-WEB-REFRESH-1I)", () => {
  it("publishes only canonical kebab-case webp assets", () => {
    for (const asset of Object.values(FIOS_SCREENSHOTS)) {
      assert.match(asset.src, /^\/os-images\/fios-[a-z0-9-]+\.webp$/);
      assert.doesNotMatch(asset.src, /Screenshot_|os Images|G:\\|G:\//i);
      assert.ok(asset.width > 0 && asset.height > 0);
      assert.ok(asset.alt.length > 20);
      assert.doesNotMatch(asset.alt, /^Screenshot of/i);
      assert.doesNotMatch(asset.alt, /\.webp$/i);
    }
  });

  it("keeps asset files on disk", () => {
    for (const asset of Object.values(FIOS_SCREENSHOTS)) {
      const filePath = path.join(ROOT, "public", asset.src.replace(/^\//, ""));
      assert.ok(fs.existsSync(filePath), `missing ${asset.src}`);
      const size = fs.statSync(filePath).size;
      assert.ok(size > 10_000, `${asset.src} unexpectedly tiny`);
      assert.ok(size < 1_500_000, `${asset.src} unexpectedly large`);
    }
  });

  it("limits vision and home galleries to curated sets", () => {
    assert.equal(FIOS_VISION_SHOWCASE.length, 6);
    assert.ok(FIOS_HOME_SUPPORTING.length <= 5);
    assert.ok(FIOS_HOME_FEATURED);
    assert.equal(FIOS_LEADFLOW.length, 1);
    assert.ok(FIOS_CLINIC_OWNERS.length >= 2 && FIOS_CLINIC_OWNERS.length <= 4);
    assert.ok(FIOS_PLATFORM.length >= 3 && FIOS_PLATFORM.length <= 6);
    assert.ok(FIOS_DEMO_DATA_NOTE.toLowerCase().includes("demonstration"));
  });

  it("exposes getFiOsScreenshot for known ids", () => {
    const today = getFiOsScreenshot("today");
    assert.equal(today.id, "today");
    assert.match(today.src, /fios-today-command-centre/);
  });

  it("declares full-resolution faithful dimensions", () => {
    for (const asset of Object.values(FIOS_SCREENSHOTS)) {
      assert.equal(asset.width, 3314);
      assert.equal(asset.height, 1230);
    }
  });

  it("manifest records content alterations as None", () => {
    const manifestPath = path.join(ROOT, "public/os-images/manifest.json");
    assert.ok(fs.existsSync(manifestPath));
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.crop, "None");
    assert.ok(Array.isArray(manifest.results));
    for (const row of manifest.results) {
      assert.equal(row.contentAlterations, "None");
      assert.equal(row.crop, "None");
    }
  });
});
