import assert from "node:assert/strict";
import { test } from "node:test";

import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";
import type { PresenceSummary } from "@/src/lib/fiOs/presence/presenceTypes";
import type { WorkspaceSignalPayload } from "@/src/lib/fiOs/workspaceSignal/workspaceSignalRegistry";
import {
  FORBIDDEN_CLIENT_PAYLOAD_KEYS,
  validateLearningSafety,
  validatePresenceSafety,
  validateTodayFeedPrivacy,
  validateTodayFeedSafety,
  validateWorkspaceSyncSafety,
} from "@/src/lib/fiOs/todaySignal/todaySignalRuntimeValidation";

function feedItem(overrides: Partial<TodayFeedItem> & Pick<TodayFeedItem, "id">): TodayFeedItem {
  return {
    personLabel: "",
    actionLabel: "Action",
    href: "/x",
    severity: "normal",
    bucket: "right_now",
    priorityScore: 50,
    autoResolves: true,
    ...overrides,
  };
}

function presenceSummary(overrides: Partial<PresenceSummary> = {}): PresenceSummary {
  return {
    tenantId: "tenant-a",
    snapshots: [],
    operationalStatus: {
      headline: "Clinic coverage looks steady",
      chips: [],
      tone: "active",
    },
    escalationHints: [],
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("invalid priority score is flagged", () => {
  const results = validateTodayFeedSafety([
    feedItem({ id: "a", priorityScore: 150, priorityBand: "high" }),
  ]);
  const scoreCheck = results.find((r) => r.checkId === "feed.invalid_priority_score");
  assert.equal(scoreCheck?.status, "fail");
});

test("invalid priority band is flagged", () => {
  const results = validateTodayFeedSafety([
    feedItem({ id: "a", priorityScore: 40, priorityBand: "critical" }),
  ]);
  const bandCheck = results.find((r) => r.checkId === "feed.priority_band_mismatch");
  assert.equal(bandCheck?.status, "fail");
});

test("forbidden PHI-like keys are flagged", () => {
  const results = validateTodayFeedPrivacy([
    { revision: "abc", patientName: "Jane Doe" },
  ]);
  assert.equal(results[0]?.status, "fail");
  assert.match(results[0]?.message ?? "", /patientName/);
});

test("safe payload passes privacy check", () => {
  const results = validateTodayFeedPrivacy([
    {
      revision: "deadbeef",
      workspaceSignals: [{ signalType: "arrival_intent", reasonLabel: "Arrival status changed" }],
    },
  ]);
  assert.equal(results[0]?.status, "pass");
});

test("presence banned wording is flagged", () => {
  const results = validatePresenceSafety(
    presenceSummary({
      operationalStatus: {
        headline: "Reception appears absent today",
        chips: [],
        tone: "watch",
      },
    })
  );
  const wording = results.find((r) => r.checkId === "presence.banned_wording");
  assert.equal(wording?.status, "fail");
});

test("safe presence wording passes", () => {
  const results = validatePresenceSafety(
    presenceSummary({
      operationalStatus: {
        headline: "Reception not confirmed",
        subline: "Patient arrival needs confirmation",
        chips: [{ id: "1", label: "Appears unattended", tone: "watch" }],
        tone: "watch",
      },
    })
  );
  assert.equal(results.find((r) => r.checkId === "presence.banned_wording")?.status, "pass");
});

test("calendar mapping is flagged if present", () => {
  const signals: WorkspaceSignalPayload[] = [
    {
      signalType: "arrival_intent",
      targetRefs: [{ kind: "calendar" as never, id: "cal-1" }],
      timestamp: new Date().toISOString(),
      reasonLabel: "Calendar update",
    },
  ];
  const results = validateWorkspaceSyncSafety({ signals, syncEnabled: true });
  assert.equal(results.find((r) => r.checkId === "workspace.calendar_mapping")?.status, "fail");
});

test("learning disabled state is handled as pass, not fail", () => {
  const results = validateLearningSafety({
    enabled: false,
    observationCount: 0,
    metadataSamples: [],
  });
  assert.equal(results.find((r) => r.checkId === "learning.disabled_clean")?.status, "pass");
  assert.equal(results.find((r) => r.checkId === "learning.metadata_sanitized")?.status, "not_applicable");
});

test("forbidden keys list covers required D6F privacy tokens", () => {
  for (const key of [
    "patientName",
    "displayName",
    "amount",
    "pathologyText",
    "clinicalNotes",
    "consultationNotes",
    "priorityReasons",
    "metadata",
  ]) {
    assert.ok(FORBIDDEN_CLIENT_PAYLOAD_KEYS.includes(key));
  }
});
