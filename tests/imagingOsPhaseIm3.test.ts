import { describe, it } from "node:test";
import assert from "node:assert";
import {
  IMAGING_OS_PROTOCOL_TYPES,
  IMAGING_PROTOCOL_REQUIREMENTS,
  evaluateImageProtocolCompleteness,
  evaluateCaseImageSet,
  recommendProtocolForWorkflow,
  isImagingOsProtocolType,
  runImagingOsIngestionPipeline,
  evaluateHairAuditCaseImageProtocol,
} from "../src/lib/imaging-os";
import type { ImagingOsProtocolType } from "../src/lib/imaging-os";

const HAIRAUDIT_BASELINE_REQUIRED = [
  "front",
  "left",
  "right",
  "top",
  "crown",
  "donor",
] as const;

function fullHairAuditBaselineSet() {
  return [...HAIRAUDIT_BASELINE_REQUIRED];
}

describe("ImagingOS IM-3 — protocol registry", () => {
  it("loads all supported protocol types with requirements", () => {
    assert.strictEqual(IMAGING_OS_PROTOCOL_TYPES.length, 12);
    for (const protocol of IMAGING_OS_PROTOCOL_TYPES) {
      assert.ok(isImagingOsProtocolType(protocol));
      const req = IMAGING_PROTOCOL_REQUIREMENTS[protocol];
      assert.ok(req.description.length > 0);
      assert.ok(req.required.length > 0);
      assert.ok(req.minimum_required_count > 0);
      assert.ok(req.minimum_required_count <= req.required.length);
    }
  });

  it("defines hairaudit_baseline requirements", () => {
    const req = IMAGING_PROTOCOL_REQUIREMENTS.hairaudit_baseline;
    assert.deepStrictEqual(req.required, [...HAIRAUDIT_BASELINE_REQUIRED]);
    assert.deepStrictEqual(req.optional, ["microscopic"]);
    assert.strictEqual(req.minimum_required_count, 6);
  });

  it("defines surgery_planning with recipient requirement", () => {
    const req = IMAGING_PROTOCOL_REQUIREMENTS.surgery_planning;
    assert.ok(req.required.includes("recipient"));
    assert.strictEqual(req.minimum_required_count, 7);
  });
});

describe("ImagingOS IM-3 — evaluateImageProtocolCompleteness", () => {
  it("returns complete + ready for full hairaudit_baseline set", () => {
    const result = evaluateImageProtocolCompleteness({
      protocol: "hairaudit_baseline",
      categories: fullHairAuditBaselineSet(),
    });
    assert.strictEqual(result.status, "complete");
    assert.strictEqual(result.workflow_readiness, "ready");
    assert.strictEqual(result.completeness_score, 100);
    assert.strictEqual(result.total_required, 6);
    assert.strictEqual(result.present_required, 6);
    assert.deepStrictEqual(result.missing_required, []);
  });

  it("returns partial + partial_ready when donor is missing", () => {
    const result = evaluateImageProtocolCompleteness({
      protocol: "hairaudit_baseline",
      categories: fullHairAuditBaselineSet().filter((c) => c !== "donor"),
    });
    assert.strictEqual(result.status, "partial");
    assert.strictEqual(result.workflow_readiness, "partial_ready");
    assert.strictEqual(result.completeness_score, 83);
    assert.deepStrictEqual(result.missing_required, ["donor"]);
  });

  it("returns incomplete + not_ready for only front and top", () => {
    const result = evaluateImageProtocolCompleteness({
      protocol: "hairaudit_baseline",
      categories: ["front", "top"],
    });
    assert.strictEqual(result.status, "incomplete");
    assert.strictEqual(result.workflow_readiness, "not_ready");
    assert.ok(result.completeness_score < 70);
    assert.deepStrictEqual(result.missing_required, ["left", "right", "crown", "donor"]);
  });

  it("validates surgery_planning recipient requirement", () => {
    const withoutRecipient = evaluateImageProtocolCompleteness({
      protocol: "surgery_planning",
      categories: ["front", "left", "right", "top", "crown", "donor"],
    });
    assert.strictEqual(withoutRecipient.status, "partial");
    assert.deepStrictEqual(withoutRecipient.missing_required, ["recipient"]);

    const withRecipient = evaluateImageProtocolCompleteness({
      protocol: "surgery_planning",
      categories: [
        "front",
        "left",
        "right",
        "top",
        "crown",
        "donor",
        "recipient",
      ],
    });
    assert.strictEqual(withRecipient.status, "complete");
    assert.strictEqual(withRecipient.workflow_readiness, "ready");
  });

  it("returns invalid for unknown protocol", () => {
    const result = evaluateImageProtocolCompleteness({
      protocol: "not_a_real_protocol" as ImagingOsProtocolType,
      categories: ["front"],
    });
    assert.strictEqual(result.status, "invalid");
    assert.strictEqual(result.workflow_readiness, "not_ready");
    assert.strictEqual(result.completeness_score, 0);
  });

  it("tracks optional categories present", () => {
    const result = evaluateImageProtocolCompleteness({
      protocol: "hairaudit_baseline",
      categories: [...fullHairAuditBaselineSet(), "microscopic"],
    });
    assert.strictEqual(result.status, "complete");
    assert.deepStrictEqual(result.optional_present, ["microscopic"]);
  });
});

