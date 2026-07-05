import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  ROSTER_SHIFT_CANCELLATION_REASON_REQUIRED_MESSAGE,
  ROSTER_SHIFT_DRAWER_CANCELLATION_REASONS,
} from "@/src/lib/workforce-os/rosterManualAdjustmentsCore";

const ACTIONS = "src/lib/actions/workforce-roster-actions.ts";
const SHIFT_DRAWER = "src/components/fi/workforce/RosterShiftDrawer.tsx";
const ROSTER_VIEW = "src/components/fi/workforce/RosterCommandCentreView.tsx";

function sourceIncludes(path: string, ...tokens: string[]): void {
  const src = readFileSync(path, "utf8");
  for (const token of tokens) {
    assert.ok(src.includes(token), `expected ${path} to include ${token}`);
  }
}

describe("cancelRosterShiftAction production wiring", () => {
  it("uses audited cancelStaffShiftWithReason instead of legacy cancelStaffShift", () => {
    const src = readFileSync(ACTIONS, "utf8");
    assert.ok(src.includes("cancelStaffShiftWithReason"));
    assert.ok(!src.includes("cancelStaffShift("));
    assert.ok(src.includes("hardDeleteGeneratedDraft: true"));
    assert.ok(src.includes("updatedBy: actorFiUserId"));
    assert.ok(src.includes("cancellationReason: parsed.cancellationReason"));
    assert.ok(src.includes("notes: parsed.notes"));
  });

  it("requires cancellation reason with UI-safe error message", () => {
    const src = readFileSync(ACTIONS, "utf8");
    assert.ok(src.includes("ROSTER_SHIFT_CANCELLATION_REASON_REQUIRED_MESSAGE"));
    assert.ok(src.includes("ROSTER_SHIFT_DRAWER_CANCELLATION_REASONS"));
    assert.equal(
      ROSTER_SHIFT_CANCELLATION_REASON_REQUIRED_MESSAGE,
      "Please choose a cancellation reason before cancelling this shift."
    );
  });

  it("exports remaining manual-adjustment server actions", () => {
    sourceIncludes(
      ACTIONS,
      "export async function updateRosterShiftAction",
      "export async function clearGeneratedRosterShiftsAction",
      "export async function markStaffSickForShiftAction",
      "export async function createReplacementShiftAction",
      "assertHrOsRosterManageAllowed",
      "resolveRosterActorFiUserId"
    );
  });
});

describe("drawer cancellation reason options", () => {
  it("includes manual_adjustment and excludes bulk-only clear_generated_roster", () => {
    const drawerReasons = ROSTER_SHIFT_DRAWER_CANCELLATION_REASONS as readonly string[];
    assert.ok(drawerReasons.includes("manual_adjustment"));
    assert.ok(!drawerReasons.includes("clear_generated_roster"));
    assert.ok(drawerReasons.includes("staff_sick"));
    assert.ok(drawerReasons.includes("other"));
  });
});

describe("RosterShiftDrawer permission and cancel UI", () => {
  it("gates mutation controls by canManage and shows read-only message", () => {
    sourceIncludes(
      SHIFT_DRAWER,
      "canManage = true",
      'data-testid="roster-shift-manage-denied"',
      "You do not have permission to manage roster shifts.",
      "readOnly={Boolean(editing) || !canManage}",
      "showSave={!editing && canManage}"
    );
  });

  it("requires cancellation reason before confirm cancel", () => {
    sourceIncludes(
      SHIFT_DRAWER,
      'data-testid="roster-shift-cancellation-reason"',
      'data-testid="roster-shift-cancel-confirm"',
      "ROSTER_SHIFT_CANCELLATION_REASON_REQUIRED_MESSAGE",
      "cancellationReason",
      "disabled={pending || !cancellationReason.trim()}"
    );
    assert.ok(readFileSync(SHIFT_DRAWER, "utf8").includes('data-testid="roster-shift-cancel-section"'));
  });

  it("hides cancel section when canManage is false", () => {
    const src = readFileSync(SHIFT_DRAWER, "utf8");
    assert.ok(src.includes("{editing && canManage ? ("));
    assert.ok(src.includes("{canManage ? ("));
  });
});

describe("RosterCommandCentreView passes canManage to shift drawer", () => {
  it("wires canManage and manageDeniedReason into RosterShiftDrawer", () => {
    sourceIncludes(
      ROSTER_VIEW,
      "canManage={canManage}",
      "manageDeniedReason={manageDeniedReason}",
      "handleShiftClick"
    );
  });
});
