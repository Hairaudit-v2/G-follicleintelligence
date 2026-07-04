import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCaseExternalId } from "@/lib/fi/events/mapping";
import { buildRecentAuditCases } from "@/src/lib/fiAdmin/auditIntelligencePresentation";
import {
  buildHairAuditPatientImageMetadata,
  HAIRAUDIT_PATIENT_IMAGE_UPLOAD_SOURCE,
} from "@/src/lib/fi/foundation/hairauditPatientImageDualWriteCore";
import { buildImagingDeepLinks } from "@/src/lib/imaging-os/imagingDeepLinksCore";
import { buildPatientTwinImagingDeepLinks } from "@/src/lib/patientTwin/patientTwinImagingIntelligenceCore";
import {
  buildLegacyFiAuditReportHref,
  buildLegacyHairAuditAdminHref,
  HAIRAUDIT_LINK_CREATION_PATHS,
  HAIRAUDIT_LINK_READ_PATHS,
  HAIRAUDIT_METADATA_KEY_INVENTORY,
  legacyFiAuditReportLinkAvailable,
  legacyHairAuditAdminLinkAvailable,
  parseLegacyHairAuditLinkMetadataSnapshot,
} from "./hairAuditLinkCompatibilityAuditCore";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PATIENT = "22222222-2222-4222-8222-222222222222";
const CASE = "33333333-3333-4333-8333-333333333333";
const REPORT = "44444444-4444-4444-8444-444444444444";
const IMAGE = "55555555-5555-4555-8555-555555555555";
const HAIRAUDIT_CASE = "66666666-6666-4666-8666-666666666666";

