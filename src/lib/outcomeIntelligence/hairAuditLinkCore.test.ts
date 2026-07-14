import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HAIR_AUDIT_LINK_METADATA_KEY,
  buildStructuredHairAuditLinkFromLegacy,
  formatHairAuditLinkDashboardLabel,
  mergeAdditiveCaseHairAuditMetadata,
  parseLegacyHairAuditLinkMetadata,
  parseStructuredHairAuditLink,
  resolveHairAuditLinkForSurgery,
} from "./hairAuditLinkCore";

const TENANT = "11111111-1111-4111-8111-111111111111";
const SURGERY = "22222222-2222-4222-8222-222222222222";
const CASE = "33333333-3333-4333-8333-333333333333";
const REPORT = "44444444-4444-4444-8444-444444444444";
const IMAGE = "55555555-5555-4555-8555-555555555555";
const LEGACY_HAIRAUDIT = "66666666-6666-4666-8666-666666666666";
const NEW_HAIRAUDIT = "77777777-7777-4777-8777-777777777777";

describe("hairAuditLinkCore legacy compatibility", () => {
  it("existing HairAudit case link still opens admin hub", () => {
    const resolution = resolveHairAuditLinkForSurgery({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseMetadata: { hairaudit_case_id: LEGACY_HAIRAUDIT },
    });
    assert.equal(resolution.hairaudit_case_id, LEGACY_HAIRAUDIT);
    assert.equal(resolution.hrefs.hairaudit_admin_href, "/hair-audit/admin");
    assert.equal(resolution.link_origin, "legacy");
  });

  it("existing report link still opens /fi-admin/{tenant}/audit/{reportId}", () => {
    const resolution = resolveHairAuditLinkForSurgery({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseMetadata: { report_id: REPORT, hairaudit_case_id: LEGACY_HAIRAUDIT },
    });
    assert.equal(resolution.fi_report_id, REPORT);
    assert.equal(resolution.hrefs.audit_report_href, `/fi-admin/${TENANT}/audit/${REPORT}`);
  });

  it("existing image-to-audit metadata still resolves via source_case_id", () => {
    const resolution = resolveHairAuditLinkForSurgery({
      tenantId: TENANT,
      surgeryId: SURGERY,
      imageMetadataSamples: [
        {
          upload_source: "hairaudit",
          source_system: "hairaudit",
          source_case_id: LEGACY_HAIRAUDIT,
          fi_patient_image_id: IMAGE,
        },
      ],
    });
    assert.equal(resolution.hairaudit_case_id, LEGACY_HAIRAUDIT);
    assert.deepEqual(resolution.linked_image_ids, [IMAGE]);
  });

  it("legacy metadata without new fields still parses", () => {
    const legacy = parseLegacyHairAuditLinkMetadata({
      source_system: "hairaudit",
      source_case_id: LEGACY_HAIRAUDIT,
      patient_review_pathway: "standard_post_op",
    });
    assert.equal(legacy.hairaudit_case_id, LEGACY_HAIRAUDIT);
    assert.equal(legacy.patient_review_pathway, "standard_post_op");
    assert.equal(parseStructuredHairAuditLink({}), null);
  });
});

