import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allowedRecruitmentStageTargets,
  assertRecruitmentStageTransition,
  countCandidatesByStage,
  defaultOfferStatusForStage,
  resolveCandidateOnboardingTemplate,
} from "@/src/lib/workforce/recruitmentPipelineCore";

describe("recruitmentPipelineCore", () => {
  it("defaultOfferStatusForStage promotes draft on offer stage", () => {
    assert.equal(defaultOfferStatusForStage("offer", "none"), "draft");
    assert.equal(defaultOfferStatusForStage("hired", "extended"), "accepted");
    assert.equal(defaultOfferStatusForStage("withdrawn", "extended"), "declined");
    assert.equal(defaultOfferStatusForStage("interview", "none"), "none");
  });

  it("assertRecruitmentStageTransition blocks terminal moves", () => {
    assert.throws(
      () => assertRecruitmentStageTransition("hired", "applied"),
      /terminal stage/
    );
    assert.throws(
      () => assertRecruitmentStageTransition("applied", "hired"),
      /offer or reference check/
    );
    assert.doesNotThrow(() => assertRecruitmentStageTransition("offer", "hired"));
  });

  it("resolveCandidateOnboardingTemplate prefers candidate override", () => {
    assert.equal(
      resolveCandidateOnboardingTemplate({
        candidateTemplateCode: "surgical_hair_restoration",
        roleTemplateCode: "standard_hair_restoration",
      }),
      "surgical_hair_restoration"
    );
    assert.equal(
      resolveCandidateOnboardingTemplate({
        candidateTemplateCode: null,
        roleTemplateCode: "standard_hair_restoration",
      }),
      "standard_hair_restoration"
    );
  });

  it("allowedRecruitmentStageTargets blocks terminal and invalid hired jumps", () => {
    assert.deepEqual(allowedRecruitmentStageTargets("hired"), []);
    assert.ok(!allowedRecruitmentStageTargets("applied").includes("hired"));
    assert.ok(allowedRecruitmentStageTargets("offer").includes("hired"));
    assert.ok(allowedRecruitmentStageTargets("applied").includes("withdrawn"));
  });

  it("countCandidatesByStage ignores archived rows", () => {
    const counts = countCandidatesByStage([
      { pipelineStage: "applied", archivedAt: null },
      { pipelineStage: "applied", archivedAt: null },
      { pipelineStage: "interview", archivedAt: "2026-01-01T00:00:00.000Z" },
      { pipelineStage: "offer", archivedAt: null },
    ]);
    assert.equal(counts.applied, 2);
    assert.equal(counts.interview, 0);
    assert.equal(counts.offer, 1);
  });
});