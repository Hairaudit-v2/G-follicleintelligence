import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveFiOsPrimarySidebarItems,
  filterFiOsPrimarySidebarItemsByFeatureAccess,
} from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import {
  applyPartialFeatureOverrides,
  buildDefaultFeatureAccessAllEnabled,
} from "@/src/config/fiFeatureAccessRegistry";
import {
  buildFiOsSidebarWorkflowSections,
  orderedWorkflowGroupsForWorkspace,
  workflowGroupForNavItemId,
} from "@/src/lib/fi-os/fiOsSidebarWorkflow";

const base = "/fi-admin/t-1";

test("workflow: consultant emphasises patient journey before today", () => {
  const order = orderedWorkflowGroupsForWorkspace("consultant");
  assert.equal(order[1], "PATIENT_JOURNEY");
  assert.equal(order[2], "TODAY");
});

test("workflow: surgeon places clinical first after home", () => {
  const order = orderedWorkflowGroupsForWorkspace("surgeon");
  assert.equal(order[1], "CLINICAL");
  assert.equal(order[2], "TODAY");
});

test("workflow: patient twin moves to clinical for surgeon persona", () => {
  assert.equal(workflowGroupForNavItemId("patient-twin", "director"), "INTELLIGENCE");
  assert.equal(workflowGroupForNavItemId("patient-twin", "surgeon"), "CLINICAL");
});

test("workflow: empty groups omitted when all items filtered by Stage 2", () => {
  const raw = resolveFiOsPrimarySidebarItems(base, false, false, null, true, true);
  const access = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    academy: false,
    staff: false,
  });
  const filtered = filterFiOsPrimarySidebarItemsByFeatureAccess(raw, access);
  const sections = buildFiOsSidebarWorkflowSections(filtered, "default");
  assert.ok(!sections.some((s) => s.groupId === "TEAM"));
});

test("workflow: sections include staff when feature on", () => {
  const raw = resolveFiOsPrimarySidebarItems(base, true, true, null, true, true);
  const access = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    staff: true,
  });
  const filtered = filterFiOsPrimarySidebarItemsByFeatureAccess(raw, access);
  const sections = buildFiOsSidebarWorkflowSections(filtered, "clinic_manager");
  const team = sections.find((s) => s.groupId === "TEAM");
  assert.ok(team?.items.some((i) => i.id === "staff"));
});
