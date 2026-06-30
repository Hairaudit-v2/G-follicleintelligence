import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculatePhotoProtocolCompliance } from "./protocolCompliance";
import { compareMatchQuality, scoreImageForProtocolSlot } from "./protocolSlotMatching";
import {
  canCompleteRequiredSessionSlots,
  PROTOCOL_STRONG_CAPTURE_MIN_CONFIDENCE,
} from "./protocolSessionRules";
import type {
  HliPhotoProtocolSessionSlot,
  HliPhotoProtocolSlot,
  HliPhotoProtocolTemplate,
  ProtocolComplianceImage,
} from "./types";

const TEMPLATE_ID = "00000000-0000-4000-8000-000000000001";

function baseTemplate(overrides: Partial<HliPhotoProtocolTemplate> = {}): HliPhotoProtocolTemplate {
  return {
    id: TEMPLATE_ID,
    slug: "test_template",
    name: "Test",
    description: null,
    source_system_scope: "shared",
    clinical_context: "consultation",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function slot(
  p: Partial<HliPhotoProtocolSlot> & Pick<HliPhotoProtocolSlot, "id" | "slot_slug" | "label">
): HliPhotoProtocolSlot {
  return {
    protocol_template_id: TEMPLATE_ID,
    required_image_category: "front",
    acceptable_image_categories: null,
    required_surgery_stage: null,
    required_hair_state: null,
    required_shave_state: null,
    sort_order: 0,
    is_required: true,
    capture_guidance: null,
    quality_guidance: null,
    ...p,
  };
}

function img(
  p: Partial<ProtocolComplianceImage> & Pick<ProtocolComplianceImage, "id">
): ProtocolComplianceImage {
  return {
    ai_image_category: "front",
    ai_image_category_confidence: 0.95,
    ai_hair_state: null,
    ai_shave_state: null,
    ai_surgery_stage: "pre_op",
    ai_image_review_status: "accepted",
    ...p,
  };
}

describe("calculatePhotoProtocolCompliance (Stage 8B)", () => {
  it("reports complete when all required categories have strong matches", () => {
    const slots: HliPhotoProtocolSlot[] = [
      slot({
        id: "00000000-0000-4000-8000-000000000011",
        slot_slug: "front",
        label: "Front",
        required_image_category: "front",
        sort_order: 1,
      }),
      slot({
        id: "00000000-0000-4000-8000-000000000012",
        slot_slug: "donor",
        label: "Donor",
        required_image_category: "donor",
        sort_order: 2,
      }),
    ];
    const images: ProtocolComplianceImage[] = [
      img({
        id: "00000000-0000-4000-8000-0000000000a1",
        ai_image_category: "front",
        ai_surgery_stage: "pre_op",
      }),
      img({
        id: "00000000-0000-4000-8000-0000000000a2",
        ai_image_category: "donor",
        ai_surgery_stage: "pre_op",
      }),
    ];
    const r = calculatePhotoProtocolCompliance({
      template: baseTemplate(),
      slots,
      images,
    });
    assert.equal(r.complete, true);
    assert.equal(r.missing_count, 0);
    assert.equal(r.captured_count, 2);
  });

  it("reports missing slots when required category is absent", () => {
    const slots: HliPhotoProtocolSlot[] = [
      slot({
        id: "00000000-0000-4000-8000-000000000021",
        slot_slug: "crown",
        label: "Crown",
        required_image_category: "crown",
        sort_order: 1,
      }),
    ];
    const images: ProtocolComplianceImage[] = [
      img({ id: "00000000-0000-4000-8000-0000000000b1", ai_image_category: "front" }),
    ];
    const r = calculatePhotoProtocolCompliance({ template: baseTemplate(), slots, images });
    assert.equal(r.complete, false);
    assert.equal(r.missing_count, 1);
    assert.ok(r.missing_slots.some((s) => s.slot_slug === "crown"));
  });

  it("does not let unknown category satisfy a required slot", () => {
    const slots: HliPhotoProtocolSlot[] = [
      slot({
        id: "00000000-0000-4000-8000-000000000031",
        slot_slug: "front",
        label: "Front",
        required_image_category: "front",
        sort_order: 1,
      }),
    ];
    const images: ProtocolComplianceImage[] = [
      img({
        id: "00000000-0000-4000-8000-0000000000c1",
        ai_image_category: "unknown",
        ai_image_category_confidence: 0.99,
      }),
    ];
    const r = calculatePhotoProtocolCompliance({ template: baseTemplate(), slots, images });
    assert.equal(r.missing_count, 1);
  });

  it("optional slots do not block completion", () => {
    const slots: HliPhotoProtocolSlot[] = [
      slot({
        id: "00000000-0000-4000-8000-000000000041",
        slot_slug: "front",
        label: "Front",
        required_image_category: "front",
        is_required: true,
        sort_order: 1,
      }),
      slot({
        id: "00000000-0000-4000-8000-000000000042",
        slot_slug: "graft_tray",
        label: "Graft tray",
        required_image_category: "graft_tray",
        is_required: false,
        sort_order: 2,
      }),
    ];
    const images: ProtocolComplianceImage[] = [
      img({ id: "00000000-0000-4000-8000-0000000000d1", ai_image_category: "front" }),
    ];
    const r = calculatePhotoProtocolCompliance({ template: baseTemplate(), slots, images });
    assert.equal(r.complete, true);
    assert.equal(r.missing_count, 0);
  });
});

describe("compareMatchQuality", () => {
  it("ranks accepted ahead of pending at similar confidence", () => {
    const pending = img({
      id: "00000000-0000-4000-8000-0000000000e1",
      ai_image_review_status: "pending",
      ai_image_category_confidence: 0.95,
    });
    const accepted = img({
      id: "00000000-0000-4000-8000-0000000000e2",
      ai_image_review_status: "accepted",
      ai_image_category_confidence: 0.5,
    });
    assert.ok(compareMatchQuality(accepted, pending) < 0, "accepted should sort before pending");
  });
});

describe("scoreImageForProtocolSlot — surgery stage", () => {
  it("scores higher when surgery stage matches required slot", () => {
    const sl: HliPhotoProtocolSlot = slot({
      id: "00000000-0000-4000-8000-000000000051",
      slot_slug: "pre_front",
      label: "Pre-op front",
      required_image_category: "front",
      required_surgery_stage: "pre_op",
      sort_order: 1,
    });
    const match = img({
      id: "00000000-0000-4000-8000-0000000000f1",
      ai_image_category: "front",
      ai_surgery_stage: "pre_op",
      ai_image_category_confidence: 0.9,
      ai_image_review_status: "pending",
    });
    const mismatch = img({
      id: "00000000-0000-4000-8000-0000000000f2",
      ai_image_category: "front",
      ai_surgery_stage: "follow_up",
      ai_image_category_confidence: 0.9,
      ai_image_review_status: "pending",
    });
    const sMatch = scoreImageForProtocolSlot(sl, match).score;
    const sMiss = scoreImageForProtocolSlot(sl, mismatch).score;
    assert.ok(sMatch > sMiss);
  });
});

describe("canCompleteRequiredSessionSlots", () => {
  const def = (id: string, required: boolean): HliPhotoProtocolSlot =>
    slot({
      id,
      slot_slug: id.slice(0, 8),
      label: id,
      is_required: required,
      required_image_category: "front",
    });

  it("returns true when required slots are accepted or strongly captured", () => {
    const slotsById = new Map<string, HliPhotoProtocolSlot>([
      ["00000000-0000-4000-8000-000000000061", def("00000000-0000-4000-8000-000000000061", true)],
      ["00000000-0000-4000-8000-000000000062", def("00000000-0000-4000-8000-000000000062", false)],
    ]);
    const sessionSlots: HliPhotoProtocolSessionSlot[] = [
      {
        id: "00000000-0000-4000-8000-000000000071",
        session_id: "00000000-0000-4000-8000-000000000099",
        slot_id: "00000000-0000-4000-8000-000000000061",
        patient_image_id: "00000000-0000-4000-8000-0000000000aa",
        status: "captured",
        ai_match_confidence: PROTOCOL_STRONG_CAPTURE_MIN_CONFIDENCE,
        staff_note: null,
        reviewed_by_user_id: null,
        reviewed_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000072",
        session_id: "00000000-0000-4000-8000-000000000099",
        slot_id: "00000000-0000-4000-8000-000000000062",
        patient_image_id: null,
        status: "missing",
        ai_match_confidence: null,
        staff_note: null,
        reviewed_by_user_id: null,
        reviewed_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    assert.equal(canCompleteRequiredSessionSlots({ sessionSlots, slotsById }), true);
  });

  it("returns false when a required slot is missing", () => {
    const slotsById = new Map<string, HliPhotoProtocolSlot>([
      ["00000000-0000-4000-8000-000000000081", def("00000000-0000-4000-8000-000000000081", true)],
    ]);
    const sessionSlots: HliPhotoProtocolSessionSlot[] = [
      {
        id: "00000000-0000-4000-8000-000000000091",
        session_id: "00000000-0000-4000-8000-000000000099",
        slot_id: "00000000-0000-4000-8000-000000000081",
        patient_image_id: null,
        status: "missing",
        ai_match_confidence: null,
        staff_note: null,
        reviewed_by_user_id: null,
        reviewed_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    assert.equal(canCompleteRequiredSessionSlots({ sessionSlots, slotsById }), false);
  });
});