describe("hairAuditLinkCompatibilityAudit", () => {
  it("documents HairAudit link creation and read inventories", () => {
    assert.ok(HAIRAUDIT_LINK_CREATION_PATHS.length >= 10);
    assert.ok(HAIRAUDIT_LINK_READ_PATHS.length >= 10);
    assert.deepEqual(HAIRAUDIT_METADATA_KEY_INVENTORY.caseId, [
      "source_case_id",
      "hairaudit_source_case_id",
      "hair_audit_case_id",
      "hairaudit_case_id",
    ]);
    assert.ok(HAIRAUDIT_METADATA_KEY_INVENTORY.reportId.includes("report_id"));
    assert.ok(HAIRAUDIT_METADATA_KEY_INVENTORY.sourceSystem.includes("source_system"));
  });

  it("legacy metadata without new structured fields still parses", () => {
    const snapshot = parseLegacyHairAuditLinkMetadataSnapshot({
      source_system: "hairaudit",
      source_case_id: HAIRAUDIT_CASE,
      source_patient_id: "ha-patient-1",
      report_id: REPORT,
      patient_review_pathway: "standard_post_op",
      fi_patient_image_id: IMAGE,
    });
    assert.equal(snapshot.hairaudit_case_id, HAIRAUDIT_CASE);
    assert.equal(snapshot.fi_report_id, REPORT);
    assert.equal(snapshot.patient_review_pathway, "standard_post_op");
    assert.deepEqual(snapshot.linked_image_ids, [IMAGE]);
  });

  it("legacy alias keys resolve hairaudit case id without structured block", () => {
    for (const key of ["hairaudit_case_id", "hair_audit_case_id", "hairaudit_source_case_id"] as const) {
      const snapshot = parseLegacyHairAuditLinkMetadataSnapshot({ [key]: HAIRAUDIT_CASE });
      assert.equal(snapshot.hairaudit_case_id, HAIRAUDIT_CASE, key);
    }
  });

  it("existing HairAudit dual-write metadata still exposes source_case_id", () => {
    const metadata = buildHairAuditPatientImageMetadata({
      fiEventId: "evt-1",
      sourceSystem: "hairaudit",
      sourceCaseId: HAIRAUDIT_CASE,
      sourcePatientId: "ha-patient-1",
      hairauditImageType: "frontal",
      canonicalView: "front",
    });
    assert.equal(metadata.source_case_id, HAIRAUDIT_CASE);
    assert.equal(metadata.upload_source, HAIRAUDIT_PATIENT_IMAGE_UPLOAD_SOURCE);
    const snapshot = parseLegacyHairAuditLinkMetadataSnapshot(metadata);
    assert.equal(snapshot.hairaudit_case_id, HAIRAUDIT_CASE);
  });

  it("existing HairAudit admin deep link still opens at /hair-audit/admin", () => {
    const links = buildImagingDeepLinks({
      tenantId: TENANT,
      patientId: PATIENT,
      hairAuditSourceCaseId: HAIRAUDIT_CASE,
    });
    assert.equal(links.hairAuditCase?.href, buildLegacyHairAuditAdminHref());
    assert.equal(links.hairAuditCase?.href, "/hair-audit/admin");
  });

  it("patient twin legacy metadata keys still produce HairAudit admin link", () => {
    const withAlias = buildPatientTwinImagingDeepLinks({
      tenantId: TENANT,
      patientId: PATIENT,
      metadata: { hairaudit_source_case_id: HAIRAUDIT_CASE },
      imageId: IMAGE,
      reviewRequired: false,
    });
    assert.ok(withAlias.links.some((l) => l.href === "/hair-audit/admin"));

    const withSnake = buildPatientTwinImagingDeepLinks({
      tenantId: TENANT,
      patientId: PATIENT,
      metadata: { hair_audit_case_id: HAIRAUDIT_CASE },
      imageId: IMAGE,
      reviewRequired: false,
    });
    assert.ok(withSnake.links.some((l) => l.href === "/hair-audit/admin"));
  });

  it("existing FI audit report route still uses /fi-admin/{tenant}/audit/{reportId}", () => {
    const href = buildLegacyFiAuditReportHref(TENANT, REPORT);
    assert.equal(href, `/fi-admin/${TENANT}/audit/${REPORT}`);

    const rows = buildRecentAuditCases(
      [
        {
          report_id: REPORT,
          case_id: CASE,
          version: 1,
          report_status: "draft",
          created_at: "2026-07-01T10:00:00.000Z",
          patient: { full_name: "Test Patient", email: "test@example.com" },
        },
      ],
      []
    );
    assert.equal(rows[0]?.reportId, REPORT);
    assert.equal(
      buildLegacyFiAuditReportHref(TENANT, rows[0]!.reportId),
      `/fi-admin/${TENANT}/audit/${REPORT}`
    );
  });

  it("existing image-to-audit metadata bridge still resolves case id", () => {
    const metadata = {
      upload_source: "hairaudit",
      capture_source: "hairaudit",
      source_system: "hairaudit",
      source_case_id: HAIRAUDIT_CASE,
      fi_upload_id: "upload-1",
      global_case_id: "global-case-1",
    };
    const snapshot = parseLegacyHairAuditLinkMetadataSnapshot(metadata);
    assert.equal(snapshot.hairaudit_case_id, HAIRAUDIT_CASE);
    assert.equal(snapshot.source_system, "hairaudit");
    assert.ok(legacyHairAuditAdminLinkAvailable(snapshot));
  });

  it("existing fi_cases external id bridge still uses hairaudit:{source_case_id}", () => {
    assert.equal(buildCaseExternalId("hairaudit", HAIRAUDIT_CASE), `hairaudit:${HAIRAUDIT_CASE}`);
  });

  it("legacy report metadata without new fields still opens report link", () => {
    const snapshot = parseLegacyHairAuditLinkMetadataSnapshot({
      audit_report_id: "ha-report-1",
      report_id: REPORT,
    });
    assert.ok(legacyFiAuditReportLinkAvailable(snapshot));
    assert.equal(snapshot.audit_report_id, "ha-report-1");
    assert.equal(snapshot.fi_report_id, REPORT);
  });
});