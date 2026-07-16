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

  it("does not reference culled or timestamp filenames in marketing sources", () => {
    const files = [
      "components/vision/VisionShowcaseSection.tsx",
      "components/marketing/FiOsHomeProductShowcase.tsx",
      "components/marketing/FiOsScreenshot.tsx",
      "lib/marketing/fiosScreenshots.ts",
      "components/home/FiMarketingHomeView.tsx",
      "components/platform/LeadFlowMarketingView.tsx",
      "components/clinic-owners/ClinicOwnersMarketingView.tsx",
      "components/platform/PlatformEnterpriseView.tsx",
    ];
    for (const rel of files) {
      const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
      assert.doesNotMatch(text, /Screenshot_16-7-2026/);
      assert.doesNotMatch(text, /os Images/);
      assert.doesNotMatch(text, /G:\\follicleintelligence/i);
      assert.doesNotMatch(text, /fios-system-diagnostics|fios-money|admin-key/i);
    }
  });
});
