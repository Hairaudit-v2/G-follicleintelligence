import assert from "node:assert/strict";
import { test } from "node:test";

import {
  collectAffectedWorkspaceUpdates,
  mergeWorkspaceSignalUpdates,
  shouldSkipDuplicateRevisionTick,
} from "@/src/lib/fiOs/workspaceSignal/workspaceSignalSyncCore";
import type { WorkspaceSignalPayload } from "@/src/lib/fiOs/workspaceSignal/workspaceSignalRegistry";

const PATIENT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const APPOINTMENT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const LEAD = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function arrivalSignal(): WorkspaceSignalPayload {
  return {
    signalType: "arrival_intent",
    entityKind: "booking",
    entityId: APPOINTMENT,
    targetRefs: [
      { kind: "appointment", id: APPOINTMENT },
      { kind: "patient", id: PATIENT },
    ],
    timestamp: "2026-07-03T08:00:00.000Z",
    reasonLabel: "Arrival status changed",
  };
}

test("collectAffectedWorkspaceUpdates marks only relevant open workspaces", () => {
  const updates = collectAffectedWorkspaceUpdates(
    [
      { kind: "patient", id: PATIENT },
      { kind: "lead", id: LEAD },
    ],
    [arrivalSignal()],
    "2026-07-03T08:00:00.000Z"
  );

  assert.ok(updates["patient:" + PATIENT]);
  assert.equal(updates["patient:" + PATIENT]?.reason, "Arrival status changed");
  assert.equal(updates["lead:" + LEAD], undefined);
});

test("mergeWorkspaceSignalUpdates preserves stack keys", () => {
  const merged = mergeWorkspaceSignalUpdates(
    { "patient:a": { reason: "Old", at: "t0" } },
    { "patient:b": { reason: "New", at: "t1" } }
  );
  assert.deepEqual(Object.keys(merged).sort(), ["patient:a", "patient:b"]);
});

test("mergeWorkspaceSignalUpdates preserves open workspace stack keys", () => {
  const patientKey = "patient:" + PATIENT;
  const leadKey = "lead:" + LEAD;
  const merged = mergeWorkspaceSignalUpdates(
    { [patientKey]: { reason: "Arrival status changed", at: "t0" } },
    { [leadKey]: { reason: "Lead follow-up state changed", at: "t1" } }
  );
  assert.equal(Object.keys(merged).length, 2);
  assert.ok(merged[patientKey]);
  assert.ok(merged[leadKey]);
});

test("multiple affected workspaces batch without dropping stack entries", () => {
  const signal = arrivalSignal();
  const updates = collectAffectedWorkspaceUpdates(
    [
      { kind: "patient", id: PATIENT },
      { kind: "appointment", id: APPOINTMENT },
    ],
    [signal],
    "2026-07-03T08:00:00.000Z"
  );
  assert.equal(Object.keys(updates).length, 2);
});

test("shouldSkipDuplicateRevisionTick ignores unchanged revision", () => {
  assert.equal(shouldSkipDuplicateRevisionTick("abc", "abc"), true);
  assert.equal(shouldSkipDuplicateRevisionTick("abc", "def"), false);
});
