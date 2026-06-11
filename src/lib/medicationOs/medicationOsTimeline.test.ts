import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTherapyTimelineDetail,
  defaultTitleForTherapyTimelineKind,
  isLowSignalTherapyEventType,
  mapTherapyEventToTimelineKind,
} from "./medicationOsTimeline.server";

describe("medicationOsTimeline (pure)", () => {
  describe("mapTherapyEventToTimelineKind", () => {
    it("maps plan_activated", () => {
      assert.equal(mapTherapyEventToTimelineKind("plan_activated"), "therapy.plan_activated");
    });
    it("maps therapy_started to maintenance_started", () => {
      assert.equal(mapTherapyEventToTimelineKind("therapy_started"), "therapy.maintenance_started");
    });
    it("maps session_completed", () => {
      assert.equal(mapTherapyEventToTimelineKind("session_completed"), "therapy.procedure_session_completed");
    });
    it("maps plan_completed for post_operative to postop_protocol_completed", () => {
      assert.equal(mapTherapyEventToTimelineKind("plan_completed", "post_operative"), "therapy.postop_protocol_completed");
    });
    it("maps plan_completed for other plan types to plan_completed", () => {
      assert.equal(mapTherapyEventToTimelineKind("plan_completed", "maintenance"), "therapy.plan_completed");
    });
    it("maps plan_cancelled and plan_superseded to plan_stopped", () => {
      assert.equal(mapTherapyEventToTimelineKind("plan_cancelled"), "therapy.plan_stopped");
      assert.equal(mapTherapyEventToTimelineKind("plan_superseded"), "therapy.plan_stopped");
    });
    it("maps pathology_gate_cleared and adverse_event", () => {
      assert.equal(mapTherapyEventToTimelineKind("pathology_gate_cleared"), "therapy.pathology_gate_cleared");
      assert.equal(mapTherapyEventToTimelineKind("adverse_event"), "therapy.adverse_event");
    });
    it("returns null for adherence_note and other unmapped types", () => {
      assert.equal(mapTherapyEventToTimelineKind("adherence_note"), null);
      assert.equal(mapTherapyEventToTimelineKind("plan_created"), null);
    });
  });

  describe("buildTherapyTimelineDetail", () => {
    it("includes source_table, source_id, therapy_event_id, and plan refs", () => {
      const d = buildTherapyTimelineDetail({
        therapyEventId: "e1-e1-e1-e1-e1e1e1e1e1e1",
        plan_id: "p1",
        plan_item_id: "i1",
        canonical_code: "prp",
      });
      assert.equal(d.source_table, "fi_patient_therapy_events");
      assert.equal(d.source_id, "e1-e1-e1-e1-e1e1e1e1e1e1");
      assert.equal(d.therapy_event_id, "e1-e1-e1-e1-e1e1e1e1e1e1");
      assert.equal(d.plan_id, "p1");
      assert.equal(d.plan_item_id, "i1");
      assert.equal(d.canonical_code, "prp");
      assert.equal(d.medication_os, true);
    });
  });

  describe("defaultTitleForTherapyTimelineKind", () => {
    it("returns a non-empty title for known kinds", () => {
      assert.ok(defaultTitleForTherapyTimelineKind("therapy.plan_activated").length > 0);
    });
  });

  describe("isLowSignalTherapyEventType", () => {
    it("flags adherence_note as low-signal", () => {
      assert.equal(isLowSignalTherapyEventType("adherence_note"), true);
      assert.equal(isLowSignalTherapyEventType("plan_activated"), false);
    });
  });
});
