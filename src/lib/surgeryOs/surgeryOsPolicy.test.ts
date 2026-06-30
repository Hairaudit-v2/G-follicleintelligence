import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertSurgeryMajorPhaseTransition,
  assertTeamAssignmentStatusTransition,
  canTransitionSurgeryMajorPhase,
  canTransitionTeamAssignmentStatus,
  eventKindToSurgeryPatch,
  nextMajorPhase,
  parseTargetGraftsFromEstimate,
  resolveCurrentMajorPhase,
  resolveSurgeryOsStaffRoleCategory,
  surgeryOsActionAllowed,
  surgeryOsGraftActionAllowed,
  surgeryOsNoteKindAllowed,
  surgeryOsTeamStatusUpdateAllowed,
} from "@/src/lib/surgeryOs/surgeryOsPolicy";

describe("surgeryOsPolicy", () => {
  it("allows valid major phase transitions along the theatre chain", () => {
    assert.equal(canTransitionSurgeryMajorPhase("scheduled", "pre_op"), true);
    assert.equal(canTransitionSurgeryMajorPhase("pre_op", "anaesthetic"), true);
    assert.equal(canTransitionSurgeryMajorPhase("implantation", "recovery"), true);
    assert.equal(canTransitionSurgeryMajorPhase("recovery", "complete"), true);
    assert.equal(canTransitionSurgeryMajorPhase("scheduled", "extraction"), false);
    assert.doesNotThrow(() => assertSurgeryMajorPhaseTransition("extraction", "break"));
    assert.throws(() => assertSurgeryMajorPhaseTransition("complete", "recovery"));
  });

  it("resolves current major phase from surgery row state", () => {
    assert.equal(
      resolveCurrentMajorPhase({ status: "scheduled", procedurePhase: "pre_op" }),
      "scheduled"
    );
    assert.equal(
      resolveCurrentMajorPhase({ status: "pre_op", procedurePhase: "design" }),
      "pre_op"
    );
    assert.equal(
      resolveCurrentMajorPhase({ status: "in_progress", procedurePhase: "extraction" }),
      "extraction"
    );
    assert.equal(
      resolveCurrentMajorPhase({ status: "in_progress", procedurePhase: "recovery" }),
      "recovery"
    );
    assert.equal(
      resolveCurrentMajorPhase({ status: "completed", procedurePhase: "completed" }),
      "complete"
    );
  });

  it("returns next major phase in sequence", () => {
    assert.equal(nextMajorPhase("scheduled"), "pre_op");
    assert.equal(nextMajorPhase("recovery"), "complete");
    assert.equal(nextMajorPhase("complete"), null);
  });

  it("maps live events to surgery state patches", () => {
    const extraction = eventKindToSurgeryPatch("extraction_started");
    assert.equal(extraction?.procedurePhase, "extraction");
    assert.equal(extraction?.liveStatus, "active");
    const completed = eventKindToSurgeryPatch("procedure_completed");
    assert.equal(completed?.status, "completed");
    assert.equal(eventKindToSurgeryPatch("custom"), null);
  });

  it("parses target grafts from booking estimate strings", () => {
    assert.equal(parseTargetGraftsFromEstimate("3,500 grafts"), 3500);
    assert.equal(parseTargetGraftsFromEstimate("2800"), 2800);
    assert.equal(parseTargetGraftsFromEstimate(""), null);
    assert.equal(parseTargetGraftsFromEstimate("TBD"), null);
  });

  it("gates actions by viewer role and staff category", () => {
    const surgeonCtx = {
      viewerRole: "surgeon" as const,
      staffRoleCategory: null,
      actorFiUserId: "u1",
    };
    const nurseCtx = {
      viewerRole: "coordinator" as const,
      staffRoleCategory: "nurse" as const,
      actorFiUserId: "u2",
    };
    const techCtx = {
      viewerRole: "coordinator" as const,
      staffRoleCategory: "technician" as const,
      actorFiUserId: "u3",
    };
    const coordCtx = {
      viewerRole: "coordinator" as const,
      staffRoleCategory: null,
      actorFiUserId: "u4",
    };

    assert.equal(surgeryOsActionAllowed(surgeonCtx, "transition_phase"), true);
    assert.equal(surgeryOsActionAllowed(nurseCtx, "log_event"), true);
    assert.equal(surgeryOsActionAllowed(nurseCtx, "transition_phase"), false);
    assert.equal(surgeryOsActionAllowed(techCtx, "add_note"), true);
    assert.equal(surgeryOsActionAllowed(techCtx, "log_event"), false);
    assert.equal(surgeryOsActionAllowed(coordCtx, "create_from_booking"), true);
    assert.equal(surgeryOsNoteKindAllowed(techCtx, "graft_issue"), true);
    assert.equal(surgeryOsNoteKindAllowed(techCtx, "medication_administered"), false);
  });

  it("allows technician self team status updates only", () => {
    const techCtx = {
      viewerRole: "coordinator" as const,
      staffRoleCategory: "technician" as const,
      actorFiUserId: "tech-1",
    };
    assert.equal(surgeryOsTeamStatusUpdateAllowed(techCtx, "tech-1"), true);
    assert.equal(surgeryOsTeamStatusUpdateAllowed(techCtx, "other-1"), false);
  });

  it("allows valid team assignment status transitions", () => {
    assert.equal(canTransitionTeamAssignmentStatus("assigned", "checked_in"), true);
    assert.equal(canTransitionTeamAssignmentStatus("active", "completed"), true);
    assert.equal(canTransitionTeamAssignmentStatus("completed", "active"), false);
    assert.doesNotThrow(() => assertTeamAssignmentStatusTransition("checked_in", "active"));
    assert.throws(() => assertTeamAssignmentStatusTransition("completed", "active"));
  });

  it("resolves staff role categories from staff_role strings", () => {
    assert.equal(resolveSurgeryOsStaffRoleCategory("Senior Nurse"), "nurse");
    assert.equal(resolveSurgeryOsStaffRoleCategory("Graft Technician"), "technician");
    assert.equal(resolveSurgeryOsStaffRoleCategory("Lead Surgeon"), "surgeon");
    assert.equal(resolveSurgeryOsStaffRoleCategory(null), null);
  });

  it("gates graft actions by role", () => {
    const surgeonCtx = {
      viewerRole: "surgeon" as const,
      staffRoleCategory: null,
      actorFiUserId: "u1",
    };
    const nurseCtx = {
      viewerRole: "coordinator" as const,
      staffRoleCategory: "nurse" as const,
      actorFiUserId: "u2",
    };
    const techCtx = {
      viewerRole: "coordinator" as const,
      staffRoleCategory: "technician" as const,
      actorFiUserId: "u3",
    };
    const coordCtx = {
      viewerRole: "coordinator" as const,
      staffRoleCategory: null,
      actorFiUserId: "u4",
    };
    const adminCtx = { viewerRole: "admin" as const, staffRoleCategory: null, actorFiUserId: "u5" };

    assert.equal(surgeryOsGraftActionAllowed(surgeonCtx, "correct_graft_count"), true);
    assert.equal(surgeryOsGraftActionAllowed(adminCtx, "reconcile_grafts"), true);
    assert.equal(surgeryOsGraftActionAllowed(nurseCtx, "add_extraction_count"), true);
    assert.equal(surgeryOsGraftActionAllowed(nurseCtx, "enter_tray_count"), false);
    assert.equal(surgeryOsGraftActionAllowed(nurseCtx, "confirm_tray_count"), true);
    assert.equal(surgeryOsGraftActionAllowed(techCtx, "enter_tray_count"), true);
    assert.equal(surgeryOsGraftActionAllowed(techCtx, "confirm_tray_count"), false);
    assert.equal(surgeryOsGraftActionAllowed(techCtx, "add_implantation_count"), false);
    assert.equal(surgeryOsGraftActionAllowed(techCtx, "log_discarded_grafts"), true);
    assert.equal(surgeryOsGraftActionAllowed(coordCtx, "add_extraction_count"), false);
    assert.equal(surgeryOsActionAllowed(coordCtx, "reconcile_grafts"), false);
  });
});