describe("hairAuditLinkCore structured linkage safety", () => {
  it("new structured linkage does not overwrite legacy linkage on conflict", () => {
    const resolution = resolveHairAuditLinkForSurgery({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseMetadata: {
        hairaudit_case_id: LEGACY_HAIRAUDIT,
        [HAIR_AUDIT_LINK_METADATA_KEY]: {
          hairaudit_case_id: NEW_HAIRAUDIT,
          link_origin: "structured",
        },
      },
    });
    assert.equal(resolution.hairaudit_case_id, LEGACY_HAIRAUDIT);
    assert.equal(resolution.linkage_conflict, true);
    assert.match(resolution.linkage_conflict_detail ?? "", /disagrees/);
    assert.equal(formatHairAuditLinkDashboardLabel(resolution), "Conflict — review");
  });

  it("conflict is surfaced, not silently repaired", () => {
    const resolution = resolveHairAuditLinkForSurgery({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseMetadata: {
        report_id: REPORT,
        [HAIR_AUDIT_LINK_METADATA_KEY]: {
          fi_report_id: "other-report",
          link_origin: "structured",
        },
      },
    });
    assert.equal(resolution.fi_report_id, REPORT);
    assert.equal(resolution.linkage_conflict, true);
    assert.equal(resolution.audit_readiness.needs_operator_review, true);
  });

  it("additive metadata merge preserves legacy keys", () => {
    const merged = mergeAdditiveCaseHairAuditMetadata(
      {
        hairaudit_case_id: LEGACY_HAIRAUDIT,
        source_case_id: LEGACY_HAIRAUDIT,
        patient_review_pathway: "legacy_path",
      },
      {
        hairaudit_case_id: NEW_HAIRAUDIT,
        link_origin: "legacy",
        surgery_id: SURGERY,
      }
    );
    assert.equal(merged.hairaudit_case_id, LEGACY_HAIRAUDIT);
    assert.equal(merged.source_case_id, LEGACY_HAIRAUDIT);
    assert.equal(merged.patient_review_pathway, "legacy_path");
    const structured = parseStructuredHairAuditLink(merged);
    assert.equal(structured?.link_origin, "legacy");
    assert.equal(structured?.hairaudit_case_id, NEW_HAIRAUDIT);
  });
});

describe("hairAuditLinkCore new links", () => {
  it("surgery resolves HairAudit case via global source bridge", () => {
    const resolution = resolveHairAuditLinkForSurgery({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseId: CASE,
      globalCaseSourceIds: [{ source_system: "hairaudit", source_case_id: NEW_HAIRAUDIT }],
      fiReportId: REPORT,
    });
    assert.equal(resolution.hairaudit_case_id, NEW_HAIRAUDIT);
    assert.equal(resolution.fi_report_id, REPORT);
    assert.equal(resolution.link_origin, "resolved_match");
    assert.equal(resolution.audit_readiness.ready_for_audit, true);
  });

  it("audit readiness works with new structured fields", () => {
    const resolution = resolveHairAuditLinkForSurgery({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseMetadata: {
        [HAIR_AUDIT_LINK_METADATA_KEY]: {
          hairaudit_case_id: NEW_HAIRAUDIT,
          fi_report_id: REPORT,
          patient_review_pathway: "post_op_12m",
          link_origin: "structured",
        },
      },
    });
    assert.equal(resolution.audit_readiness.linked, true);
    assert.equal(resolution.audit_readiness.has_report, true);
    assert.equal(resolution.audit_readiness.has_pathway, true);
    assert.equal(resolution.audit_readiness.ready_for_audit, true);
    assert.equal(formatHairAuditLinkDashboardLabel(resolution), "Audit ready");
  });

  it("dashboard indicators resolve both legacy and structured links", () => {
    const legacy = resolveHairAuditLinkForSurgery({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseMetadata: { hairaudit_case_id: LEGACY_HAIRAUDIT },
    });
    const structured = resolveHairAuditLinkForSurgery({
      tenantId: TENANT,
      surgeryId: SURGERY,
      caseMetadata: {
        [HAIR_AUDIT_LINK_METADATA_KEY]: {
          hairaudit_case_id: NEW_HAIRAUDIT,
          link_origin: "structured",
        },
      },
    });
    assert.equal(formatHairAuditLinkDashboardLabel(legacy), "Linked — no report");
    assert.equal(formatHairAuditLinkDashboardLabel(structured), "Linked — no report");
  });

  it("buildStructuredHairAuditLinkFromLegacy copies legacy without deleting metadata", () => {
    const legacy = parseLegacyHairAuditLinkMetadata({
      hairaudit_case_id: LEGACY_HAIRAUDIT,
      report_id: REPORT,
      patient_review_pathway: "standard_post_op",
      linked_image_ids: [IMAGE],
    });
    const structured = buildStructuredHairAuditLinkFromLegacy({
      legacy,
      surgeryId: SURGERY,
      linkedAt: "2026-07-04T12:00:00.000Z",
    });
    assert.equal(structured?.link_origin, "legacy");
    assert.equal(structured?.hairaudit_case_id, LEGACY_HAIRAUDIT);
    assert.equal(structured?.fi_report_id, REPORT);
    assert.deepEqual(structured?.linked_image_ids, [IMAGE]);
  });
});
