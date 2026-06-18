import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildHubspotDealTimelineTitle,
  computeBalanceAmount,
  formatRevenueDisplayAmount,
  mapHubspotDealStage,
  parseHubspotCloseDate,
  parseHubspotDealAmount,
} from "./hubspotDealStageMap";

describe("mapHubspotDealStage", () => {
  it("accepts canonical slugs", () => {
    const r = mapHubspotDealStage("quote_sent");
    assert.equal(r.stage, "quote_sent");
    assert.equal(r.probability_score, 45);
    assert.equal(r.unmapped, false);
  });

  it("maps HubSpot label strings", () => {
    assert.equal(mapHubspotDealStage("Appointment Scheduled").stage, "appointment_scheduled");
    assert.equal(mapHubspotDealStage("Consult Completed").stage, "consult_completed");
    assert.equal(mapHubspotDealStage("Quote Sent").stage, "quote_sent");
    assert.equal(mapHubspotDealStage("Deposit Pending").stage, "deposit_pending");
    assert.equal(mapHubspotDealStage("Deposit Paid").stage, "deposit_paid");
    assert.equal(mapHubspotDealStage("Surgery Booked").stage, "surgery_booked");
    assert.equal(mapHubspotDealStage("Closed Won").stage, "won");
    assert.equal(mapHubspotDealStage("Closed Lost").stage, "lost");
  });

  it("returns unmapped for unknown stages", () => {
    const r = mapHubspotDealStage("mystery pipeline");
    assert.equal(r.stage, null);
    assert.equal(r.unmapped, true);
  });
});

describe("parseHubspotDealAmount", () => {
  it("parses numeric and formatted strings", () => {
    assert.equal(parseHubspotDealAmount(11000), 11000);
    assert.equal(parseHubspotDealAmount("$11,000"), 11000);
    assert.equal(parseHubspotDealAmount("11000 AUD"), 11000);
  });
});

describe("buildHubspotDealTimelineTitle", () => {
  it("formats quote_sent with amount", () => {
    const title = buildHubspotDealTimelineTitle("quote_sent", 11000);
    assert.equal(title, `Treatment quote updated — ${formatRevenueDisplayAmount(11000)}`);
  });
});

describe("computeBalanceAmount", () => {
  it("subtracts deposit from expected revenue", () => {
    assert.equal(computeBalanceAmount(11000, 2000), 9000);
    assert.equal(computeBalanceAmount(11000, null), 11000);
  });
});

describe("parseHubspotCloseDate", () => {
  it("normalizes close dates to YYYY-MM-DD", () => {
    assert.equal(parseHubspotCloseDate("2026-09-15"), "2026-09-15");
    assert.equal(parseHubspotCloseDate("2026-09-15T10:00:00Z"), "2026-09-15");
  });
});