describe("ImagingOS IM-3 — evaluateCaseImageSet", () => {
  it("extracts categories from case images and evaluates protocol", () => {
    const result = evaluateCaseImageSet({
      protocol: "hairaudit_baseline",
      images: fullHairAuditBaselineSet().map((canonical_category) => ({ canonical_category })),
    });
    assert.strictEqual(result.status, "complete");
    assert.strictEqual(result.present_required, 6);
  });
});

describe("ImagingOS IM-3 — recommendProtocolForWorkflow", () => {
  it("maps HairAudit to hairaudit_baseline", () => {
    assert.strictEqual(
      recommendProtocolForWorkflow({ source_system: "hairaudit", upload_surface: "audit_upload" }),
      "hairaudit_baseline"
    );
  });

  it("maps consultation_os to consultation_basic", () => {
    assert.strictEqual(
      recommendProtocolForWorkflow({
        source_system: "consultation_os",
        upload_surface: "consultation_form",
      }),
      "consultation_basic"
    );
  });

  it("maps surgery_os to surgery_planning", () => {
    assert.strictEqual(
      recommendProtocolForWorkflow({
        source_system: "surgery_os",
        upload_surface: "surgery_workflow",
      }),
      "surgery_planning"
    );
  });

  it("maps hli to hli_diagnostic", () => {
    assert.strictEqual(
      recommendProtocolForWorkflow({ source_system: "hli", upload_surface: "internal_api" }),
      "hli_diagnostic"
    );
  });

  it("returns undefined for manual_upload", () => {
    assert.strictEqual(
      recommendProtocolForWorkflow({ source_system: "manual_upload", upload_surface: "clinic_console" }),
      undefined
    );
  });
});

describe("ImagingOS IM-3 — HairAudit case adapter", () => {
  it("maps HairAudit labels and evaluates hairaudit_baseline", () => {
    const result = evaluateHairAuditCaseImageProtocol([
      "patient_current_front",
      "patient_current_left",
      "patient_current_right",
      "patient_current_top",
      "patient_current_crown",
      "patient_current_donor",
    ]);
    assert.strictEqual(result.protocol, "hairaudit_baseline");
    assert.strictEqual(result.status, "complete");
    assert.strictEqual(result.workflow_readiness, "ready");
  });

  it("detects missing donor from HairAudit labels", () => {
    const result = evaluateHairAuditCaseImageProtocol([
      "patient_current_front",
      "patient_current_left",
      "patient_current_right",
      "patient_current_top",
      "patient_current_crown",
    ]);
    assert.strictEqual(result.status, "partial");
    assert.deepStrictEqual(result.missing_required, ["donor"]);
  });
});

describe("ImagingOS IM-3 — pipeline integration", () => {
  it("preserves IM-2 behavior when protocol context is omitted", () => {
    const result = runImagingOsIngestionPipeline({
      source_system: "fi_os",
      upload_surface: "clinic_console",
      storage_path: "uploads/test.jpg",
      external_category: "donor",
    });
    assert.strictEqual(result.protocol.protocol_status, "not_evaluated");
    assert.strictEqual(result.protocol_completeness, undefined);
    assert.strictEqual(result.status, "dry_run");
  });

  it("runs protocol completeness when protocol context is provided", () => {
    const result = runImagingOsIngestionPipeline(
      {
        source_system: "hairaudit",
        upload_surface: "audit_upload",
        storage_path: "cases/front.jpg",
        external_category: "patient_current_front",
      },
      {
        protocol: "hairaudit_baseline",
        case_categories: fullHairAuditBaselineSet(),
      }
    );
    assert.strictEqual(result.protocol.protocol_status, "not_evaluated");
    assert.ok(result.protocol_completeness);
    assert.strictEqual(result.protocol_completeness!.status, "complete");
    assert.strictEqual(result.protocol_completeness!.workflow_readiness, "ready");
  });

  it("evaluates single-image category when case_categories omitted", () => {
    const result = runImagingOsIngestionPipeline(
      {
        source_system: "fi_os",
        upload_surface: "clinic_console",
        storage_path: "uploads/front.jpg",
        external_category: "patient_current_front",
      },
      { protocol: "hairaudit_baseline" }
    );
    assert.ok(result.protocol_completeness);
    assert.strictEqual(result.protocol_completeness!.status, "incomplete");
    assert.strictEqual(result.protocol_completeness!.present_required, 1);
  });
});
