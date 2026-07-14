import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HAIR_AUDIT_LINK_METADATA_KEY } from "./hairAuditLinkCore";
import {
  aggregateHairAuditLinkBackfillSummary,
  planHairAuditLinkBackfillItem,
} from "./hairAuditLinkBackfillCore";

const CASE = "33333333-3333-4333-8333-333333333333";
const SURGERY = "22222222-2222-4222-8222-222222222222";
const LEGACY_HAIRAUDIT = "66666666-6666-4666-8666-666666666666";
const REPORT = "44444444-4444-4444-8444-444444444444";

describe("hairAuditLinkBackfillCore", () => {
  it("dry-run previews legacy copy without requiring writes", () => {
    const planned = planHairAuditLinkBackfillItem({
      caseId: CASE,
      surgeryId: SURGERY,
      dryRun: true,
      caseMetadata: {
        hairaudit_case_id: LEGACY_HAIRAUDIT,
        report_id: REPORT,
      },
    });
    assert.equal(planned.outcome.kind, "dry_run_would_copy");
    assert.ok(planned.nextMetadata);
    assert.equal(planned.nextMetadata?.hairaudit_case_id, LEGACY_HAIRAUDIT);
    const structured = planned.nextMetadata?.[HAIR_AUDIT_LINK_METADATA_KEY] as Record<
      string,
      unknown
    >;
    assert.equal(structured.link_origin, "legacy");
    assert.equal(structured.hairaudit_case_id, LEGACY_HAIRAUDIT);
  });

  it("backfill copies legacy link into new structure without deleting old metadata", () => {
    const original = {
      hairaudit_case_id: LEGACY_HAIRAUDIT,
      source_case_id: LEGACY_HAIRAUDIT,
      patient_review_pathway: "standard_post_op",
    };
    const planned = planHairAuditLinkBackfillItem({
      caseId: CASE,
      surgeryId: SURGERY,
      dryRun: false,
      caseMetadata: original,
    });
    assert.equal(planned.outcome.kind, "copied_legacy");
    assert.equal(planned.nextMetadata?.hairaudit_case_id, LEGACY_HAIRAUDIT);
    assert.equal(planned.nextMetadata?.source_case_id, LEGACY_HAIRAUDIT);
    assert.equal(planned.nextMetadata?.patient_review_pathway, "standard_post_op");
  });

  it("skips when structured linkage already exists", () => {
    const planned = planHairAuditLinkBackfillItem({
      caseId: CASE,
      surgeryId: SURGERY,
      dryRun: false,
      caseMetadata: {
        hairaudit_case_id: LEGACY_HAIRAUDIT,
        [HAIR_AUDIT_LINK_METADATA_KEY]: {
          hairaudit_case_id: LEGACY_HAIRAUDIT,
          link_origin: "legacy",
        },
      },
    });
    assert.equal(planned.outcome.kind, "skipped_already_structured");
  });

  it("skips conflict instead of auto-overwriting", () => {
    const planned = planHairAuditLinkBackfillItem({
      caseId: CASE,
      surgeryId: SURGERY,
      dryRun: false,
      caseMetadata: {
        hairaudit_case_id: LEGACY_HAIRAUDIT,
        [HAIR_AUDIT_LINK_METADATA_KEY]: {
          hairaudit_case_id: "other-case",
          linkage_conflict: true,
          link_origin: "structured",
        },
      },
    });
    assert.equal(planned.outcome.kind, "skipped_conflict");
  });

  it("aggregates operator summary counts", () => {
    const summary = aggregateHairAuditLinkBackfillSummary(
      [
        { kind: "dry_run_would_copy", caseId: CASE, surgeryId: SURGERY },
        { kind: "skipped_no_legacy", caseId: CASE, surgeryId: SURGERY },
        { kind: "skipped_conflict", caseId: CASE, surgeryId: SURGERY, detail: "conflict" },
      ],
      true
    );
    assert.equal(summary.scanned, 3);
    assert.equal(summary.wouldCopy, 1);
    assert.equal(summary.skippedNoLegacy, 1);
    assert.equal(summary.skippedConflict, 1);
  });
});
