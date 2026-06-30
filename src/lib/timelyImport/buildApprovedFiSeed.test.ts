import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildApprovedFiSeedFromReviewRows,
  collectConsultationDuplicateDeferrals,
} from "./buildApprovedFiSeed";
import type { FiServiceSeedReviewRow } from "./serviceSalesTypes";

function row(
  p: Partial<FiServiceSeedReviewRow> & Pick<FiServiceSeedReviewRow, "name" | "category">
): FiServiceSeedReviewRow {
  return {
    name: p.name,
    category: p.category,
    booking_type: p.booking_type ?? null,
    duration_minutes: p.duration_minutes ?? 45,
    base_price: p.base_price ?? 0,
    color: p.color ?? "#000000",
    is_active: p.is_active ?? true,
    is_bookable: p.is_bookable ?? true,
    source: "timely_import",
    notes: p.notes ?? "",
    review_flags: p.review_flags ?? [],
    timely:
      p.timely ??
      ({
        timelyCategory: p.category,
        timelyServiceName: p.name,
        usageQuantity: 1,
        averageAmount: p.base_price ?? 0,
        grossAmount: p.base_price ?? 0,
        taxAmount: 0,
        netAmount: p.base_price ?? 0,
        sourceLineNumber: 1,
      } as FiServiceSeedReviewRow["timely"]),
  };
}

test("collectConsultationDuplicateDeferrals defers lower-gross duplicate names", () => {
  const a = row({
    name: "Initial consult",
    category: "Consultation",
    timely: {
      timelyCategory: "Consultation",
      timelyServiceName: "Initial consult",
      usageQuantity: 1,
      averageAmount: 100,
      grossAmount: 100,
      taxAmount: 0,
      netAmount: 100,
      sourceLineNumber: 1,
    },
  });
  const b = row({
    name: "Initial consult",
    category: "Consultation",
    timely: {
      timelyCategory: "Consultation",
      timelyServiceName: "Initial consult",
      usageQuantity: 1,
      averageAmount: 50,
      grossAmount: 50,
      taxAmount: 0,
      netAmount: 50,
      sourceLineNumber: 2,
    },
  });
  const { kept, deferred } = collectConsultationDuplicateDeferrals([a, b]);
  assert.equal(kept.length, 1);
  assert.equal(deferred.length, 1);
  assert.equal(kept[0]!.timely.grossAmount, 100);
});

test("buildApproved defers uncertain mapping and removes non-bookable", () => {
  const seed: FiServiceSeedReviewRow[] = [
    row({
      name: "Retail",
      category: "Other",
      is_bookable: false,
      review_flags: ["booking_type_uncertain"],
    }),
    row({
      name: "Tricho",
      category: "Diagnostics",
      review_flags: ["booking_type_uncertain"],
      timely: {
        timelyCategory: "Diagnostics",
        timelyServiceName: "Tricho",
        usageQuantity: 1,
        averageAmount: 10,
        grossAmount: 10,
        taxAmount: 0,
        netAmount: 10,
        sourceLineNumber: 3,
      },
    }),
    row({
      name: "PRP",
      category: "Treatment",
      booking_type: "prp",
      timely: {
        timelyCategory: "Treatment",
        timelyServiceName: "PRP",
        usageQuantity: 2,
        averageAmount: 200,
        grossAmount: 400,
        taxAmount: 0,
        netAmount: 400,
        sourceLineNumber: 4,
      },
    }),
  ];
  const p = buildApprovedFiSeedFromReviewRows(seed, {
    stage: "7a2",
    source_review_path: "test",
    timely_input_note: "test",
    generated_at: "t",
  });
  assert.equal(p.removed_non_bookable.length, 1);
  assert.equal(p.inactive_deferred.length, 1);
  assert.equal(p.approved_for_import.length, 1);
  assert.equal(p.approved_for_import[0]!.name, "PRP");
});

test("buildApproved clears duplicate booking_type on lower gross row", () => {
  const hi = row({
    name: "Surgery day",
    category: "Surgery",
    booking_type: "surgery",
    duration_minutes: 480,
    base_price: 8000,
    timely: {
      timelyCategory: "Surgery",
      timelyServiceName: "Surgery day",
      usageQuantity: 1,
      averageAmount: 8000,
      grossAmount: 8000,
      taxAmount: 0,
      netAmount: 8000,
      sourceLineNumber: 1,
    },
  });
  const lo = row({
    name: "Surgery consult",
    category: "Surgery",
    booking_type: "surgery",
    duration_minutes: 480,
    base_price: 200,
    timely: {
      timelyCategory: "Surgery",
      timelyServiceName: "Surgery consult",
      usageQuantity: 1,
      averageAmount: 200,
      grossAmount: 200,
      taxAmount: 0,
      netAmount: 200,
      sourceLineNumber: 2,
    },
  });
  const p = buildApprovedFiSeedFromReviewRows([hi, lo], {
    stage: "7a2",
    source_review_path: "test",
    timely_input_note: "test",
    generated_at: "t",
  });
  const loOut = p.approved_for_import.find((r) => r.name === "Surgery consult");
  const hiOut = p.approved_for_import.find((r) => r.name === "Surgery day");
  assert.equal(hiOut?.booking_type, "surgery");
  assert.equal(loOut?.booking_type, null);
  assert.ok(loOut?.curation_notes?.includes("booking_type cleared"));
});
