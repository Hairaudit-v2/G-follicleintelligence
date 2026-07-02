import assert from "node:assert/strict";
import { test } from "node:test";

import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";
import {
  assertWorkspaceSignalRegistryPrivacy,
  deriveWorkspaceSignalsFromTodayFeedItems,
  getWorkspaceKindsForSignal,
  getWorkspaceSignalReason,
  mapTodaySignalKindToWorkspaceSignalKind,
  normalizeTodayFeedItemToWorkspaceSignal,
  shouldWorkspaceRevalidateForSignal,
} from "@/src/lib/fiOs/workspaceSignal/workspaceSignalRegistry";

const PATIENT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const APPOINTMENT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PAYMENT = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const SURGERY = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const LEAD = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const PATHOLOGY = "ffffffff-ffff-ffff-ffff-ffffffffffff";

function feedItem(overrides: Partial<TodayFeedItem> & Pick<TodayFeedItem, "id">): TodayFeedItem {
  return {
    personLabel: "James Morrison",
    actionLabel: "James says they're here",
    detailLine: "Awaiting reception confirmation",
    href: `/fi-admin/t1/patients/${PATIENT}`,
    severity: "critical",
    bucket: "right_now",
    priorityScore: 88,
    autoResolves: true,
    groupKey: "reception:arrival_intent",
    ...overrides,
  };
}

test("arrival_intent maps to patient + appointment targets", () => {
  const kinds = getWorkspaceKindsForSignal("arrival_intent");
  assert.deepEqual(kinds, ["appointment", "patient", "consultation"]);

  const signal = normalizeTodayFeedItemToWorkspaceSignal(
    feedItem({ id: `reception-${APPOINTMENT}` })
  );
  assert.ok(signal);
  assert.equal(signal.signalType, "arrival_intent");
  assert.ok(
    signal.targetRefs.some((r) => r.kind === "appointment" && r.id === APPOINTMENT)
  );
  assert.ok(signal.targetRefs.some((r) => r.kind === "patient" && r.id === PATIENT));
});

test("payment_received maps to payment + patient + surgery_case kinds", () => {
  const kinds = getWorkspaceKindsForSignal("payment_received");
  assert.deepEqual(kinds, ["payment", "patient", "surgery_case"]);

  const signal = normalizeTodayFeedItemToWorkspaceSignal(
    feedItem({
      id: `entity-financial-clearance-${PAYMENT}`,
      href: `/fi-admin/t1/financial/payments/${PAYMENT}`,
      groupKey: "entity:financial_clearance",
      actionLabel: "Payment cleared",
    })
  );
  assert.ok(signal);
  assert.equal(signal.signalType, "payment_received");
  assert.ok(signal.targetRefs.some((r) => r.kind === "payment" && r.id === PAYMENT));
});

test("pathology_review_pending maps to pathology_result + patient kinds", () => {
  const kinds = getWorkspaceKindsForSignal("pathology_review_pending");
  assert.deepEqual(kinds, ["pathology_result", "patient", "consultation"]);

  const signal = normalizeTodayFeedItemToWorkspaceSignal(
    feedItem({
      id: `entity-pathology-${PATHOLOGY}`,
      href: `/fi-admin/t1/patients/${PATIENT}/blood-results/${PATHOLOGY}`,
      groupKey: "entity:pathology_review",
      actionLabel: "Review pathology result",
    })
  );
  assert.ok(signal);
  assert.equal(signal.signalType, "pathology_review_pending");
  assert.ok(
    signal.targetRefs.some((r) => r.kind === "pathology_result" && r.id === PATHOLOGY)
  );
  assert.ok(signal.targetRefs.some((r) => r.kind === "patient" && r.id === PATIENT));
});

test("lead_stale maps only to lead workspace kind", () => {
  assert.deepEqual(getWorkspaceKindsForSignal("lead_stale"), ["lead"]);

  const signal = normalizeTodayFeedItemToWorkspaceSignal(
    feedItem({
      id: `stale-lead-${LEAD}`,
      href: `/fi-admin/t1/crm/leads/${LEAD}`,
      groupKey: undefined,
      actionLabel: "Call lead",
    })
  );
  assert.ok(signal);
  assert.equal(signal.signalType, "lead_stale");
  assert.deepEqual(signal.targetRefs, [{ kind: "lead", id: LEAD }]);
});

