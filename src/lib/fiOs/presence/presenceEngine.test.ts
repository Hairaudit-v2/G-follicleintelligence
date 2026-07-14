import assert from "node:assert/strict";
import { test } from "node:test";

import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";
import {
  applyPresenceToTodayItems,
  derivePatientPresenceFromTodayItems,
  derivePresenceSnapshots,
  getPresenceEscalationSignals,
  presenceSnapshotsAvoidCalendarMappings,
  scorePresenceConfidence,
  summarizePresenceForToday,
} from "@/src/lib/fiOs/presence/presenceEngine";
import type { PresenceEngineContext } from "@/src/lib/fiOs/presence/presenceTypes";

const TENANT = "00000000-0000-0000-0000-000000000001";

function context(overrides: Partial<PresenceEngineContext> = {}): PresenceEngineContext {
  return {
    tenantId: TENANT,
    nowIso: "2026-06-10T12:00:00.000Z",
    withinOperatingWindow: true,
    viewerSessionActive: true,
    ...overrides,
  };
}

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

test("patient arrival intent derives patient presence snapshot", () => {
  const items = [
    feedItem({
      id: "reception-1",
      personLabel: "James Morrison",
      actionLabel: "James says they're here",
      groupKey: "reception:arrival_intent",
      severity: "critical",
    }),
  ];

  const snapshots = derivePatientPresenceFromTodayItems(items, context());
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.signalKind, "patient_arrival_intent");
  assert.equal(snapshots[0]?.state, "expected");
  assert.equal(snapshots[0]?.safeLabel, "Patient arrival intent");
});

test("checked-in booking derives present patient state", () => {
  const items = [
    feedItem({
      id: "reception-2",
      personLabel: "Sarah Chen",
      actionLabel: "Sarah is waiting",
      groupKey: "reception:waiting",
      severity: "warning",
    }),
  ];

  const snapshots = derivePatientPresenceFromTodayItems(items, context());
  assert.equal(snapshots[0]?.signalKind, "patient_checked_in");
  assert.equal(snapshots[0]?.state, "present");
});

test("no reception activity + arrival intent derives clinic_unattended candidate", () => {
  const items = [
    feedItem({
      id: "reception-3",
      actionLabel: "Patient says they're here",
      groupKey: "reception:arrival_intent",
      severity: "critical",
    }),
  ];

  const snapshots = derivePresenceSnapshots({
    context: context({ profileKey: "doctor" }),
    todayItems: items,
    receptionCards: [],
  });

  assert.ok(snapshots.some((s) => s.signalKind === "clinic_unattended"));
  assert.ok(snapshots.some((s) => s.signalKind === "reception_missing"));
});

test("reception unknown escalates arrival urgency", () => {
  const items = [
    feedItem({
      id: "reception-4",
      actionLabel: "Patient says they're here",
      groupKey: "reception:arrival_intent",
      severity: "critical",
      priorityScore: 80,
    }),
  ];

  const snapshots = derivePresenceSnapshots({
    context: context(),
    todayItems: items,
    receptionCards: [],
  });
  const summary = summarizePresenceForToday(snapshots, context());
  const [adjusted] = applyPresenceToTodayItems(items, summary);

  assert.ok(summary.escalationHints.includes("reception_unknown_escalates_arrival"));
  assert.equal(adjusted?.actionHint, "Confirm check-in when reception is available");
  assert.ok((adjusted?.priorityScore ?? 0) > 80);
});

test("surgery team incomplete presence signal escalates readiness blocker", () => {
  const items = [
    feedItem({
      id: "entity-surgery-readiness-1",
      actionLabel: "Surgery preparation incomplete",
      detailLine: "Procedure tomorrow — case not linked yet",
      groupKey: "entity:surgery_readiness",
      severity: "critical",
      priorityScore: 70,
    }),
    feedItem({
      id: "entity-staff-1",
      actionLabel: "Credential expiry",
      detailLine: "Surgery staffing credential expires before next procedure",
      groupKey: "entity:staff_compliance",
      severity: "critical",
      priorityScore: 65,
    }),
  ];

  const snapshots = derivePresenceSnapshots({
    context: context(),
    todayItems: items,
    receptionCards: [],
  });
  const summary = summarizePresenceForToday(snapshots, context());
  const adjusted = applyPresenceToTodayItems(items, summary);
  const surgery = adjusted.find((i) => i.id === "entity-surgery-readiness-1");

  assert.ok(snapshots.some((s) => s.signalKind === "surgery_team_incomplete"));
  assert.equal(surgery?.severity, "critical");
  assert.ok(surgery?.priorityReasons?.includes("Team readiness needs confirmation"));
});

test("confidence is low when inferred from weak signals", () => {
  const snapshots = derivePresenceSnapshots({
    context: context({ staffOnDutyCount: 2, profileKey: "auditor" }),
    todayItems: [],
    receptionCards: [],
  });

  const staffSignal = snapshots.find((s) => s.source === "dashboard:booking_assignment");
  assert.ok(staffSignal);
  assert.equal(scorePresenceConfidence(staffSignal!), "low");
});

