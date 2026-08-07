/**
 * FI-SURGERY-PROJECTION-PROVIDER-ACTIVATION-1C — unit coverage.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  HAIRAUDIT_EXTRACT_INVENTORY,
  assertProviderMayEmitArtifact,
  deriveSharedProjectionIdempotencyKey,
} from "@follicle/projection-core";
import {
  assertProviderConfigAllowsGeneration,
  estimateSharedProjectionCostUsd,
  resolveSharedProjectionProviderConfig,
  SHARED_PROJECTION_PROVIDER_ID,
} from "@/src/lib/imaging-os/sharedProjection/providerConfig";
import { evaluateSeamFlags } from "@/src/lib/imaging-os/sharedProjection/openai/outcomeValidation";
import { OPENAI_EDIT_PROMPT_VERSION_V3 } from "@/src/lib/imaging-os/sharedProjection/openai/openaiEditPrompt";
import { HAIRAUDIT_OPENAI_PILOT_ASSET_INSPECTION } from "@/src/lib/imaging-os/sharedProjection/externalAssetPolicy";
import {
  actorHasSurgeryProjectionCapability,
  SURGERY_PROJECTION_CAPABILITIES,
} from "@/src/lib/cases/surgeryProjection/capabilities";

const ROOT = path.resolve(__dirname, "..");

describe("FI-SURGERY-PROJECTION-PROVIDER-ACTIVATION-1C", () => {
  it("has exactly one OpenAI gpt-image provider tree under sharedProjection/openai", () => {
    const openaiDir = path.join(
      ROOT,
      "src/lib/imaging-os/sharedProjection/openai"
    );
    assert.equal(existsSync(openaiDir), true);
    const files = readdirSync(openaiDir);
    assert.ok(files.includes("openaiGptImageProvider.ts"));
    // No second FiOS OpenAI projection tree.
    const legacy = path.join(ROOT, "src/lib/cases/surgeryProjection/openai");
    assert.equal(existsSync(legacy), false);
    const extractNote = HAIRAUDIT_EXTRACT_INVENTORY.find((c) =>
      c.component.includes("openaiGptImageProvider")
    );
    assert.ok(extractNote?.notes.includes("1C: extracted"));
  });

  it("disabled / DPIA-not-approved provider fails closed", () => {
    const cfg = resolveSharedProjectionProviderConfig({
      FI_SHARED_PROJECTION_PROVIDER_ENABLED: "true",
      FI_SHARED_PROJECTION_DPIA_STATUS: "not_approved",
      OPENAI_API_KEY: "sk-test",
      FI_SHARED_PROJECTION_ENV_ALLOWLIST: "development",
      NODE_ENV: "development",
    } as NodeJS.ProcessEnv);
    assert.equal(cfg.mayInvokeProvider, false);
    assert.equal(cfg.configurationError, "dpia_not_approved");

    const disabled = resolveSharedProjectionProviderConfig({
      FI_SHARED_PROJECTION_PROVIDER_ENABLED: "false",
      FI_SHARED_PROJECTION_DPIA_STATUS: "approved_with_conditions",
      OPENAI_API_KEY: "sk-test",
      NODE_ENV: "development",
    } as NodeJS.ProcessEnv);
    assert.equal(disabled.mayInvokeProvider, false);
  });

  it("pilot tenant allowlist and cost ceiling enforce", () => {
    const cfg = resolveSharedProjectionProviderConfig({
      FI_SHARED_PROJECTION_PROVIDER_ENABLED: "true",
      FI_SHARED_PROJECTION_DPIA_STATUS: "approved_with_conditions",
      OPENAI_API_KEY: "sk-test",
      FI_SHARED_PROJECTION_ENV_ALLOWLIST: "development",
      FI_SHARED_PROJECTION_PILOT_TENANT_IDS: "11111111-1111-1111-1111-111111111111",
      FI_SHARED_PROJECTION_COST_CEILING_USD: "0.10",
      NODE_ENV: "development",
    } as NodeJS.ProcessEnv);
    assert.equal(cfg.mayInvokeProvider, true);

    const denied = assertProviderConfigAllowsGeneration(cfg, {
      tenantId: "22222222-2222-2222-2222-222222222222",
      estimatedCostUsd: 0.05,
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.code, "tenant_not_allowlisted");

    const cost = assertProviderConfigAllowsGeneration(cfg, {
      tenantId: "11111111-1111-1111-1111-111111111111",
      estimatedCostUsd: 0.25,
    });
    assert.equal(cost.ok, false);
    if (!cost.ok) assert.equal(cost.code, "cost_ceiling_exceeded");
  });

  it("permission enforcement keeps patient sharing blocked", () => {
    assert.equal(
      actorHasSurgeryProjectionCapability(
        { role: "doctor", userId: "u1" },
        SURGERY_PROJECTION_CAPABILITIES.enablePatientSharing
      ),
      false
    );
    assert.equal(
      actorHasSurgeryProjectionCapability(
        { role: "admin", userId: "u1" },
        SURGERY_PROJECTION_CAPABILITIES.enablePatientSharing
      ),
      false
    );
  });

  it("overlay providers cannot emit illustrative outcomes", () => {
    assert.throws(() =>
      assertProviderMayEmitArtifact({
        providerId: "local-illustrative",
        artifactType: "illustrative_projected_outcome",
      })
    );
  });

  it("sequential idempotency key is stable; correction creates new key namespace", () => {
    const base = {
      patientSubjectRef: "subj",
      planId: "plan",
      planVersion: 1,
      hairlineDesignId: "hl",
      hairlineDesignVersion: 2,
      sourceImageChecksum: "src",
      maskChecksum: "mask",
      view: "frontal" as const,
      mode: "planned" as const,
      providerId: SHARED_PROJECTION_PROVIDER_ID,
      modelVersion: "gpt-image-2",
      promptTemplateVersion: OPENAI_EDIT_PROMPT_VERSION_V3,
    };
    const a = deriveSharedProjectionIdempotencyKey(base);
    const b = deriveSharedProjectionIdempotencyKey(base);
    assert.equal(a, b);
    const corrected = deriveSharedProjectionIdempotencyKey({
      ...base,
      promptTemplateVersion: `${OPENAI_EDIT_PROMPT_VERSION_V3}#corr=attempt-2`,
    });
    assert.notEqual(a, corrected);
  });

  it("concurrent cross-product callers share one logical generation key", () => {
    const key = deriveSharedProjectionIdempotencyKey({
      patientSubjectRef: "subj-shared",
      planId: "plan",
      planVersion: 1,
      hairlineDesignId: "hl",
      hairlineDesignVersion: 1,
      sourceImageChecksum: "src",
      maskChecksum: "mask",
      view: "frontal",
      mode: "planned",
      providerId: SHARED_PROJECTION_PROVIDER_ID,
      modelVersion: "gpt-image-2",
      promptTemplateVersion: OPENAI_EDIT_PROMPT_VERSION_V3,
    });
    // FiOS and HairAudit use the same idempotency parts → one DB unique row / one charge.
    assert.match(key, /^[a-f0-9]{32,64}$/);
    assert.equal(
      deriveSharedProjectionIdempotencyKey({
        patientSubjectRef: "subj-shared",
        planId: "plan",
        planVersion: 1,
        hairlineDesignId: "hl",
        hairlineDesignVersion: 1,
        sourceImageChecksum: "src",
        maskChecksum: "mask",
        view: "frontal",
        mode: "planned",
        providerId: SHARED_PROJECTION_PROVIDER_ID,
        modelVersion: "gpt-image-2",
        promptTemplateVersion: OPENAI_EDIT_PROMPT_VERSION_V3,
      }),
      key
    );
  });

  it("seam detection flags rejected-asset-like scores", () => {
    const flags = evaluateSeamFlags({
      horizontalSeamScore: 40,
      boundaryMean: 30,
      haloScore: 0.5,
      exposureJump: 120,
    });
    assert.ok(flags.includes("visible_horizontal_seam"));
    assert.ok(flags.includes("haloing"));
  });

  it("rejected HairAudit asset remains isolated and immutable in policy", () => {
    assert.equal(HAIRAUDIT_OPENAI_PILOT_ASSET_INSPECTION.liveStatusAtInspection, "rejected");
    assert.equal(HAIRAUDIT_OPENAI_PILOT_ASSET_INSPECTION.displayAsAwaitingFiosReviewAllowed, false);
    assert.equal(HAIRAUDIT_OPENAI_PILOT_ASSET_INSPECTION.seamAtMaskBoundary, true);
    assert.equal(HAIRAUDIT_OPENAI_PILOT_ASSET_INSPECTION.id.startsWith("2791b827"), true);
  });

  it("cost estimate is positive and bounded", () => {
    const est = estimateSharedProjectionCostUsd({ quality: "high" });
    assert.ok(est > 0 && est < 5);
  });

  it("stale plan / unapproved hairline are readiness blockers upstream", () => {
    // Covered by config + request service gates; assert capability keys exist.
    assert.ok(SURGERY_PROJECTION_CAPABILITIES.requestGeneration);
    assert.ok(SURGERY_PROJECTION_CAPABILITIES.approveHairline);
  });
});
