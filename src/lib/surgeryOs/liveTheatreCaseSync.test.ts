import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CaseProcedureRow } from "@/src/lib/cases/procedureDayLoaders";
import {
  buildLiveTheatreCaseProcedurePatch,
  buildLiveTheatreSyncMilestones,
  isLiveTheatreCaseSyncNoOp,
  mapLiveTheatreStatusToProcedureStatus,
  shouldAdvanceProcedureStatus,
} from "@/src/lib/surgeryOs/liveTheatreCaseSyncCore";

function baseProcedure(overrides: Partial<CaseProcedureRow> = {}): CaseProcedureRow {
  return {
    id: "proc-1",
    tenant_id: "tenant-1",
    case_id: "case-1",
    procedure_date: null,
    procedure_status: "scheduled",
    surgeon_user_id: null,
    nurse_user_id: null,
    technician_user_ids: [],
    team_member_user_ids: [],
    procedure_milestones: {},
    procedure_location: null,
    procedure_room: null,
    start_time: null,
    finish_time: null,
    punch_size: null,
    extraction_method: null,
    implantation_method: null,
    medication_notes: null,
    intraoperative_notes: null,
    grafts_extracted: null,
    grafts_implanted: null,
    hairs_implanted: null,
    graft_handling_notes: null,
    complications_notes: null,
    completion_summary: null,
    created_at: "2026-07-01T08:00:00.000Z",
    updated_at: "2026-07-01T08:00:00.000Z",
    ...overrides,
  };
}

const surgeryBase = {
  id: "surgery-1",
  case_id: "case-1",
  status: "completed",
  scheduled_date: "2026-07-01",
  actual_start_at: "2026-07-01T09:00:00.000Z",
  actual_end_at: "2026-07-01T15:00:00.000Z",
  surgeon_fi_user_id: "surgeon-user-1",
};

const graftSession = {
  extracted_grafts: 3200,
  implanted_grafts: 3100,
  total_hairs: 7200,
  reconciliation_status: "completed",
  reconciled_at: "2026-07-01T14:30:00.000Z",
};

describe("liveTheatreCaseSyncCore", () => {
  it("maps live theatre completion to case procedure completed status", () => {
    assert.equal(
      mapLiveTheatreStatusToProcedureStatus("in_progress", "procedure_completed"),
      "completed"
    );
    assert.equal(mapLiveTheatreStatusToProcedureStatus("scheduled", "procedure_completed"), "completed");
    assert.equal(mapLiveTheatreStatusToProcedureStatus("in_progress", "graft_reconciliation_completed"), "in_progress");
  });

  it("does not downgrade procedure status", () => {
    assert.equal(shouldAdvanceProcedureStatus("completed", "in_progress"), false);
    assert.equal(shouldAdvanceProcedureStatus("in_progress", "completed"), true);
    assert.equal(shouldAdvanceProcedureStatus("cancelled", "completed"), false);
  });

  it("builds patch with times, graft totals, and completion state", () => {
    const patch = buildLiveTheatreCaseProcedurePatch({
      surgery: surgeryBase,
      graftSession,
      existing: baseProcedure(),
      trigger: "procedure_completed",
      syncedAt: "2026-07-01T15:05:00.000Z",
    });

    assert.ok(patch);
    assert.equal(patch?.procedure_status, "completed");
    assert.equal(patch?.start_time, surgeryBase.actual_start_at);
    assert.equal(patch?.finish_time, surgeryBase.actual_end_at);
    assert.equal(patch?.grafts_extracted, 3200);
    assert.equal(patch?.grafts_implanted, 3100);
    assert.equal(patch?.surgeon_user_id, "surgeon-user-1");
    assert.equal(patch?.procedure_date, "2026-07-01");
    assert.match(patch?.completion_summary ?? "", /SurgeryOS live theatre/);
  });

  it("preserves existing case procedure data when already set", () => {
    const existing = baseProcedure({
      procedure_status: "in_progress",
      start_time: "2026-07-01T08:30:00.000Z",
      finish_time: "2026-07-01T16:00:00.000Z",
      surgeon_user_id: "existing-surgeon",
      grafts_extracted: 3000,
      grafts_implanted: 2900,
      completion_summary: "Manual summary",
      procedure_date: "2026-06-30",
    });

    const patch = buildLiveTheatreCaseProcedurePatch({
      surgery: surgeryBase,
      graftSession,
      existing,
      trigger: "procedure_completed",
      syncedAt: "2026-07-01T15:05:00.000Z",
    });

    assert.ok(patch);
    assert.equal(patch?.procedure_status, "completed");
    assert.equal(patch?.start_time, undefined);
    assert.equal(patch?.finish_time, undefined);
    assert.equal(patch?.surgeon_user_id, undefined);
    assert.equal(patch?.procedure_date, undefined);
    assert.equal(patch?.completion_summary, undefined);
    assert.equal(patch?.grafts_extracted, 3200);
  });

  it("records sync milestones for idempotency and clinical markers", () => {
    const milestones = buildLiveTheatreSyncMilestones({
      existing: { extraction_started: "2026-07-01T10:00:00.000Z" },
      trigger: "graft_reconciliation_completed",
      surgeryId: "surgery-1",
      syncedAt: "2026-07-01T14:35:00.000Z",
      graftSession,
    });

    assert.equal(milestones.extraction_started, "2026-07-01T10:00:00.000Z");
    assert.equal(milestones.final_count_agreed, graftSession.reconciled_at);
    assert.equal(milestones._live_theatre_sync_surgery_id, "surgery-1");
    assert.equal(milestones._live_theatre_sync_trigger, "graft_reconciliation_completed");
  });

  it("treats repeated procedure_completed sync as no-op when case is completed", () => {
    const existing = baseProcedure({
      procedure_status: "completed",
      procedure_milestones: {
        _live_theatre_sync_at: "2026-07-01T15:05:00.000Z",
        _live_theatre_sync_surgery_id: "surgery-1",
        _live_theatre_sync_trigger: "procedure_completed",
      },
    });

    assert.equal(
      isLiveTheatreCaseSyncNoOp({
        existing,
        surgeryId: "surgery-1",
        trigger: "procedure_completed",
        graftSession,
      }),
      true
    );
  });

  it("allows graft reconciliation re-sync when totals change", () => {
    const existing = baseProcedure({
      grafts_extracted: 3000,
      grafts_implanted: 2900,
      procedure_milestones: {
        _live_theatre_sync_at: "2026-07-01T14:00:00.000Z",
        _live_theatre_sync_surgery_id: "surgery-1",
        _live_theatre_sync_trigger: "graft_reconciliation_completed",
        final_count_agreed: graftSession.reconciled_at!,
      },
    });

    assert.equal(
      isLiveTheatreCaseSyncNoOp({
        existing,
        surgeryId: "surgery-1",
        trigger: "graft_reconciliation_completed",
        graftSession,
      }),
      false
    );
  });

  it("returns null patch when surgery has no linked case", () => {
    const patch = buildLiveTheatreCaseProcedurePatch({
      surgery: { ...surgeryBase, case_id: null },
      graftSession: null,
      existing: null,
      trigger: "procedure_completed",
      syncedAt: "2026-07-01T15:05:00.000Z",
    });
    assert.equal(patch, null);
  });
});
