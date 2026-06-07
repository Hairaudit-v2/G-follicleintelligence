import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildFiServiceSeedFromTimelyCsv,
  classifyRowDisposition,
  isPackageOrRedemptionRow,
  isStubOrPivotLabel,
  suggestBasePrice,
  splitCsvRecords,
} from "./serviceSalesToFiSeed";

test("splitCsvRecords handles quoted commas", () => {
  const g = splitCsvRecords(`a,b\n"hello, world",2`);
  assert.deepEqual(g, [
    ["a", "b"],
    ["hello, world", "2"],
  ]);
});

test("isStubOrPivotLabel detects Timely summary placeholders", () => {
  assert.equal(isStubOrPivotLabel("ServiceCategory1", "anything"), true);
  assert.equal(isStubOrPivotLabel("Hair", "ServiceName5"), true);
  assert.equal(isStubOrPivotLabel("Hair", "Initial consult"), false);
});

test("isPackageOrRedemptionRow", () => {
  assert.equal(isPackageOrRedemptionRow("Promotions", "Package redemption — 5 visits"), true);
  assert.equal(isPackageOrRedemptionRow("Hair", "PRP treatment"), false);
});

test("suggestBasePrice prefers consistent average", () => {
  const a = suggestBasePrice(10, 100, 1000);
  assert.equal(a.price, 100);
  assert.equal(a.flags.length, 0);
});

test("suggestBasePrice flags mismatch and uses gross per unit", () => {
  const a = suggestBasePrice(10, 500, 1000);
  assert.ok(Math.abs(a.price - 100) < 0.01);
  assert.ok(a.flags.some((f) => f.includes("mismatch")));
});

test("buildFiServiceSeedFromTimelyCsv filters stubs and redemptions", () => {
  const csv = [
    "Service Category,Service Name,Quantity,Average Amount,Gross Amount,Tax Amount,Net Amount",
    "Consultation,Initial consult,5,150,750,75,675",
    "ServiceCategory1,ServiceName5,0,0,0,0,0",
    "Other,Package redemption (credit),2,0,0,0,0",
    "Adjustments,Credit note,1,-200,-200,-20,-180",
  ].join("\n");

  const r = buildFiServiceSeedFromTimelyCsv(csv);
  assert.equal(r.seedRows.length, 1);
  assert.equal(r.seedRows[0]!.name, "Initial consult");
  assert.equal(r.excluded.length, 3);
});

test("PRP row maps booking_type prp", () => {
  const csv = [
    "Service Category,Service Name,Quantity,Average Amount,Gross Amount,Tax Amount,Net Amount",
    "Treatment,PRP scalp treatment,3,400,1200,120,1080",
  ].join("\n");
  const r = buildFiServiceSeedFromTimelyCsv(csv);
  assert.equal(r.seedRows[0]!.booking_type, "prp");
});

test("classifyRowDisposition for crm-like negative row", () => {
  const ex = {
    timelyCategory: "Adj",
    timelyServiceName: "Refund batch",
    usageQuantity: 1,
    averageAmount: -50,
    grossAmount: -50,
    taxAmount: 0,
    netAmount: -50,
    sourceLineNumber: 9,
  };
  assert.equal(classifyRowDisposition(ex).kind, "excluded");
});
