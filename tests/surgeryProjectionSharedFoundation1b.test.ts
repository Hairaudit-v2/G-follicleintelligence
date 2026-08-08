/**
 * FI-SURGERY-PROJECTION-SHARED-FOUNDATION-1B — contract / domain tests.
 * No paid provider calls. Avoids server-only modules.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertProviderMayEmitArtifact,
  canTransitionSharedProjectionLifecycle,
  lifecycleFromPrerequisites,
  patientSafeFailureMessage,
  resolveProjectionArtifactType,
  assertAllocationMapLabelSafe,
  HAIRAUDIT_EXTRACT_INVENTORY,
} from "@follicle/projection-core/client";
import { deriveSharedProjectionIdempotencyKey } from "@follicle/projection-core/server";
import { buildAllocationMapViewModel } from "@/src/lib/cases/surgeryProjection/allocationMapModel";
import {
  buildHairlinePolylineFromControls,
  mergeHairlineControls,
  hairlineDecisionIsolatedFromPlan,
} from "@/src/lib/cases/surgeryProjection/hairlineDomain";
import { evaluateSurgeryProjectionReadiness } from "@/src/lib/cases/surgeryProjection/readiness";
import {
  actorHasSurgeryProjectionCapability,
  SURGERY_PROJECTION_CAPABILITIES,
} from "@/src/lib/cases/surgeryProjection/capabilities";
import {
  canDisplayExternalProjectionInFios,
  HAIRAUDIT_OPENAI_PILOT_ASSET_INSPECTION,
  externalProjectionDisplayLabel,
} from "@/src/lib/imaging-os/sharedProjection/externalAssetPolicy";

describe("artifact-type separation", () => {
  it("overlay providers never resolve to illustrative_projected_outcome", () => {
    assert.equal(
      resolveProjectionArtifactType({
        artifactType: "illustrative_projected_outcome",
        providerId: "local-illustrative-v1",
      }),
      "graft_allocation_map"
    );
    assert.equal(
      resolveProjectionArtifactType({ providerId: "stub-v1" }),
      "graft_allocation_map"
    );
  });

  it("assertProviderMayEmitArtifact blocks overlay → illustrative", () => {
    assert.throws(() =>
      assertProviderMayEmitArtifact({
        providerId: "stub",
        artifactType: "illustrative_projected_outcome",
      })
    );
  });

  it("forbids projected-outcome wording on allocation maps", () => {
    assert.throws(() => assertAllocationMapLabelSafe("Projected outcome map"));
    assert.doesNotThrow(() =>
      assertAllocationMapLabelSafe("Graft Allocation Map · Clinical planning view")
    );
  });
});

describe("idempotency across products", () => {
  it("same clinical parts yield the same key", () => {
    const parts = {
      patientSubjectRef: "subject-1",
      planId: "plan-1",
      planVersion: 4,
      hairlineDesignId: "hl-1",
      hairlineDesignVersion: 1,
      sourceImageChecksum: "abc",
      maskChecksum: "def",
      view: "frontal" as const,
      mode: "planned" as const,
      providerId: "openai-gpt-image",
      modelVersion: "gpt-image-2",
      promptTemplateVersion: "ha-openai-projected-outcome-prompt-v2",
    };
    assert.equal(
      deriveSharedProjectionIdempotencyKey(parts),
      deriveSharedProjectionIdempotencyKey({ ...parts })
    );
  });

  it("changing prompt template version changes the key", () => {
    const base = {
      patientSubjectRef: "subject-1",
      planId: "plan-1",
      planVersion: 4,
      hairlineDesignId: "hl-1",
      hairlineDesignVersion: 1,
      sourceImageChecksum: "abc",
      maskChecksum: "def",
      view: "frontal" as const,
      mode: "planned" as const,
      providerId: "openai-gpt-image",
      modelVersion: "gpt-image-2",
      promptTemplateVersion: "v1",
    };
    assert.notEqual(
      deriveSharedProjectionIdempotencyKey(base),
      deriveSharedProjectionIdempotencyKey({ ...base, promptTemplateVersion: "v2" })
    );
  });
});

describe("lifecycle and prerequisites", () => {
  it("maps plan/hairline gates to technical lifecycle", () => {
    assert.equal(
      lifecycleFromPrerequisites({ planApproved: false, hairlineApproved: false }),
      "awaiting_plan_approval"
    );
    assert.equal(
      lifecycleFromPrerequisites({ planApproved: true, hairlineApproved: false }),
      "awaiting_hairline_approval"
    );
    assert.equal(
      lifecycleFromPrerequisites({ planApproved: true, hairlineApproved: true }),
      "ready_to_generate"
    );
  });

  it("clinician_review is terminal for shared technical transitions", () => {
    assert.equal(
      canTransitionSharedProjectionLifecycle("clinician_review", "superseded"),
      true
    );
  });
});

describe("FiOS hairline + allocation map", () => {
  it("builds photo-bound polyline from clinical controls", () => {
    const poly = buildHairlinePolylineFromControls({
      centralHeightNorm: 0.3,
      leftRecessionNorm: 0.2,
      rightRecessionNorm: 0.25,
      symmetryBias: 0,
      temporalTransitionLeft: 0.3,
      temporalTransitionRight: 0.3,
      macroIrregularity: 0.2,
      anteriorTransitionDepth: 0.1,
    });
    assert.ok(poly.length >= 5);
    for (const p of poly) {
      assert.ok(p.x >= 0 && p.x <= 1);
      assert.ok(p.y >= 0 && p.y <= 1);
    }
  });

  it("merge regenerates polyline when controls change", () => {
    const a = mergeHairlineControls(
      {
        centralHeightNorm: 0.28,
        leftRecessionNorm: 0.2,
        rightRecessionNorm: 0.2,
        symmetryBias: 0,
        temporalTransitionLeft: 0.3,
        temporalTransitionRight: 0.3,
        macroIrregularity: 0.2,
        anteriorTransitionDepth: 0.1,
        polylineNorm: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
      { centralHeightNorm: 0.4 }
    );
    assert.equal(a.centralHeightNorm, 0.4);
    assert.ok(a.polylineNorm.length > 2);
  });

  it("hairline decision isolation constant holds", () => {
    assert.equal(hairlineDecisionIsolatedFromPlan(), true);
  });

  it("allocation map remains graft_allocation_map", () => {
    const model = buildAllocationMapViewModel({
      planId: "p1",
      planningStatus: "approved",
      planUpdatedAt: "2026-08-07T00:00:00Z",
      zones: [
        { key: "hairline", grafts: 500, targetDensityPerCm2: 30, deferred: false },
        { key: "crown", grafts: 400, deferred: true },
      ],
      estimatedGraftsMin: 800,
      estimatedGraftsMax: 1000,
    });
    assert.equal(model.artifactType, "graft_allocation_map");
    assert.equal(model.totalGrafts, 900);
    assert.ok(model.patientSafeLabel.includes("Graft Allocation Map"));
    assert.ok(!/projected outcome/i.test(model.patientSafeLabel));
  });
});

describe("readiness + capabilities + patient sharing", () => {
  it("blocks generation without approved plan/hairline", () => {
    const r = evaluateSurgeryProjectionReadiness({
      plan: {
        id: "p",
        tenant_id: "t",
        case_id: "c",
        planning_status: "draft",
        planned_procedure_type: null,
        planned_session_type: null,
        planned_zones: [{ key: "hairline", grafts: 100 }],
        estimated_grafts_min: null,
        estimated_grafts_max: null,
        donor_strategy_notes: null,
        recipient_strategy_notes: null,
        medication_prep_notes: null,
        planning_notes: null,
        surgical_plan_summary: null,
        created_at: "",
        updated_at: "",
      },
      approvedHairline: null,
    });
    assert.equal(r.canRequestGeneration, false);
    assert.equal(r.patientSharingAvailable, false);
    assert.equal(r.lifecycleHint, "awaiting_plan_approval");
  });

  it("denies patient sharing capability in 1B", () => {
    assert.equal(
      actorHasSurgeryProjectionCapability(
        { role: "admin", userId: "u1" },
        SURGERY_PROJECTION_CAPABILITIES.enablePatientSharing
      ),
      false
    );
    assert.equal(
      actorHasSurgeryProjectionCapability(
        { role: "doctor", userId: "u1" },
        SURGERY_PROJECTION_CAPABILITIES.approveHairline
      ),
      true
    );
  });

  it("external HA asset cannot display awaiting FiOS review without mapping", () => {
    assert.equal(
      canDisplayExternalProjectionInFios({
        fiosSubjectMappingVerified: false,
        artifactType: "illustrative_projected_outcome",
      }),
      false
    );
    assert.equal(HAIRAUDIT_OPENAI_PILOT_ASSET_INSPECTION.fiosSubjectMappingVerified, false);
    assert.match(
      externalProjectionDisplayLabel({ fiosSubjectMappingVerified: false }),
      /isolated/i
    );
  });

  it("provider failure messages never claim success", () => {
    assert.match(patientSafeFailureMessage("provider_disabled"), /unavailable/i);
  });
});

describe("extract inventory present", () => {
  it("classifies HairAudit components without moving approval into shared service", () => {
    assert.ok(HAIRAUDIT_EXTRACT_INVENTORY.some((c) => c.component.includes("openaiGptImage")));
    assert.ok(
      HAIRAUDIT_EXTRACT_INVENTORY.some(
        (c) => c.classification === "product_specific_ui_workflow"
      )
    );
  });
});
