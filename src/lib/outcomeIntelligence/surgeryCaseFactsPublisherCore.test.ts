import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  mapSurgeryCaseIntelligenceFacts,
  SURGERY_CASE_INTELLIGENCE_FACTS_VERSION,
  type SurgeryCaseFactsInput,
} from "./surgeryCaseFactsCore";
import {
  buildSurgeryCaseIntelligenceFactsEventMetadata,
  buildSurgeryCaseIntelligenceFactsIdempotencyKey,
  compareFactsVersions,
  decideSurgeryCaseIntelligencePublishAction,
  resolveSurgeryCaseIntelligenceEventValue,
  resolveSurgeryCaseIntelligencePublishEntityId,
  SurgeryCaseFactsPublishValidationError,
  validateSurgeryCaseIntelligenceFactsForPublish,
} from "./surgeryCaseFactsPublisherCore";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PATIENT = "33333333-3333-4333-8333-333333333333";
const CASE = "22222222-2222-4222-8222-222222222222";
const SURGERY = "44444444-4444-4444-8444-444444444444";
const BOOKING = "55555555-5555-4555-8555-555555555555";
const LINK = "66666666-6666-4666-8666-666666666666";
const IMAGE = "77777777-7777-4777-8777-777777777777";
const ESTIMATE = "88888888-8888-4888-8888-888888888888";
const REVIEWED_AT = "2026-07-04T12:05:00.000Z";

function baseInput(overrides: Partial<SurgeryCaseFactsInput> = {}): SurgeryCaseFactsInput {
  return {
    tenantId: TENANT,
    patientId: PATIENT,
    caseId: CASE,
    surgeryId: SURGERY,
    bookingId: BOOKING,
    procedureDate: "2026-07-04",
    surgeonFiUserId: "staff-surgeon",
    teamFiUserIds: ["staff-1"],
    surgeryStatus: "in_progress",
    procedurePhase: "extraction",
    liveStatus: "active",
    graftSessionId: "99999999-9999-4999-8999-999999999999",
    targetGrafts: 3000,
    extractedGrafts: 1200,
    implantedGrafts: 0,
    discardedGrafts: 0,
    remainingGrafts: 1200,
    reconciliationStatus: "pending",
    graftSessionPhase: "extraction",
    reconciledAt: null,
    confirmedTrayGrafts: 120,
    trayImageLinks: [],
    graftTrayIntelligence: null,
    ...overrides,
  };
}

function reviewedFacts() {
  const facts = mapSurgeryCaseIntelligenceFacts(
    baseInput({
      trayImageLinks: [
        {
          linkId: LINK,
          imageId: IMAGE,
          intelligenceSummary: {
            estimateId: ESTIMATE,
            graftTrayLinkId: LINK,
            hasFinalCount: true,
            finalAcceptedCount: 120,
            originalAiEstimate: 120,
            manualCount: 118,
            mismatchBand: "within_tolerance",
            confidenceBand: "high",
            imageQuality: "suitable",
            reviewerId: "staff-1",
            reviewerLabel: "Reviewer One",
            reviewedAt: REVIEWED_AT,
            finalCountSource: "ai",
            supersededStaleJob: false,
            reviewStatus: "accepted_ai",
          },
        },
      ],
      graftTrayIntelligence: {
        reviewedTrayCount: 1,
        pendingReviewCount: 0,
        supersededStaleCount: 0,
        totalFinalAcceptedGrafts: 120,
        hasSupersededStaleEstimate: false,
      },
    })
  );
  assert.ok(facts);
  return facts;
}

function pendingFacts() {
  const facts = mapSurgeryCaseIntelligenceFacts(
    baseInput({
      trayImageLinks: [
        {
          linkId: LINK,
          imageId: IMAGE,
          intelligenceSummary: {
            estimateId: ESTIMATE,
            graftTrayLinkId: LINK,
            hasFinalCount: false,
            finalAcceptedCount: null,
            originalAiEstimate: 120,
            manualCount: 118,
            mismatchBand: "within_tolerance",
            confidenceBand: "high",
            imageQuality: "suitable",
            reviewerId: null,
            reviewerLabel: null,
            reviewedAt: null,
            finalCountSource: null,
            supersededStaleJob: false,
            reviewStatus: "pending_review",
          },
        },
      ],
      graftTrayIntelligence: {
        reviewedTrayCount: 0,
        pendingReviewCount: 1,
        supersededStaleCount: 0,
        totalFinalAcceptedGrafts: null,
        hasSupersededStaleEstimate: false,
      },
    })
  );
  assert.ok(facts);
  return facts;
}

