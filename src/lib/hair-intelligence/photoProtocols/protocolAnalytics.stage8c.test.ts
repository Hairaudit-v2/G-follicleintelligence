import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPhotoProtocolAlerts } from "./protocolAlerts";
import {
  calculatePhotoProtocolAnalytics,
  type PhotoProtocolAnalyticsInput,
} from "./protocolAnalytics";
import { PROTOCOL_STRONG_CAPTURE_MIN_CONFIDENCE } from "./protocolSessionRules";
import type {
  HliPhotoProtocolSession,
  HliPhotoProtocolSessionSlot,
  HliPhotoProtocolSlot,
  HliPhotoProtocolTemplate,
} from "./types";

const TEMPLATE_ID = "00000000-0000-4000-8000-000000000001";

function tpl(overrides: Partial<HliPhotoProtocolTemplate> = {}): HliPhotoProtocolTemplate {
  return {
    id: TEMPLATE_ID,
    slug: "t",
    name: "T",
    description: null,
    source_system_scope: "shared",
    clinical_context: "consultation",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function slotDef(
  p: Partial<HliPhotoProtocolSlot> &
    Pick<HliPhotoProtocolSlot, "id" | "slot_slug" | "label" | "is_required">
): HliPhotoProtocolSlot {
  return {
    protocol_template_id: TEMPLATE_ID,
    required_image_category: "front",
    acceptable_image_categories: null,
    required_surgery_stage: null,
    required_hair_state: null,
    required_shave_state: null,
    sort_order: 0,
    capture_guidance: null,
    quality_guidance: null,
    ...p,
  };
}

function session(
  p: Partial<HliPhotoProtocolSession> & Pick<HliPhotoProtocolSession, "id" | "status">
): HliPhotoProtocolSession {
  return {
    source_system: "fi_os",
    source_record_id: "x",
    tenant_id: "tenant",
    patient_id: "patient-1",
    case_id: null,
    protocol_template_id: TEMPLATE_ID,
    started_at: null,
    completed_at: null,
    created_by_user_id: null,
    metadata: {},
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-06-01T10:00:00Z",
    ...p,
  };
}

function ss(
  p: Partial<HliPhotoProtocolSessionSlot> &
    Pick<HliPhotoProtocolSessionSlot, "id" | "session_id" | "slot_id" | "status">
): HliPhotoProtocolSessionSlot {
  return {
    patient_image_id: null,
    ai_match_confidence: null,
    staff_note: null,
    reviewed_by_user_id: null,
    reviewed_at: null,
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-06-01T10:00:00Z",
    ...p,
  };
}

function inputFrom(
  sessions: HliPhotoProtocolSession[],
  sessionSlots: HliPhotoProtocolSessionSlot[],
  slots: HliPhotoProtocolSlot[]
): PhotoProtocolAnalyticsInput {
  const templatesById = new Map([[TEMPLATE_ID, tpl()]]);
  const slotsByTemplateId = new Map([[TEMPLATE_ID, slots]]);
  return { sessions, sessionSlots, templatesById, slotsByTemplateId };
}

describe("protocolAnalytics (Stage 8C)", () => {
  it("computes completion rate excluding cancelled", () => {
    const slots = [
      slotDef({ id: "s1", slot_slug: "a", label: "A", is_required: true, sort_order: 1 }),
      slotDef({ id: "s2", slot_slug: "b", label: "B", is_required: true, sort_order: 2 }),
    ];
    const sessions = [
      session({ id: "e1", status: "complete" }),
      session({ id: "e2", status: "in_progress" }),
      session({ id: "e3", status: "cancelled" }),
    ];
    const sessionSlots = [
      ss({ id: "1", session_id: "e1", slot_id: "s1", status: "accepted" }),
      ss({ id: "2", session_id: "e1", slot_id: "s2", status: "accepted" }),
      ss({ id: "3", session_id: "e2", slot_id: "s1", status: "missing" }),
      ss({ id: "4", session_id: "e2", slot_id: "s2", status: "missing" }),
    ];
    const r = calculatePhotoProtocolAnalytics(inputFrom(sessions, sessionSlots, slots));
    assert.equal(r.non_cancelled_sessions, 2);
    assert.equal(r.completed_sessions, 1);
    assert.equal(r.protocol_completion_rate, 0.5);
  });

  it("tracks missing required slot frequency (required only)", () => {
    const slots = [
      slotDef({ id: "s1", slot_slug: "front", label: "Front", is_required: true, sort_order: 1 }),
      slotDef({ id: "s2", slot_slug: "crown", label: "Crown", is_required: true, sort_order: 2 }),
    ];
    const sessions = [session({ id: "e1", status: "in_progress" })];
    const sessionSlots = [
      ss({ id: "1", session_id: "e1", slot_id: "s1", status: "missing" }),
      ss({ id: "2", session_id: "e1", slot_id: "s2", status: "missing" }),
    ];
    const r = calculatePhotoProtocolAnalytics(inputFrom(sessions, sessionSlots, slots));
    assert.equal(r.missing_required_slot_frequency.front, 1);
    assert.equal(r.missing_required_slot_frequency.crown, 1);
    assert.equal(r.most_commonly_missed_slot_slug, "front");
  });

  it("does not treat optional slot gaps as session required gaps", () => {
    const slots = [
      slotDef({ id: "s1", slot_slug: "req", label: "Req", is_required: true, sort_order: 1 }),
      slotDef({ id: "s2", slot_slug: "opt", label: "Opt", is_required: false, sort_order: 2 }),
    ];
    const sessions = [session({ id: "e1", status: "complete" })];
    const sessionSlots = [
      ss({ id: "1", session_id: "e1", slot_id: "s1", status: "accepted" }),
      ss({ id: "2", session_id: "e1", slot_id: "s2", status: "missing" }),
    ];
    const r = calculatePhotoProtocolAnalytics(inputFrom(sessions, sessionSlots, slots));
    assert.equal(r.sessions_with_required_gaps, 0);
    assert.deepEqual(r.missing_required_slot_frequency, {});
  });

  it("counts needs review for captured required slots below strong threshold", () => {
    const slots = [
      slotDef({ id: "s1", slot_slug: "front", label: "Front", is_required: true, sort_order: 1 }),
    ];
    const sessions = [session({ id: "e1", status: "in_progress" })];
    const sessionSlots = [
      ss({
        id: "1",
        session_id: "e1",
        slot_id: "s1",
        status: "captured",
        ai_match_confidence: PROTOCOL_STRONG_CAPTURE_MIN_CONFIDENCE - 0.01,
      }),
    ];
    const r = calculatePhotoProtocolAnalytics(inputFrom(sessions, sessionSlots, slots));
    assert.equal(r.needs_review_count, 1);
  });

  it("computes audit readiness score in 0–100 range", () => {
    const slots = [
      slotDef({ id: "s1", slot_slug: "front", label: "Front", is_required: true, sort_order: 1 }),
    ];
    const sessions = [session({ id: "e1", status: "complete" })];
    const sessionSlots = [ss({ id: "1", session_id: "e1", slot_id: "s1", status: "accepted" })];
    const r = calculatePhotoProtocolAnalytics(inputFrom(sessions, sessionSlots, slots));
    assert.ok(r.audit_readiness_score >= 0 && r.audit_readiness_score <= 100);
  });
});

describe("protocolAlerts (Stage 8C)", () => {
  it("emits protocol_incomplete_over_24h for old in_progress sessions", () => {
    const slots = [
      slotDef({ id: "s1", slot_slug: "front", label: "Front", is_required: true, sort_order: 1 }),
    ];
    const slotsByTemplateId = new Map([[TEMPLATE_ID, slots]]);
    const started = "2026-06-01T10:00:00.000Z";
    const now = new Date("2026-06-03T12:00:00.000Z");
    const sessions = [session({ id: "e1", status: "in_progress", started_at: started })];
    const sessionSlots = [
      ss({
        id: "1",
        session_id: "e1",
        slot_id: "s1",
        status: "captured",
        ai_match_confidence: 0.9,
      }),
    ];
    const alerts = buildPhotoProtocolAlerts({ sessions, sessionSlots, slotsByTemplateId, now });
    const t = alerts.find((a) => a.type === "protocol_incomplete_over_24h");
    assert.ok(t);
    assert.equal(t?.session_id, "e1");
  });

  it("emits needs_retake alert when required slot flagged", () => {
    const slots = [
      slotDef({ id: "s1", slot_slug: "front", label: "Front", is_required: true, sort_order: 1 }),
    ];
    const slotsByTemplateId = new Map([[TEMPLATE_ID, slots]]);
    const sessions = [
      session({ id: "e1", status: "in_progress", started_at: new Date().toISOString() }),
    ];
    const sessionSlots = [ss({ id: "1", session_id: "e1", slot_id: "s1", status: "needs_retake" })];
    const alerts = buildPhotoProtocolAlerts({ sessions, sessionSlots, slotsByTemplateId });
    assert.ok(alerts.some((a) => a.type === "needs_retake"));
  });
});
