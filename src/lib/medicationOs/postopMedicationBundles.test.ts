import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_SURGERY_POSTOP_MEDICATION_BUNDLE_V1,
  SURGERY_POSTOP_BUNDLE_PLAN_METADATA,
  SURGERY_POSTOP_BUNDLE_PLAN_TITLE,
  SURGERY_POSTOP_BUNDLE_V1_CANONICAL_CODES,
  buildSurgeryPostopMedicationDryRunModel,
  collectPostopBundleTemplateText,
  postopBundleTemplateLinesToDraftItems,
} from "./postopMedicationBundles";

/** Named controlled or high-risk analgesics — must not appear in class-level bundle copy. */
const FORBIDDEN_ANALGESIC_NAMES =
  /\b(oxycodone|tramadol|morphine|fentanyl|hydrocodone|codeine|tapentadol|buprenorphine|methadone|diazepam|lorazepam|alprazolam|clonazepam|ketamine)\b/i;

describe("postopMedicationBundles", () => {
  it("default template has expected shape and three lines", () => {
    assert.equal(DEFAULT_SURGERY_POSTOP_MEDICATION_BUNDLE_V1.length, 3);
    const cats = DEFAULT_SURGERY_POSTOP_MEDICATION_BUNDLE_V1.map((l) => l.category);
    assert.deepEqual(cats, ["antibiotics", "prednisolone", "pain_medication"]);
    for (const line of DEFAULT_SURGERY_POSTOP_MEDICATION_BUNDLE_V1) {
      assert.equal(typeof line.dosing_summary, "string");
      assert.ok(line.dosing_summary.length > 10);
      assert.ok(["course", "taper", "prn"].includes(line.role));
    }
  });

  it("includes seeded canonical codes antibiotics, prednisolone, pain_medication", () => {
    const codes = DEFAULT_SURGERY_POSTOP_MEDICATION_BUNDLE_V1.map((l) => l.canonical_code);
    assert.deepEqual(codes, [...SURGERY_POSTOP_BUNDLE_V1_CANONICAL_CODES]);
  });

  it("sets day offsets relative to surgery anchor", () => {
    const [ab, pred, pain] = DEFAULT_SURGERY_POSTOP_MEDICATION_BUNDLE_V1;
    assert.equal(ab.day_offset_start, 0);
    assert.equal(ab.day_offset_end, 7);
    assert.equal(pred.day_offset_start, 0);
    assert.equal(pred.day_offset_end, 5);
    assert.equal(pain.day_offset_start, 0);
    assert.equal(pain.day_offset_end, 14);
  });

  it("does not embed specific controlled-drug names in template text", () => {
    const blob = collectPostopBundleTemplateText([...DEFAULT_SURGERY_POSTOP_MEDICATION_BUNDLE_V1]).join("\n");
    assert.match(blob, /analgesia|pain/i);
    assert.doesNotMatch(blob, FORBIDDEN_ANALGESIC_NAMES);
  });

  it("draft items preserve categories in metadata", () => {
    const items = postopBundleTemplateLinesToDraftItems();
    assert.equal(items.length, 3);
    const expectedCats = ["antibiotics", "prednisolone", "pain_medication"] as const;
    for (let i = 0; i < expectedCats.length; i++) {
      assert.equal(items[i]?.metadata?.["postop_category"], expectedCats[i]);
    }
  });

  it("buildSurgeryPostopMedicationDryRunModel returns stable dry-run shape", () => {
    const m = buildSurgeryPostopMedicationDryRunModel({
      tenantId: "t1",
      patientId: "p1",
      caseId: "c1",
      surgeryPlanId: "sp1",
      consultationId: null,
      surgeryAnchorDate: "2026-06-12",
    });
    assert.equal(m.status, "dry_run");
    assert.equal(m.plan.title, SURGERY_POSTOP_BUNDLE_PLAN_TITLE);
    assert.equal(m.plan.plan_type, "post_operative");
    assert.equal(m.plan.source, "surgery_postop_bundle");
    assert.equal(m.plan.surgery_anchor_date, "2026-06-12");
    assert.equal(m.plan.surgery_plan_id, "sp1");
    assert.deepEqual(m.plan.metadata, { ...SURGERY_POSTOP_BUNDLE_PLAN_METADATA });
    assert.equal(m.items.length, 3);
    assert.equal(m.items[0]?.canonical_code, "antibiotics");
    assert.equal(m.items[0]?.day_offset_start, 0);
    assert.equal(m.items[0]?.day_offset_end, 7);
  });
});
