import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildGraftTrayCaptureContext,
  buildGraftTrayImageMetadataPatch,
  buildGraftTrayLinkInsertRow,
  isGraftTrayLinkEligible,
  mergeGraftTrayImageMetadata,
  parseGraftTrayCaptureContext,
  resolveGraftTrayCaptureContext,
  validateGraftTrayCaptureContext,
} from "./graftTrayCaptureContext";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PATIENT = "33333333-3333-4333-8333-333333333333";
const IMAGE = "55555555-5555-4555-8555-555555555555";
const CASE = "22222222-2222-4222-8222-222222222222";
const BOOKING = "44444444-4444-4444-8444-444444444444";
const SURGERY = "66666666-6666-4666-8666-666666666666";
const SESSION = "77777777-7777-4777-8777-777777777777";
const LINK_ID = "99999999-9999-4999-8999-999999999999";
const STAFF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const representativeFlat = {
  tenantId: TENANT,
  patientId: PATIENT,
  imageId: IMAGE,
  protocolSessionId: SESSION,
  protocolSlotSlug: "graft_tray_overview",
  imageCategory: "graft_tray",
  anatomicalRegion: "graft_tray",
  caseId: CASE,
  bookingId: BOOKING,
  surgeryId: SURGERY,
  capturedByStaffId: STAFF,
  captureSource: "surgery_os",
  metadata: {
    protocol_template_slug: "surgery_day",
    surgery_context: { surgery_id: SURGERY, case_id: CASE, booking_id: BOOKING },
    existing_field: "keep-me",
  },
  qualityNeedsReview: false,
};

describe("parseGraftTrayCaptureContext", () => {
  it("parses old flat input into grouped GraftTrayCaptureContext", () => {
    const ctx = parseGraftTrayCaptureContext(representativeFlat);
    assert.equal(ctx.tenantId, TENANT);
    assert.equal(ctx.patientId, PATIENT);
    assert.equal(ctx.imageId, IMAGE);
    assert.equal(ctx.slot.protocolSessionId, SESSION);
    assert.equal(ctx.slot.protocolSlotSlug, "graft_tray_overview");
    assert.equal(ctx.slot.imageCategory, "graft_tray");
    assert.equal(ctx.slot.anatomicalRegion, "graft_tray");
    assert.equal(ctx.surgeryContext.caseId, CASE);
    assert.equal(ctx.surgeryContext.bookingId, BOOKING);
    assert.equal(ctx.surgeryContext.surgeryId, SURGERY);
    assert.equal(ctx.surgeryContext.capturedByStaffId, STAFF);
    assert.equal(ctx.capture.captureSource, "surgery_os");
    assert.equal(ctx.capture.qualityNeedsReview, false);
    assert.deepEqual(ctx.capture.metadata?.existing_field, "keep-me");
    assert.equal(validateGraftTrayCaptureContext(ctx).valid, true);
  });

  it("preserves surgery context fields from metadata when flat fields omitted", () => {
    const ctx = parseGraftTrayCaptureContext({
      tenantId: TENANT,
      patientId: PATIENT,
      imageId: IMAGE,
      protocolSlotSlug: "graft_tray",
      metadata: {
        vie_surgery_context: {
          case_id: CASE,
          booking_id: BOOKING,
          procedure_day_id: "day-1",
        },
      },
    });
    assert.equal(ctx.surgeryContext.caseId, CASE);
    assert.equal(ctx.surgeryContext.bookingId, BOOKING);
    assert.equal(ctx.surgeryContext.procedureDayId, "day-1");
  });

  it("marks non-graft-tray flat input as ineligible without throwing", () => {
    const ctx = parseGraftTrayCaptureContext({
      tenantId: TENANT,
      patientId: PATIENT,
      imageId: IMAGE,
      protocolSlotSlug: "donor_final_extraction",
    });
    assert.equal(isGraftTrayLinkEligible(ctx), false);
  });

  it("resolveGraftTrayCaptureContext accepts pre-built grouped context", () => {
    const grouped = buildGraftTrayCaptureContext(representativeFlat);
    assert.deepEqual(resolveGraftTrayCaptureContext(grouped), grouped);
  });
});

describe("graft tray link payload builders", () => {
  it("buildGraftTrayLinkInsertRow matches representative flat-derived payload", () => {
    const ctx = parseGraftTrayCaptureContext(representativeFlat);
    const row = buildGraftTrayLinkInsertRow(ctx, {
      surgeryId: SURGERY,
      graftSessionId: "gs-1",
      linkId: LINK_ID,
      capturedAt: "2026-07-04T12:00:00.000Z",
    });

    assert.equal(row.tenant_id, TENANT);
    assert.equal(row.patient_id, PATIENT);
    assert.equal(row.image_id, IMAGE);
    assert.equal(row.surgery_case_id, CASE);
    assert.equal(row.surgery_id, SURGERY);
    assert.equal(row.booking_id, BOOKING);
    assert.equal(row.graft_session_id, "gs-1");
    assert.equal(row.protocol_session_id, SESSION);
    assert.equal(row.protocol_slot_slug, "graft_tray_overview");
    assert.equal(row.captured_by_staff_id, STAFF);
    assert.equal(row.status, "linked");
    assert.equal(row.review_required, true);
    assert.equal(row.metadata.capture_source, "surgery_os");
    assert.equal(row.metadata.slot_variant, "graft_tray_overview");
    assert.ok(Array.isArray(row.metadata.review_reasons));
  });

  it("qualityNeedsReview sets review_required link status", () => {
    const ctx = parseGraftTrayCaptureContext({
      ...representativeFlat,
      qualityNeedsReview: true,
    });
    const row = buildGraftTrayLinkInsertRow(ctx, {
      surgeryId: SURGERY,
      graftSessionId: null,
      linkId: LINK_ID,
      capturedAt: "2026-07-04T12:00:00.000Z",
    });
    assert.equal(row.status, "review_required");
    assert.ok(
      (row.metadata.review_reasons as string[]).includes("graft_tray_quality_review")
    );
  });

  it("mergeGraftTrayImageMetadata preserves existing metadata fields", () => {
    const ctx = parseGraftTrayCaptureContext(representativeFlat);
    const patch = buildGraftTrayImageMetadataPatch(ctx, LINK_ID);
    const merged = mergeGraftTrayImageMetadata(ctx.capture.metadata, patch);

    assert.equal(merged.existing_field, "keep-me");
    assert.equal(merged.graft_tray_link_id, LINK_ID);
    assert.equal(merged.graft_tray_reconciliation_evidence, true);
    assert.equal(merged.graft_tray_slot_variant, "graft_tray_overview");
    assert.ok(Array.isArray(merged.graft_tray_review_reasons));
  });

  it("flat and grouped contexts produce identical link insert rows", () => {
    const fromFlat = parseGraftTrayCaptureContext(representativeFlat);
    const grouped = buildGraftTrayCaptureContext(representativeFlat);
    const resolved = {
      surgeryId: SURGERY,
      graftSessionId: "gs-1",
      linkId: LINK_ID,
      capturedAt: "2026-07-04T12:00:00.000Z",
    };
    assert.deepEqual(
      buildGraftTrayLinkInsertRow(fromFlat, resolved),
      buildGraftTrayLinkInsertRow(grouped, resolved)
    );
  });
});