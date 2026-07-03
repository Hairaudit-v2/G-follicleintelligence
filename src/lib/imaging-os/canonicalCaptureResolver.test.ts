import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertCanonicalStaffCaptureSource,
  buildCanonicalCaptureAuditMetadata,
  isCanonicalCaptureLegacyExempt,
  resolveTemplateSlugForCaptureContext,
  staffCaptureRequiresProtocolSession,
} from "./canonicalCaptureResolverCore";

describe("canonicalCaptureResolverCore", () => {
  it("rejects empty capture source for staff uploads", () => {
    assert.throws(() => assertCanonicalStaffCaptureSource(""), /capture source/i);
  });

  it("exempts legacy follow-up sources from protocol auto-resolve", () => {
    assert.equal(isCanonicalCaptureLegacyExempt("legacy_follow_up"), true);
    assert.equal(isCanonicalCaptureLegacyExempt("follow_up_encounter"), true);
    assert.equal(staffCaptureRequiresProtocolSession("legacy_follow_up"), false);
  });

  it("requires protocol session for surgery and appointment capture", () => {
    assert.equal(staffCaptureRequiresProtocolSession("surgery_os"), true);
    assert.equal(staffCaptureRequiresProtocolSession("appointment_procedure"), true);
    assert.equal(staffCaptureRequiresProtocolSession("hairaudit"), false);
  });

  it("resolves template slug from capture context", () => {
    assert.equal(
      resolveTemplateSlugForCaptureContext({
        captureSource: "surgery_os",
        templateSlugFromRequest: null,
      }),
      "surgery_day"
    );
    assert.equal(
      resolveTemplateSlugForCaptureContext({
        captureSource: "appointment_procedure",
        templateSlugFromRequest: null,
        bookingType: "follow_up_review",
      }),
      "follow_up_review"
    );
    assert.equal(
      resolveTemplateSlugForCaptureContext({
        captureSource: "consultation_os",
        templateSlugFromRequest: "custom_protocol",
      }),
      "custom_protocol"
    );
  });

  it("builds canonical audit metadata with catalog source", () => {
    const meta = buildCanonicalCaptureAuditMetadata({
      captureSource: "surgery_os",
      protocolCatalogSource: "imaging_os_db",
      protocolTemplateSlug: "surgery_day",
      sessionCreated: true,
    });
    assert.equal(meta.canonical_capture_enforced, true);
    assert.equal(meta.canonical_capture_source, "surgery_os");
    assert.equal(meta.protocol_catalog_source, "imaging_os_db");
    assert.equal(meta.canonical_session_created, true);
  });
});