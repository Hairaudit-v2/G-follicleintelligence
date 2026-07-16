import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEMO_INTEREST_QUERY_MAP } from "../lib/marketing/hubspotMigrationPageContent";
import { PLATFORM_REVIEW_INTEREST_OPTIONS } from "../lib/marketing/platformReviewFormSchema";

describe("DEMO_INTEREST_QUERY_MAP", () => {
  it("maps hubspot-migration to a valid form interest option", () => {
    const mapped = DEMO_INTEREST_QUERY_MAP["hubspot-migration"];
    assert.equal(mapped, "Transition away from HubSpot");
    assert.ok((PLATFORM_REVIEW_INTEREST_OPTIONS as readonly string[]).includes(mapped));
  });

  it("maps connect-hubspot to Connect HubSpot to FI", () => {
    const mapped = DEMO_INTEREST_QUERY_MAP["connect-hubspot"];
    assert.equal(mapped, "Connect HubSpot to FI");
    assert.ok((PLATFORM_REVIEW_INTEREST_OPTIONS as readonly string[]).includes(mapped));
  });
});
