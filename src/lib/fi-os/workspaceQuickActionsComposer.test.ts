import assert from "node:assert/strict";
import test from "node:test";

import { resolveDashboardQuickActions } from "@/src/lib/fiAdmin/dashboardQuickActionsConfig";
import { composeWorkspaceQuickActionsOrder } from "@/src/lib/fi-os/workspaceQuickActionsComposer";

const base = "/fi-admin/t-1";

test("quick action composer: default preserves definition order", () => {
  const resolved = resolveDashboardQuickActions(base, { showCrmNav: true, showBookingsBoard: true });
  const ordered = composeWorkspaceQuickActionsOrder({ workspaceProfile: "default", resolvedItems: resolved });
  assert.deepEqual(
    ordered.map((i) => i.key),
    resolved.map((i) => i.key)
  );
});

test("quick action composer: surgeon prioritises case and upload", () => {
  const resolved = resolveDashboardQuickActions(base, { showCrmNav: true, showBookingsBoard: true });
  const ordered = composeWorkspaceQuickActionsOrder({ workspaceProfile: "surgeon", resolvedItems: resolved });
  assert.equal(ordered[0]?.key, "case");
  assert.equal(ordered[1]?.key, "upload_images");
});

test("quick action composer: director prioritises lead before booking", () => {
  const resolved = resolveDashboardQuickActions(base, { showCrmNav: true, showBookingsBoard: true });
  const ordered = composeWorkspaceQuickActionsOrder({ workspaceProfile: "director", resolvedItems: resolved });
  assert.deepEqual(ordered.slice(0, 4).map((i) => i.key), ["lead", "booking", "case", "upload_images"]);
});

test("quick action composer: reception order", () => {
  const resolved = resolveDashboardQuickActions(base, { showCrmNav: true, showBookingsBoard: true });
  const ordered = composeWorkspaceQuickActionsOrder({ workspaceProfile: "reception", resolvedItems: resolved });
  assert.deepEqual(ordered.slice(0, 3).map((i) => i.key), ["booking", "patient", "lead"]);
});
