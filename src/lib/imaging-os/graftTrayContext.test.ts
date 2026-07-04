import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractGraftTraySurgeryLinkage,
  isGraftTrayCapture,
  normalizeGraftTraySlotSlug,
  resolveGraftTraySlotVariant,
} from "./imagingGraftTrayBridgeCore";
import { parseGraftTrayLinkContext, validateGraftTrayCaptureContext } from "./parseGraftTrayLinkContext";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PATIENT = "33333333-3333-4333-8333-333333333333";
const IMAGE = "55555555-5555-4555-8555-555555555555";
const CASE = "22222222-2222-4222-8222-222222222222";
const BOOKING = "44444444-4444-4444-8444-444444444444";
const SURGERY = "66666666-6666-4666-8666-666666666666";
const SESSION = "77777777-7777-4777-8777-777777777777";

const baseFlat = {
  tenantId: TENANT,
  patientId: PATIENT,
  imageId: IMAGE,
  captureSource: "surgery_os",
};

describe("graft tray slot normalization", () => {
  it("recognizes graft_tray overview and close variants", () => {
    assert.equal(normalizeGraftTraySlotSlug("graft_tray_overview"), "graft_tray_overview");
    assert.equal(normalizeGraftTraySlotSlug("graft_tray_close"), "graft_tray_close");
    assert.equal(isGraftTrayCapture({ protocolSlotSlug: "graft_tray_overview" }), true);
    assert.equal(isGraftTrayCapture({ protocolSlotSlug: "graft_tray_close" }), true);
    assert.equal(isGraftTrayCapture({ protocolSlotSlug: "donor_final" }), false);
  });

  it("resolves slot variant from vie_surgery_context metadata", () => {
    assert.equal(
      resolveGraftTraySlotVariant({
        metadata: {
          vie_surgery_context: { slot_slug: "graft_tray_overview" },
        },
      }),
      "graft_tray_overview"
    );
    assert.equal(
      isGraftTrayCapture({
        metadata: {
          vie_surgery_context: { slot_slug: "graft_tray_close" },
        },
      }),
      true
    );
  });
});

describe("parseGraftTrayLinkContext", () => {
  it("parses surgery_os graft_tray_overview into GraftTrayCaptureContext", () => {
    const ctx = parseGraftTrayLinkContext({
      ...baseFlat,
      protocolSessionId: SESSION,
      protocolSlotSlug: "graft_tray_overview",
      caseId: CASE,
      bookingId: BOOKING,
      metadata: {
        protocol_template_slug: "surgery_day",
        vie_surgery_context: {
          case_id: CASE,
          booking_id: BOOKING,
          slot_slug: "graft_tray_overview",
          capture_surface: "surgery_os",
        },
      },
    });
    assert.ok(ctx);
    assert.equal(ctx.kind, "graft_tray_capture");
    assert.equal(ctx.slot_variant, "graft_tray_overview");
    assert.equal(ctx.protocol.protocol_slot_slug, "graft_tray_overview");
    assert.equal(ctx.surgery.case_id, CASE);
    assert.equal(ctx.surgery.booking_id, BOOKING);
    assert.equal(validateGraftTrayCaptureContext(ctx).valid, true);
  });

  it("extracts surgery linkage from surgery_context metadata", () => {
    const linkage = extractGraftTraySurgeryLinkage({
      surgery_context: {
        surgery_id: SURGERY,
        case_id: CASE,
        booking_id: BOOKING,
        procedure_day_id: "day-1",
      },
    });
    assert.equal(linkage.surgery_id, SURGERY);
    assert.equal(linkage.case_id, CASE);
    assert.equal(linkage.procedure_day_id, "day-1");

    const ctx = parseGraftTrayLinkContext({
      ...baseFlat,
      protocolSlotSlug: "graft_tray",
      metadata: {
        surgery_context: linkage,
      },
    });
    assert.ok(ctx);
    assert.equal(ctx.surgery.surgery_id, SURGERY);
  });

  it("returns null for non-graft-tray captures", () => {
    const ctx = parseGraftTrayLinkContext({
      ...baseFlat,
      protocolSlotSlug: "donor_final_extraction",
    });
    assert.equal(ctx, null);
  });

  it("validates missing surgery linkage", () => {
    const ctx = parseGraftTrayLinkContext({
      ...baseFlat,
      protocolSlotSlug: "graft_tray_overview",
    });
    assert.ok(ctx);
    assert.equal(validateGraftTrayCaptureContext(ctx).valid, false);
  });
});