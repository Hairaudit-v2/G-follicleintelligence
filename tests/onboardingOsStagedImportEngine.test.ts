import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildHubspotContactImportPreview,
  buildHubspotDealImportPreview,
  mapHubspotContactToFiLead,
  mapHubspotDealToFiOpportunity,
} from "../src/lib/onboarding-os/importPreviewEngine";
import {
  runDuplicateDetection,
  type DuplicateCheckCandidateIndex,
} from "../src/lib/onboarding-os/duplicateDetectionEngine";
import type { HubspotStagingContact, HubspotStagingDeal } from "../src/lib/onboarding-os/hubspotConnectorTypes";

const baseContact: HubspotStagingContact = {
  id: "staging-contact-1",
  integrationId: "int-1",
  tenantId: "tenant-1",
  syncRunId: null,
  hubspotContactId: "501",
  email: "jane@example.com",
  phone: "+44 7700 900123",
  leadSource: "NEW",
  duplicateRisk: false,
  normalizedLeadType: "hair_transplant",
  rawPayload: {
    id: "501",
    properties: {
      firstname: "Jane",
      lastname: "Smith",
      email: "jane@example.com",
      phone: "+44 7700 900123",
      lifecyclestage: "lead",
      stage_of_journey: "Consult scheduled",
    },
  },
  importStatus: "approved",
  importedAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const baseDeal: HubspotStagingDeal = {
  id: "staging-deal-1",
  integrationId: "int-1",
  tenantId: "tenant-1",
  syncRunId: null,
  hubspotDealId: "9001",
  hubspotContactId: "501",
  email: "jane@example.com",
  phone: null,
  leadSource: "ORGANIC_SEARCH",
  pipelineName: "Sales Pipeline",
  dealStage: "appointmentscheduled",
  duplicateRisk: false,
  normalizedLeadType: "hair_transplant",
  rawPayload: {
    id: "9001",
    properties: {
      dealname: "FUE Hair Transplant — Jane Smith",
      dealstage: "appointmentscheduled",
    },
  },
  importStatus: "approved",
  importedAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const emptyIndex: DuplicateCheckCandidateIndex = {
  persons: [],
  leads: [],
  patients: [],
  cases: [],
  externalMappings: [],
};

describe("OnboardingOS Phase F5 — import preview engine", () => {
  it("buildHubspotContactImportPreview maps contact to FI lead preview", () => {
    const preview = buildHubspotContactImportPreview(baseContact);
    assert.equal(preview.externalContactId, "501");
    assert.equal(preview.email, "jane@example.com");
    assert.equal(preview.mappedPipelineSlug, "consult_scheduled");
    assert.equal(preview.classification, "lead_only");
    assert.equal(preview.createPatient, false);
  });

  it("buildHubspotDealImportPreview maps deal to opportunity preview", () => {
    const preview = buildHubspotDealImportPreview(baseDeal);
    assert.equal(preview.externalDealId, "9001");
    assert.equal(preview.dealName, "FUE Hair Transplant — Jane Smith");
    assert.equal(preview.linkToContactId, "501");
  });

  it("mapHubspotContactToFiLead returns proposed action", () => {
    const mapped = mapHubspotContactToFiLead(baseContact);
    assert.equal(mapped.proposedFiAction, "create_person_and_lead");
    assert.equal(mapped.preview.summary, "Jane Smith");
  });

  it("mapHubspotDealToFiOpportunity returns link action when contact present", () => {
    const mapped = mapHubspotDealToFiOpportunity(baseDeal);
    assert.equal(mapped.proposedFiAction, "link_opportunity_to_contact");
  });
});

describe("OnboardingOS Phase F5 — duplicate detection", () => {
  it("exact email match returns high confidence", () => {
    const index: DuplicateCheckCandidateIndex = {
      ...emptyIndex,
      persons: [
        {
          id: "person-1",
          emailNormalized: "jane@example.com",
          phoneDigits: null,
          displayNameNormalized: "jane smith",
        },
      ],
    };
    const result = runDuplicateDetection(
      { email: "jane@example.com", displayName: "Jane Smith", externalId: "501", externalEntityType: "contact" },
      index
    );
    assert.ok(result.confidenceScore >= 95);
    assert.equal(result.hasBlockingMatch, true);
    assert.ok(result.matches.some((m) => m.rule === "exact_email"));
  });

  it("external mapping is blocking at 100%", () => {
    const index: DuplicateCheckCandidateIndex = {
      ...emptyIndex,
      externalMappings: [
        {
          externalId: "501",
          sourceEntityType: "contact",
          fiEntityType: "person",
          fiEntityId: "person-1",
        },
      ],
    };
    const result = runDuplicateDetection(
      { externalId: "501", externalEntityType: "contact" },
      index
    );
    assert.equal(result.confidenceScore, 100);
    assert.equal(result.hasBlockingMatch, true);
  });

  it("fuzzy name match returns moderate confidence", () => {
    const index: DuplicateCheckCandidateIndex = {
      ...emptyIndex,
      persons: [
        {
          id: "person-2",
          emailNormalized: null,
          phoneDigits: null,
          displayNameNormalized: "jane smith",
        },
      ],
    };
    const result = runDuplicateDetection({ displayName: "Jane Smith" }, index);
    assert.ok(result.confidenceScore >= 55);
    assert.ok(result.matches.some((m) => m.rule === "fuzzy_name"));
  });

  it("no matches returns zero confidence", () => {
    const result = runDuplicateDetection({ email: "new@example.com" }, emptyIndex);
    assert.equal(result.confidenceScore, 0);
    assert.equal(result.hasBlockingMatch, false);
  });
});
