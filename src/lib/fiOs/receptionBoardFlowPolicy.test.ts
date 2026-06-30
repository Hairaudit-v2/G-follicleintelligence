import assert from "node:assert/strict";
import { test } from "node:test";

import { FI_RECEPTION_FLOW_PHASE_KEY } from "@/src/lib/fiOs/receptionBoardModel";
import {
  applyPhaseIntentToMetadataForAction,
  assertBookingMutableForReceptionFlow,
  assertBookingStartInOperationalWindow,
  staffPinMayRunReceptionFlowAction,
} from "@/src/lib/fiOs/receptionBoardFlowPolicy";

const DAY_START = "2026-06-10T00:00:00.000Z";
const DAY_END = "2026-06-11T00:00:00.000Z";

test("PIN may run floor actions except cancel", () => {
  assert.equal(staffPinMayRunReceptionFlowAction("mark_arrived"), true);
  assert.equal(staffPinMayRunReceptionFlowAction("start_consultation"), true);
  assert.equal(staffPinMayRunReceptionFlowAction("start_treatment"), true);
  assert.equal(staffPinMayRunReceptionFlowAction("complete"), true);
  assert.equal(staffPinMayRunReceptionFlowAction("mark_no_show"), true);
  assert.equal(staffPinMayRunReceptionFlowAction("cancel"), false);
});

test("assertBookingStartInOperationalWindow: rejects outside window", () => {
  const r = assertBookingStartInOperationalWindow("2026-06-09T12:00:00.000Z", DAY_START, DAY_END);
  assert.equal(r.ok, false);
  assert.ok(r.ok === false && r.error.includes("operational"));
});

test("assertBookingStartInOperationalWindow: accepts inside window", () => {
  const r = assertBookingStartInOperationalWindow("2026-06-10T12:00:00.000Z", DAY_START, DAY_END);
  assert.equal(r.ok, true);
});

test("applyPhaseIntentToMetadataForAction: mark arrived clears phase and preserves keys", () => {
  const base = { foo: "bar", [FI_RECEPTION_FLOW_PHASE_KEY]: "consultation" } as Record<
    string,
    unknown
  >;
  const out = applyPhaseIntentToMetadataForAction("mark_arrived", base);
  assert.equal(out.foo, "bar");
  assert.equal(Object.prototype.hasOwnProperty.call(out, FI_RECEPTION_FLOW_PHASE_KEY), false);
});

test("applyPhaseIntentToMetadataForAction: start consultation sets phase and preserves keys", () => {
  const base = { note: "keep", other: 2 } as Record<string, unknown>;
  const out = applyPhaseIntentToMetadataForAction("start_consultation", base);
  assert.equal(out.note, "keep");
  assert.equal(out.other, 2);
  assert.equal(out[FI_RECEPTION_FLOW_PHASE_KEY], "consultation");
});

test("applyPhaseIntentToMetadataForAction: start treatment sets treatment phase", () => {
  const base = { x: 1 } as Record<string, unknown>;
  const out = applyPhaseIntentToMetadataForAction("start_treatment", base);
  assert.equal(out.x, 1);
  assert.equal(out[FI_RECEPTION_FLOW_PHASE_KEY], "treatment");
});

test("applyPhaseIntentToMetadataForAction: mark no-show clears phase like mark arrived", () => {
  const base = { k: "v", [FI_RECEPTION_FLOW_PHASE_KEY]: "treatment" } as Record<string, unknown>;
  const out = applyPhaseIntentToMetadataForAction("mark_no_show", base);
  assert.equal(out.k, "v");
  assert.equal(Object.prototype.hasOwnProperty.call(out, FI_RECEPTION_FLOW_PHASE_KEY), false);
});

test("assertBookingMutableForReceptionFlow: blocks terminal rows", () => {
  assert.equal(assertBookingMutableForReceptionFlow("completed").ok, false);
  assert.equal(assertBookingMutableForReceptionFlow("cancelled").ok, false);
  assert.equal(assertBookingMutableForReceptionFlow("no_show").ok, false);
  assert.equal(assertBookingMutableForReceptionFlow("scheduled").ok, true);
});
