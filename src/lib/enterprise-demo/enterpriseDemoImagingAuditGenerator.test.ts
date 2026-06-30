import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEnterpriseDemoImagingAuditBundles,
  ENTERPRISE_DEMO_IMAGING_PROTOCOL_SLOTS,
  resolveIncludedImagingSlots,
  validateEnterpriseDemoImagingAuditBundles,
} from "./enterpriseDemoImagingAuditGenerator";
import { buildEnterpriseDemoSurgerySpecs } from "./enterpriseDemoSurgeriesGenerator";

test("buildEnterpriseDemoImagingAuditBundles produces 96 bundles", () => {
  const bundles = buildEnterpriseDemoImagingAuditBundles();
  assert.equal(bundles.length, 96);
});

test("validateEnterpriseDemoImagingAuditBundles accepts generated bundles", () => {
  const bundles = buildEnterpriseDemoImagingAuditBundles();
  const result = validateEnterpriseDemoImagingAuditBundles(bundles);
  assert.equal(result.ok, true);
});

test("demo image keys are unique and use synthetic storage paths", () => {
  const bundles = buildEnterpriseDemoImagingAuditBundles();
  const keys = new Set<string>();

  for (const bundle of bundles) {
    for (const image of bundle.images) {
      assert.ok(!keys.has(image.demoImageKey), `duplicate key ${image.demoImageKey}`);
      keys.add(image.demoImageKey);
      assert.match(image.storagePath, /^titan-demo\/synthetic\/.+\.jpg$/);
      assert.equal(image.synthetic, true);
    }
  }
});

test("completed Sydney surgeries have excellent protocol completion", () => {
  const bundles = buildEnterpriseDemoImagingAuditBundles();
  const sydneyCompleted = bundles.filter(
    (b) =>
      b.surgery.clinicSlug === "sydney-hair-institute" && b.surgery.surgeryStatus === "completed"
  );

  assert.ok(sydneyCompleted.length > 0);
  for (const bundle of sydneyCompleted) {
    assert.equal(bundle.protocolSession?.protocolCompletionStatus, "excellent");
    assert.deepEqual(bundle.protocolSession?.missingSlots, []);
    assert.ok(
      bundle.protocolSession?.slotsFilled === ENTERPRISE_DEMO_IMAGING_PROTOCOL_SLOTS.length
    );
  }
});

test("London completed surgeries include quality-flagged slots", () => {
  const bundles = buildEnterpriseDemoImagingAuditBundles();
  const londonCompleted = bundles.filter(
    (b) =>
      b.surgery.clinicSlug === "london-central-institute" && b.surgery.surgeryStatus === "completed"
  );

  assert.ok(londonCompleted.every((b) => (b.protocolSession?.qualityFlaggedSlots.length ?? 0) > 0));
  assert.ok(
    londonCompleted.some((b) =>
      b.outcomeAudits.some((audit) => audit.auditStatus === "changes_required")
    )
  );
});

test("Bangkok completed surgeries miss follow-up imaging slots", () => {
  const bundles = buildEnterpriseDemoImagingAuditBundles();
  const bangkokCompleted = bundles.filter(
    (b) =>
      b.surgery.clinicSlug === "bangkok-restoration-centre" &&
      b.surgery.surgeryStatus === "completed"
  );

  for (const bundle of bangkokCompleted) {
    assert.equal(bundle.protocolSession?.protocolCompletionStatus, "missing_follow_up");
    assert.ok(bundle.protocolSession?.missingSlots.includes("3_month"));
    assert.ok(bundle.protocolSession?.missingSlots.includes("12_month"));
    assert.ok(
      bundle.outcomeAudits.every(
        (audit) => audit.checkpointKey === "month_3" && audit.auditStatus === "incomplete_follow_up"
      )
    );
  }
});

test("Dubai completed surgeries flag graft-tray mismatch", () => {
  const bundles = buildEnterpriseDemoImagingAuditBundles();
  const dubaiCompleted = bundles.filter(
    (b) =>
      b.surgery.clinicSlug === "dubai-hair-institute" && b.surgery.surgeryStatus === "completed"
  );

  assert.ok(
    dubaiCompleted.every(
      (b) => b.protocolSession?.protocolCompletionStatus === "graft_tray_mismatch"
    )
  );
  assert.ok(
    dubaiCompleted.some((b) =>
      b.images.some(
        (img) => img.slot === "graft_tray" && img.qualityFlags.includes("graft_count_mismatch")
      )
    )
  );
});

test("resolveIncludedImagingSlots respects surgery status", () => {
  const scheduled = resolveIncludedImagingSlots("scheduled", "excellent_completion");
  assert.equal(scheduled.length, 6);
  assert.ok(!scheduled.includes("immediate_post_op"));

  const completed = resolveIncludedImagingSlots("completed", "excellent_completion");
  assert.equal(completed.length, ENTERPRISE_DEMO_IMAGING_PROTOCOL_SLOTS.length);

  const bangkokCompleted = resolveIncludedImagingSlots("completed", "missing_follow_up");
  assert.equal(bangkokCompleted.length, 8);
  assert.ok(!bangkokCompleted.includes("3_month"));
});

test("outcome audits include registry metric keys for completed surgeries", () => {
  const bundles = buildEnterpriseDemoImagingAuditBundles();
  const completedWithAudits = bundles.filter((b) => b.outcomeAudits.length > 0);

  assert.ok(completedWithAudits.length > 0);
  for (const bundle of completedWithAudits) {
    for (const audit of bundle.outcomeAudits) {
      assert.ok(audit.metricValues.graft_survival_estimate > 0);
      assert.ok(audit.metricValues.density_change >= 0);
      assert.ok(audit.metricValues.donor_recovery_score > 0);
      assert.ok(audit.metricValues.hairline_design_score > 0);
      assert.ok(audit.metricValues.patient_satisfaction_score >= 1);
    }
  }
});

test("imaging bundles align with surgery specs", () => {
  const surgeries = buildEnterpriseDemoSurgerySpecs();
  const bundles = buildEnterpriseDemoImagingAuditBundles(surgeries);
  assert.equal(bundles.length, surgeries.length);
  for (let i = 0; i < surgeries.length; i++) {
    assert.equal(bundles[i].surgery.demoSurgeryKey, surgeries[i].demoSurgeryKey);
  }
});
