import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HOME_PAGE_CONTENT, HOME_V5_CONTENT } from "../lib/marketing/homePageContent";

describe("HOME_V5_CONTENT (FI-WEB-REFRESH-1E)", () => {
  it("does not publish completion percentages in hero metrics", () => {
    for (const metric of HOME_V5_CONTENT.hero.metrics) {
      assert.doesNotMatch(metric.value ?? "", /%/);
      assert.doesNotMatch(metric.label, /deployment/i);
    }
  });

  it("aligns curated system and layer counts", () => {
    assert.equal(HOME_V5_CONTENT.platformSystems.systems.length, 8);
    assert.equal(HOME_V5_CONTENT.ecosystemArchitecture.layerPreview.length, 12);
    assert.ok(HOME_V5_CONTENT.hero.metrics.some((m) => m.value === "8"));
    assert.ok(HOME_V5_CONTENT.hero.metrics.some((m) => m.value === "12"));
  });

  it("avoids world’s-first surgery superlative", () => {
    assert.doesNotMatch(HOME_V5_CONTENT.surgeryIntelligence.headline, /world'?s first/i);
  });

  it("routes conversion CTAs to the platform review page", () => {
    assert.equal(HOME_V5_CONTENT.hero.secondaryCta.href, "/demo");
    assert.equal(HOME_V5_CONTENT.progressiveAdoption.primaryCta.href, "/demo");
    assert.equal(HOME_V5_CONTENT.finalCta.secondaryCta.href, "/demo");
    assert.match(HOME_V5_CONTENT.finalCta.secondaryCta.label, /platform and migration review/i);
  });

  it("includes progressive adoption modes", () => {
    assert.deepEqual(
      HOME_V5_CONTENT.progressiveAdoption.modes.map((m) => m.title),
      ["Connect", "Coexist", "Transition", "Replace"]
    );
  });
});

describe("HOME_PAGE_CONTENT quarantine (FI-WEB-REFRESH-1E)", () => {
  it("does not retain absolute migration or completion-% claims in key legacy fields", () => {
    const principles = HOME_PAGE_CONTENT.worksWithExistingSoftware.principles.join(" ");
    assert.doesNotMatch(principles, /no forced migration/i);
    assert.doesNotMatch(principles, /no operational disruption/i);

    for (const metric of HOME_PAGE_CONTENT.engineeringCredibility.metrics) {
      assert.doesNotMatch(metric.value, /%/);
    }

    assert.doesNotMatch(
      HOME_PAGE_CONTENT.connectedIntelligenceEcosystem.subtext,
      /world'?s first/i
    );
    assert.doesNotMatch(
      HOME_PAGE_CONTENT.globalHealthcareInfrastructure.subtext,
      /world'?s first/i
    );
  });
});
