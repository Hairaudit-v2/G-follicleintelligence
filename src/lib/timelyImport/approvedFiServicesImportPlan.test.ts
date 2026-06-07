import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildApprovedServicesImportPlan,
  dedupeApprovedByBookingType,
  normalizeServiceMatchKey,
  summarizeImportPlan,
  validateApprovedRowForSchema,
} from "./approvedFiServicesImportPlan";
import type { FiServiceApprovedImportRow } from "./buildApprovedFiSeed";

function row(p: Partial<FiServiceApprovedImportRow> & Pick<FiServiceApprovedImportRow, "name" | "category">): FiServiceApprovedImportRow {
  return {
    name: p.name,
    category: p.category,
    booking_type: p.booking_type ?? null,
    duration_minutes: p.duration_minutes ?? 45,
    base_price: p.base_price ?? 0,
    color: p.color ?? "#0ea5e9",
    is_active: p.is_active ?? true,
    review_flags: p.review_flags ?? [],
    curation_notes: p.curation_notes,
  };
}

test("normalizeServiceMatchKey", () => {
  assert.equal(normalizeServiceMatchKey("  Initial HAIR Consult ", "Consultation"), normalizeServiceMatchKey("initial hair consult", "consultation"));
});

test("validateApprovedRowForSchema rejects bad booking_type", () => {
  const bad = row({ name: "X", category: "Other", duration_minutes: 30, base_price: 1, booking_type: null });
  (bad as { booking_type: string | null }).booking_type = "not_a_type";
  const e = validateApprovedRowForSchema(bad);
  assert.ok(e?.includes("booking_type"));
});

test("dedupeApprovedByBookingType keeps last", () => {
  const { rows, warnings } = dedupeApprovedByBookingType([
    row({ name: "A", category: "Treatment", booking_type: "prp", base_price: 1 }),
    row({ name: "B", category: "Treatment", booking_type: "prp", base_price: 2 }),
  ]);
  assert.equal(rows.filter((r) => r.booking_type === "prp").length, 1);
  assert.equal(rows.find((r) => r.booking_type === "prp")!.name, "B");
  assert.ok(warnings.length >= 1);
});

test("buildApprovedServicesImportPlan update by booking_type", () => {
  const approved = [row({ name: "PRP v2", category: "Treatment", booking_type: "prp", base_price: 500 })];
  const existing = [{ id: "id-1", name: "Old PRP", category: "Treatment", booking_type: "prp" }];
  const plan = buildApprovedServicesImportPlan(approved, existing);
  assert.equal(plan.entries[0]!.action, "update");
  assert.equal(plan.entries[0]!.existingId, "id-1");
});

test("buildApprovedServicesImportPlan create when booking_type new", () => {
  const approved = [row({ name: "Meso", category: "Treatment", booking_type: "mesotherapy" })];
  const existing: { id: string; name: string; category: string | null; booking_type: string | null }[] = [];
  const plan = buildApprovedServicesImportPlan(approved, existing);
  assert.equal(plan.entries[0]!.action, "create");
});

test("null booking_type matches only existing rows without booking_type", () => {
  const approved = [row({ name: "FUE planning", category: "Surgery", booking_type: null })];
  const existing = [
    { id: "typed", name: "FUE planning", category: "Surgery", booking_type: "surgery" },
    { id: "untyped", name: "FUE planning", category: "Surgery", booking_type: null },
  ];
  const plan = buildApprovedServicesImportPlan(approved, existing);
  assert.equal(plan.entries[0]!.action, "update");
  assert.equal(plan.entries[0]!.existingId, "untyped");
  assert.ok(plan.warnings.some((w) => w.includes("Ignored")));
});

test("null booking_type creates when only typed collision exists", () => {
  const approved = [row({ name: "FUE planning", category: "Surgery", booking_type: null })];
  const existing = [{ id: "typed", name: "FUE planning", category: "Surgery", booking_type: "surgery" }];
  const plan = buildApprovedServicesImportPlan(approved, existing);
  assert.equal(plan.entries[0]!.action, "create");
});

test("summarizeImportPlan", () => {
  const bad = row({ name: "Bad", category: "Other", duration_minutes: 30, base_price: 1, booking_type: null });
  (bad as { booking_type: string | null }).booking_type = "invalid";
  const plan = buildApprovedServicesImportPlan(
    [row({ name: "A", category: "Consultation", booking_type: "consultation" }), bad],
    [{ id: "1", name: "A", category: "Consultation", booking_type: "consultation" }]
  );
  const s = summarizeImportPlan(plan);
  assert.equal(s.updated >= 1, true);
  assert.equal(s.skipped >= 1, true);
});