test("unknown Today signal returns null from normalization", () => {
  const signal = normalizeTodayFeedItemToWorkspaceSignal(
    feedItem({
      id: "task-123",
      href: "/fi-admin/t1/tasks/123",
      groupKey: undefined,
      actionLabel: "Task due",
    })
  );
  assert.equal(signal, null);
  assert.equal(mapTodaySignalKindToWorkspaceSignalKind("task_due"), null);
});

test("registry never maps to calendar", () => {
  assert.doesNotThrow(() => assertWorkspaceSignalRegistryPrivacy());
  for (const signalType of [
    "arrival_intent",
    "payment_blocker",
    "pathology_review_pending",
    "lead_stale",
    "staff_compliance_alert",
  ] as const) {
    for (const kind of getWorkspaceKindsForSignal(signalType)) {
      assert.notEqual(kind, "calendar");
    }
  }
});

test("reason labels are safe and do not include entity IDs", () => {
  const reason = getWorkspaceSignalReason("payment_blocker", "payment");
  assert.match(reason, /payment status changed/i);
  assert.doesNotMatch(reason, /[0-9a-f]{8}-/i);
  assert.doesNotMatch(reason, /\$/);
});

test("normalization from TodayFeedItem strips names and free text", () => {
  const signal = normalizeTodayFeedItemToWorkspaceSignal(
    feedItem({
      id: `reception-${APPOINTMENT}`,
      personLabel: "James Morrison",
      actionLabel: "James says they're here",
      detailLine: "Private clinical note",
    })
  );
  assert.ok(signal);
  const serialized = JSON.stringify(signal);
  assert.doesNotMatch(serialized, /James/i);
  assert.doesNotMatch(serialized, /clinical note/i);
  assert.doesNotMatch(serialized, /personLabel/);
  assert.doesNotMatch(serialized, /actionLabel/);
});

test("shouldWorkspaceRevalidateForSignal matches only targeted open workspaces", () => {
  const signal = normalizeTodayFeedItemToWorkspaceSignal(
    feedItem({ id: `reception-${APPOINTMENT}` })
  );
  assert.ok(signal);

  assert.equal(
    shouldWorkspaceRevalidateForSignal({ kind: "patient", id: PATIENT }, signal),
    true
  );
  assert.equal(
    shouldWorkspaceRevalidateForSignal(
      { kind: "patient", id: "99999999-0000-0000-0000-000000000099" },
      signal
    ),
    false
  );
  assert.equal(
    shouldWorkspaceRevalidateForSignal({ kind: "lead", id: LEAD }, signal),
    false
  );
});

test("payment blocker revalidates surgery_case when targeted", () => {
  const signal = normalizeTodayFeedItemToWorkspaceSignal(
    feedItem({
      id: `entity-surgery-payment-${SURGERY}`,
      href: `/fi-admin/t1/cases/${SURGERY}`,
      groupKey: "entity:surgery_payment",
      actionLabel: "Surgery payment overdue",
    })
  );
  assert.ok(signal);
  assert.equal(
    shouldWorkspaceRevalidateForSignal({ kind: "surgery_case", id: SURGERY }, signal),
    true
  );
});

test("deriveWorkspaceSignalsFromTodayFeedItems preserves order and skips unknown", () => {
  const items = [
    feedItem({ id: `reception-${APPOINTMENT}` }),
    feedItem({
      id: "reminder-1",
      href: "/x",
      actionLabel: "Reminder",
      groupKey: "",
    }),
    feedItem({
      id: `stale-lead-${LEAD}`,
      href: `/fi-admin/t1/crm/leads/${LEAD}`,
      actionLabel: "Follow up",
      groupKey: "",
    }),
  ];
  const signals = deriveWorkspaceSignalsFromTodayFeedItems(items, "2026-07-03T08:00:00.000Z");
  assert.equal(signals.length, 2);
  assert.equal(signals[0]?.signalType, "arrival_intent");
  assert.equal(signals[1]?.signalType, "lead_stale");
});
