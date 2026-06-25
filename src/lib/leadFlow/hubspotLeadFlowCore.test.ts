import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeHubSpotLeadFlowProviderEventId,
  flattenHubSpotLeadFlowWebhookBody,
  mapHubSpotStageToLeadStage,
  normalizeHubSpotContactToLead,
} from "@/src/lib/leadFlow/hubspotLeadFlowCore";

describe("hubspotLeadFlowCore", () => {
  it("maps HubSpot contact properties to fi_leads shape", () => {
    const normalized = normalizeHubSpotContactToLead({
      hubspot_contact_id: "501",
      properties: {
        firstname: "Jane",
        lastname: "Smith",
        email: "jane@example.com",
        phone: "+61 412 345 678",
        hs_object_id: "501",
        lifecyclestage: "lead",
        hs_analytics_source: "ORGANIC_SEARCH",
        procedure_interest: "FUE",
        country: "Australia",
        budget_range: "15000-20000",
      },
    });

    assert.ok(normalized);
    assert.equal(normalized!.hubspotContactId, "501");
    assert.equal(normalized!.firstName, "Jane");
    assert.equal(normalized!.email, "jane@example.com");
    assert.equal(normalized!.phone, "61412345678");
    assert.equal(normalized!.leadSource, "ORGANIC_SEARCH");
    assert.equal(normalized!.procedureInterest, "FUE");
    assert.equal(normalized!.currentStage, "new");
  });

  it("maps dealstage to consultation_booked", () => {
    assert.equal(mapHubSpotStageToLeadStage(null, "appointmentscheduled"), "consultation_booked");
    assert.equal(mapHubSpotStageToLeadStage("customer", null), "won");
  });

  it("flattens HubSpot batch webhook bodies", () => {
    const batch = flattenHubSpotLeadFlowWebhookBody({
      events: [{ eventId: "1", objectId: "501" }, { eventId: "2", objectId: "502" }],
    });
    assert.equal(batch.length, 2);
  });

  it("uses stable provider_event_id for identical payloads", () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const payload = { eventId: "evt-1", hubspot_contact_id: "501" };
    const a = computeHubSpotLeadFlowProviderEventId(tenantId, payload, "hubspot.contact.updated");
    const b = computeHubSpotLeadFlowProviderEventId(tenantId, payload, "hubspot.contact.updated");
    assert.equal(a, b);
  });
});
