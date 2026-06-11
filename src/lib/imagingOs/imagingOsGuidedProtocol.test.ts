import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildGuidedImageUploadFields, assertGuidedSessionUploadPreconditions } from "./imagingOsGuidedFields";
import {
  assertSlotBelongsToTemplate,
  mergeProgressForSlotCapture,
  missingRequiredSlotSlugs,
  protocolRequiredCompletionPercent,
  type ProtocolSlotDef,
} from "./imagingOsProtocol";

const sampleSlots: ProtocolSlotDef[] = [
  { slug: "a", label: "A", required: true },
  { slug: "b", label: "B", required: true },
  { slug: "c", label: "C", required: false, suggested_region: "donor" },
];

describe("buildGuidedImageUploadFields", () => {
  it("maps template slug to axis, visit type, and slot metadata", () => {
    const f = buildGuidedImageUploadFields({
      templateSlug: "hair_loss_consultation",
      slotSlug: "global_front",
      deviceType: "ipad",
      clinicId: "  ",
      capturedByStaffId: null,
      suggestedRegion: "hairline",
    });
    assert.equal(f.imaging_library_axis, "consultation");
    assert.equal(f.visit_type, "guided:hair_loss_consultation");
    assert.equal(f.imaging_protocol_template_slug, "hair_loss_consultation");
    assert.equal(f.imaging_protocol_slot_slug, "global_front");
    assert.equal(f.device_type, "ipad");
    assert.equal(f.anatomical_region, "hairline");
    assert.equal(f.clinic_id, null);
    assert.equal(f.captured_by_staff_id, null);
  });
});

describe("mergeProgressForSlotCapture + completion", () => {
  it("updates progress and required completion after a slot capture", () => {
    const before = { __meta__: { status: "active" as const } };
    const next = mergeProgressForSlotCapture.apply(before, "a", "img-1");
    assert.equal(protocolRequiredCompletionPercent(sampleSlots, next), 50);
    assert.deepEqual(missingRequiredSlotSlugs(sampleSlots, next), ["b"]);
  });
});

describe("assertGuidedSessionUploadPreconditions", () => {
  it("throws when tenant or patient is blank", () => {
    assert.throws(() =>
      assertGuidedSessionUploadPreconditions({
        tenantId: "",
        patientId: "p",
        protocolSessionId: "00000000-0000-4000-8000-000000000001",
        slotSlug: "a",
      })
    );
    assert.throws(() =>
      assertGuidedSessionUploadPreconditions({
        tenantId: "t",
        patientId: "  ",
        protocolSessionId: "00000000-0000-4000-8000-000000000001",
        slotSlug: "a",
      })
    );
  });

  it("throws when session id is not a UUID", () => {
    assert.throws(() =>
      assertGuidedSessionUploadPreconditions({
        tenantId: "t",
        patientId: "p",
        protocolSessionId: "not-a-uuid",
        slotSlug: "a",
      })
    );
  });

  it("throws when slot slug missing for guided upload", () => {
    assert.throws(() =>
      assertGuidedSessionUploadPreconditions({
        tenantId: "t",
        patientId: "p",
        protocolSessionId: "00000000-0000-4000-8000-000000000001",
        slotSlug: "",
      })
    );
  });
});

describe("assertSlotBelongsToTemplate", () => {
  it("throws when slot is unknown", () => {
    assert.throws(() => assertSlotBelongsToTemplate(sampleSlots, "unknown"));
  });
});
