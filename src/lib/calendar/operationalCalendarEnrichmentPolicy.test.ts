import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { operationalCalendarSkipsHeavyEnrichment } from "./operationalCalendarEnrichmentPolicy";

describe("operationalCalendarSkipsHeavyEnrichment", () => {
  it("skips heavy patient/profile enrichment for all views (operational feed path)", () => {
    assert.equal(operationalCalendarSkipsHeavyEnrichment("month"), true);
    assert.equal(operationalCalendarSkipsHeavyEnrichment("week"), true);
    assert.equal(operationalCalendarSkipsHeavyEnrichment("day"), true);
    assert.equal(operationalCalendarSkipsHeavyEnrichment("3day"), true);
  });
});