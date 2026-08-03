import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getHomeV5HeroMetrics,
  getHomeV5PlatformSystemsSubtext,
  HOME_PAGE_CONTENT,
  HOME_V5_CONTENT,
} from "../lib/marketing/homePageContent";
import { getPlatformProgressSnapshot } from "../lib/marketing/platformProgressPageContent";

describe("HOME_V5_CONTENT (FI-WEB-REFRESH-1E)", () => {
  it("does not publish completion percentages in hero metrics", () => {
    for (const metric of getHomeV5HeroMetrics()) {
      assert.doesNotMatch(metric.value ?? "", /%/);
      assert.doesNotMatch(metric.label, /completion/i);
    }
  });

  it("aligns hero metrics with Platform Progress registry", () => {
    const snapshot = getPlatformProgressSnapshot();
    const metrics = getHomeV5HeroMetrics();
    assert.equal(metrics[0]?.value, String(snapshot.activeModuleCount));
    assert.match(metrics[0]?.label ?? "", /Platform Progress/i);
    assert.equal(metrics[1]?.value, String(snapshot.deployableSurfaceCount));
    assert.match(metrics[1]?.label ?? "", /Operational Pilot/i);
    assert.ok(metrics.some((m) => /Operational Pilot Underway/i.test(m.label)));
    assert.ok(metrics.some((m) => /Hair Restoration/i.test(m.label)));
  });

  it("keeps curated system cards and architecture layers as subsets of the full story", () => {
    assert.equal(HOME_V5_CONTENT.platformSystems.systems.length, 8);
    assert.equal(HOME_V5_CONTENT.ecosystemArchitecture.layerPreview.length, 12);
    const sub = getHomeV5PlatformSystemsSubtext();
    assert.match(sub, /8 core clinic systems/i);
    assert.match(sub, /23 systems/i);
    assert.match(sub, /Platform Progress/i);
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