test("presence summary does not expose names or entity IDs", () => {
  const items = [
    feedItem({
      id: "reception-5",
      personLabel: "James Morrison",
      actionLabel: "James says they're here",
      groupKey: "reception:arrival_intent",
    }),
  ];

  const snapshots = derivePresenceSnapshots({
    context: context(),
    todayItems: items,
    receptionCards: [
      {
        id: "55555555-0000-0000-0000-000000000001",
        startAt: "2026-06-10T12:00:00.000Z",
        endAt: "2026-06-10T12:30:00.000Z",
        title: null,
        bookingType: "consult",
        bookingStatus: "confirmed",
        timezone: "UTC",
        leadId: null,
        patientId: "22222222-0000-0000-0000-000000000001",
        displayName: "James Morrison",
        statusLabel: "Confirmed",
        typeLabel: "Consultation",
        providerLabel: "",
        clinicLabel: null,
        roomLabel: null,
        receptionColumn: "expected",
        metadata: {
          fi_arrival_intent_at: "2026-06-10T12:00:00.000Z",
        },
      },
    ],
  });

  const summary = summarizePresenceForToday(snapshots, context());
  const serialized = JSON.stringify(summary);

  assert.doesNotMatch(serialized, /James|Morrison|22222222/);
  assert.doesNotMatch(summary.operationalStatus.headline, /James/);
  for (const chip of summary.operationalStatus.chips) {
    assert.doesNotMatch(chip.label, /James|patient id/i);
  }
});

test("unknown source returns safe unknown state", () => {
  const snapshots = derivePresenceSnapshots({
    context: context({ profileKey: "default", viewerSessionActive: false }),
    todayItems: [],
    receptionCards: [],
  });

  const clinic = snapshots.find((s) => s.actorKind === "clinic");
  assert.ok(clinic);
  assert.equal(clinic?.state, "unknown");
  assert.match(clinic?.safeLabel ?? "", /unknown/i);
});

test("presence does not produce Calendar workspace mappings", () => {
  const items = [
    feedItem({
      id: "reception-6",
      groupKey: "reception:arrival_intent",
      actionLabel: "Here",
    }),
  ];

  const snapshots = derivePresenceSnapshots({
    context: context(),
    todayItems: items,
    receptionCards: [],
  });

  assert.equal(presenceSnapshotsAvoidCalendarMappings(snapshots), true);
  assert.equal(getPresenceEscalationSignals(snapshots, context()).length >= 0, true);
});

test("reception profile session marks reception as covered", () => {
  const snapshots = derivePresenceSnapshots({
    context: context({ profileKey: "reception" }),
    todayItems: [],
    receptionCards: [],
  });

  assert.ok(snapshots.some((s) => s.role === "reception" && s.signalKind === "role_covered"));
  assert.ok(!snapshots.some((s) => s.signalKind === "clinic_unattended"));
});

test("summarizePresenceForToday: unknown clinic avoids generic Ready for consult chip", () => {
  const items = [
    feedItem({
      id: "entity-consultation-draft",
      personLabel: "Michael",
      actionLabel: "Michael — draft consultation waiting to begin",
      groupKey: "entity:consultation",
      severity: "normal",
    }),
  ];

  const snapshots = derivePresenceSnapshots({
    context: context({ profileKey: "platform_admin", viewerSessionActive: false }),
    todayItems: items,
    receptionCards: [],
  });
  const summary = summarizePresenceForToday(snapshots, context());

  assert.match(summary.operationalStatus.headline ?? "", /unknown/i);
  assert.ok(
    !summary.operationalStatus.chips.some((c) => c.label === "Ready for consult"),
    "generic consult-ready chip should not appear when clinic status is unknown"
  );
  assert.ok(summary.operationalStatus.chips.some((c) => c.label === "Consult readiness watch"));
});

test("summarizePresenceForToday: patient in consultation keeps Ready for consult chip", () => {
  const snapshots = derivePresenceSnapshots({
    context: context(),
    todayItems: [],
    receptionCards: [
      {
        id: "55555555-0000-0000-0000-000000000001",
        startAt: "2026-06-10T12:00:00.000Z",
        endAt: "2026-06-10T12:30:00.000Z",
        title: null,
        bookingType: "consult",
        bookingStatus: "in_progress",
        timezone: "UTC",
        leadId: null,
        patientId: "22222222-0000-0000-0000-000000000001",
        displayName: "Sarah Chen",
        statusLabel: "In consultation",
        typeLabel: "Consultation",
        providerLabel: "",
        clinicLabel: null,
        roomLabel: null,
        receptionColumn: "in_consultation",
        metadata: {},
      },
    ],
  });
  const summary = summarizePresenceForToday(snapshots, context());

  assert.ok(summary.operationalStatus.chips.some((c) => c.label === "Ready for consult"));
});