describe("surgeryCaseFactsPublisherCore", () => {
  it("reviewed case validates and exposes final graft count metadata", () => {
    const facts = reviewedFacts();
    const validated = validateSurgeryCaseIntelligenceFactsForPublish(facts);
    assert.equal(validated.final_reviewed_graft_count, 120);
    assert.equal(validated.has_final_graft_count, true);
    assert.equal(resolveSurgeryCaseIntelligenceEventValue(validated), 120);

    const metadata = buildSurgeryCaseIntelligenceFactsEventMetadata({
      facts: validated,
      lastPublishedAt: REVIEWED_AT,
      payloadJson: validated,
    });
    assert.equal(metadata.source, "surgery_case_intelligence");
    assert.equal(metadata.facts_version, SURGERY_CASE_INTELLIGENCE_FACTS_VERSION);
    assert.equal(metadata.last_published_at, REVIEWED_AT);
    assert.equal(metadata.case_id, CASE);
    assert.equal(metadata.surgery_id, SURGERY);
    assert.equal(metadata.patient_id, PATIENT);
    assert.equal(metadata.has_final_graft_count, true);
    assert.equal(metadata.final_reviewed_graft_count, 120);
    assert.deepEqual(metadata.payload_json, validated);
  });

  it("pending case does not publish final graft count", () => {
    const facts = pendingFacts();
    const validated = validateSurgeryCaseIntelligenceFactsForPublish(facts);
    assert.equal(validated.final_reviewed_graft_count, null);
    assert.equal(validated.has_final_graft_count, false);
    assert.equal(resolveSurgeryCaseIntelligenceEventValue(validated), null);
  });

  it("rejects invalid payload before write", () => {
    const facts = reviewedFacts();
    const invalid = { ...facts, facts_version: "bad_version" };
    assert.throws(
      () => validateSurgeryCaseIntelligenceFactsForPublish(invalid),
      SurgeryCaseFactsPublishValidationError
    );

    const inconsistent = { ...facts, has_final_graft_count: false, final_reviewed_graft_count: 120 };
    assert.throws(
      () => validateSurgeryCaseIntelligenceFactsForPublish(inconsistent),
      /final_reviewed_graft_count must be null/
    );
  });

  it("idempotency key uses tenant + case + facts_version", () => {
    const facts = reviewedFacts();
    const { entityId } = resolveSurgeryCaseIntelligencePublishEntityId(facts);
    assert.equal(entityId, CASE);
    assert.equal(
      buildSurgeryCaseIntelligenceFactsIdempotencyKey({
        tenantId: TENANT,
        entityId,
        factsVersion: SURGERY_CASE_INTELLIGENCE_FACTS_VERSION,
      }),
      `${TENANT}:${CASE}:${SURGERY_CASE_INTELLIGENCE_FACTS_VERSION}`
    );
  });

  it("publish decision updates same facts_version and skips older against newer", () => {
    const existing = [{ id: "event-1", factsVersion: SURGERY_CASE_INTELLIGENCE_FACTS_VERSION }];
    assert.deepEqual(
      decideSurgeryCaseIntelligencePublishAction({
        incomingVersion: SURGERY_CASE_INTELLIGENCE_FACTS_VERSION,
        existingRows: existing,
      }),
      { action: "update", existingEventId: "event-1" }
    );

    assert.deepEqual(
      decideSurgeryCaseIntelligencePublishAction({
        incomingVersion: SURGERY_CASE_INTELLIGENCE_FACTS_VERSION,
        existingRows: [{ id: "event-2", factsVersion: "surgery_case_intelligence_facts_v2" }],
      }),
      {
        action: "skip",
        reason: "A newer facts_version (surgery_case_intelligence_facts_v2) is already published.",
      }
    );

    assert.equal(
      compareFactsVersions("surgery_case_intelligence_facts_v1", "surgery_case_intelligence_facts_v2"),
      -1
    );
    assert.deepEqual(
      decideSurgeryCaseIntelligencePublishAction({
        incomingVersion: "surgery_case_intelligence_facts_v2",
        existingRows: existing,
      }),
      { action: "insert" }
    );
  });

  it("read-only SurgeryOS loader does not import publisher", () => {
    const loaderPath = join(
      process.cwd(),
      "src/lib/surgeryOs/surgeryOsCommandCentreLoader.server.ts"
    );
    const source = readFileSync(loaderPath, "utf8");
    assert.equal(source.includes("surgeryCaseFactsPublisher"), false);
    assert.equal(source.includes("publishSurgeryCaseIntelligenceFacts"), false);
    assert.equal(source.includes("tryPublishSurgeryCaseIntelligenceFactsForSurgery"), false);
  });
});