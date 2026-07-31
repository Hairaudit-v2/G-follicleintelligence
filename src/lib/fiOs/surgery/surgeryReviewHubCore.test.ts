import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSurgeryReviewHubModel,
  surgeryReviewHubUsesStaffSafeLabels,
} from "@/src/lib/fiOs/surgery/surgeryReviewHubCore";

const TENANT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("staff review hub stays inside surgery workspace and avoids intelligence labels", () => {
  const model = buildSurgeryReviewHubModel({
    tenantId: TENANT,
    access: {
      canAccessCases: true,
      canAccessSurgeryWorkspace: true,
      canAccessAdvancedOutcomeView: false,
      canAccessGraftCounting: false,
    },
  });

  assert.equal(model.headerTitle, "Surgery review");
  assert.ok(surgeryReviewHubUsesStaffSafeLabels(model));
  assert.equal(model.advancedAdminLink, null);

  for (const card of model.summaryCards) {
    assert.ok(card.href);
    assert.ok(
      card.href!.includes(`/fi-admin/${TENANT}/surgery`),
      `staff card must stay under surgery: ${card.href}`
    );
    assert.ok(!card.href!.includes("surgery-os/intelligence"));
  }
  for (const panel of model.panels) {
    assert.ok(panel.href);
    assert.ok(panel.href!.includes(`/fi-admin/${TENANT}/surgery`));
  }
});

test("admin advanced outcome view is optional and explicitly labelled", () => {
  const model = buildSurgeryReviewHubModel({
    tenantId: TENANT,
    access: {
      canAccessCases: true,
      canAccessSurgeryWorkspace: true,
      canAccessAdvancedOutcomeView: true,
      canAccessGraftCounting: true,
    },
  });
  assert.ok(model.advancedAdminLink);
  assert.ok(model.advancedAdminLink!.href.endsWith("/surgery-os/intelligence"));
  assert.match(model.advancedAdminLink!.label, /advanced/i);
  assert.ok(surgeryReviewHubUsesStaffSafeLabels(model));
});

test("restricted access hides dead links", () => {
  const model = buildSurgeryReviewHubModel({
    tenantId: TENANT,
    access: {
      canAccessCases: false,
      canAccessSurgeryWorkspace: false,
      canAccessAdvancedOutcomeView: false,
      canAccessGraftCounting: false,
    },
  });
  assert.equal(model.summaryCards.length, 0);
  assert.equal(model.panels.length, 0);
  assert.equal(model.advancedAdminLink, null);
});
