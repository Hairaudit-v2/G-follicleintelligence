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

test("workflow: consultant emphasises pipeline before front desk", () => {
  const order = orderedWorkflowGroupsForWorkspace("consultant");
  assert.equal(order[0], "PIPELINE");
  assert.equal(order[1], "PATIENTS");
});

test("workflow: surgeon places surgery first", () => {
  const order = orderedWorkflowGroupsForWorkspace("surgeon");
  assert.equal(order[0], "SURGERY");
  assert.equal(order[1], "CLINICAL");
});

test("workflow: patient twin maps to patients group", () => {
  assert.equal(workflowGroupForNavItemId("patient-twin", "director"), "PATIENTS");
  assert.equal(workflowGroupForNavItemId("reception-os", "surgeon"), "FRONT_DESK");
  assert.equal(workflowGroupForNavItemId("surgery-os", "surgeon"), "SURGERY");
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

test("workflow: sections include team when staff feature on", () => {
  const raw = resolveFiOsPrimarySidebarItems(base, true, true, null, true, true);
  const access = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    staff: true,
  });
  const filtered = filterFiOsPrimarySidebarItemsByFeatureAccess(raw, access);
  const sections = buildFiOsSidebarWorkflowSections(filtered, "clinic_manager");
  const team = sections.find((s) => s.groupId === "TEAM");
  assert.ok(team?.items.some((i) => i.id === "team"));
});

test("workflow: collapsed More omits primary rail duplicates", () => {
  const raw = resolveFiOsPrimarySidebarItems(base, true, true, null, true, true, true, true, true);
  const sections = buildFiOsSidebarWorkflowSections(raw, "default", {
    tenantBase: base,
    forCollapsedShell: true,
  });
  const ids = sections.flatMap((s) => s.items.map((i) => i.id));
  assert.ok(!ids.includes("calendar"));
  assert.ok(!ids.includes("patients"));
  assert.ok(ids.includes("team"));
  assert.ok(ids.includes("reports"));
  assert.ok(!ids.includes("analytics"));
});