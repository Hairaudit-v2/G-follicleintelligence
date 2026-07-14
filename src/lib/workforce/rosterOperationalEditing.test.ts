import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  computeEffectiveAccess,
  type StaffAccessGrantInput,
} from "@/src/lib/staffAccess/staffAccessCore";
import { resolveTeamWorkspaceTabAccess } from "@/src/lib/staffAccess/staffTeamAccessCore";
import {
  rosterClearGeneratedConfirmMessage,
  rosterCreateBlankActionLabel,
  rosterCreateBlankConfirmMessage,
  rosterRegenerateGeneratedActionLabel,
} from "@/src/lib/workforce/rosterCadencePolicyCore";
import {
  canHardDeleteGeneratedDraftShift,
  canEditRosterShift,
  isGeneratedShiftSource,
} from "@/src/lib/workforce-os/rosterManualAdjustmentsCore";
import { loadRosterCommandCentrePageData } from "@/src/lib/workforce-os/rosterCommandCentrePageLoader.server";

const ROSTER_VIEW = "src/components/fi/workforce/RosterCommandCentreView.tsx";
const PAGE_LOADER = "src/lib/workforce-os/rosterCommandCentrePageLoader.server.ts";

function grant(
  partial: Partial<StaffAccessGrantInput> & { moduleKey: string }
): StaffAccessGrantInput {
  return {
    tabKey: null,
    accessLevel: "read",
    scope: "tenant",
    revokedAt: null,
    ...partial,
  };
}

test("roster workflow action labels support manual-first fortnight editing", () => {
  assert.equal(rosterCreateBlankActionLabel("fortnightly"), "Create blank fortnight");
  assert.equal(rosterRegenerateGeneratedActionLabel(), "Regenerate from standard hours");
  assert.match(rosterCreateBlankConfirmMessage("fortnightly"), /manual rostering/i);
  assert.match(
    rosterClearGeneratedConfirmMessage("fortnightly"),
    /Manual shifts will not be removed/i
  );
});

test("generated scheduled shifts are editable and hard-deletable by managers", () => {
  const generated = {
    id: "shift-1",
    staff_id: "staff-1",
    clinic_id: null,
    shift_type: "clinic_day",
    starts_at: "2026-07-06T01:00:00.000Z",
    ends_at: "2026-07-06T09:00:00.000Z",
    status: "scheduled",
    notes: null,
    shift_source: "standard_hours",
  };

  assert.equal(isGeneratedShiftSource(generated.shift_source), true);
  assert.deepEqual(canEditRosterShift(generated), { editable: true });
  assert.equal(canHardDeleteGeneratedDraftShift(generated), true);
});

test("roster-only user sees roster and staff tabs; auditor with hrOsFullNav sees full set", () => {
  const rosterOnly = computeEffectiveAccess({
    roleKey: "reception",
    grants: [grant({ moduleKey: "workforce_os", tabKey: "roster", accessLevel: "edit" })],
  });
  const rosterOnlyTabs = resolveTeamWorkspaceTabAccess(rosterOnly, { hrOsFullNav: false });
  assert.deepEqual(rosterOnlyTabs.visibleTabIds, ["staff", "roster"]);

  const auditor = computeEffectiveAccess({ roleKey: "auditor", grants: [] });
  const auditorTabs = resolveTeamWorkspaceTabAccess(auditor, { hrOsFullNav: true });
  assert.ok(auditorTabs.visibleTabIds.includes("overview"));
  assert.ok(auditorTabs.visibleTabIds.includes("roster"));
  assert.ok(auditorTabs.visibleTabIds.includes("identity"));
});

test("roster page loader reads persisted shifts without auto-regenerating from standard hours", () => {
  const loader = readFileSync(PAGE_LOADER, "utf8");
  assert.ok(!loader.includes("generateRosterFromStandardHours"));
  assert.ok(loader.includes("loadRosterCommandCentre"));
});

test("command centre wires clear-generated action for blank fortnight workflow", () => {
  const view = readFileSync(ROSTER_VIEW, "utf8");
  assert.ok(view.includes("clearGeneratedRosterShiftsAction"));
  assert.ok(view.includes('data-testid="roster-create-blank-button"'));
  assert.ok(view.includes('data-testid="roster-clear-generated-button"'));
  assert.ok(!view.includes("Save and generate roster"));
});

test("loadRosterCommandCentrePageData export is read-only loader", () => {
  assert.equal(typeof loadRosterCommandCentrePageData, "function");
});
