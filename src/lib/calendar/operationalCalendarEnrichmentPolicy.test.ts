import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { operationalCalendarSkipsHeavyEnrichment } from "./operationalCalendarEnrichmentPolicy";

describe("operationalCalendarSkipsHeavyEnrichment", () => {
  it("skips clinical + resource-assignment enrichment only for month view", () => {
    assert.equal(operationalCalendarSkipsHeavyEnrichment("month"), true);
    assert.equal(operationalCalendarSkipsHeavyEnrichment("week"), false);
    assert.equal(operationalCalendarSkipsHeavyEnrichment("day"), false);
    assert.equal(operationalCalendarSkipsHeavyEnrichment("3day"), false);
  });
});
