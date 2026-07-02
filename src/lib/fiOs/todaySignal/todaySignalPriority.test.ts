import assert from "node:assert/strict";
import { test } from "node:test";

import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";
import {
  applyTodaySignalPriority,
  classifyTodaySignalPriority,
  comparePrioritisedTodaySignals,
  inferTodaySignalKind,
  scoreTodaySignalPriority,
} from "@/src/lib/fiOs/todaySignal/todaySignalPriority";

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

test("arrival intent outranks stale lead for reception profile", () => {
  const arrival = feedItem({
    id: "reception-1",
    personLabel: "James Morrison",
    actionLabel: "James says they're here",
    groupKey: "reception:arrival_intent",
    severity: "critical",
    bucket: "right_now",
  });
  const staleLead = feedItem({
    id: "stale-lead-1",
    personLabel: "Emma Walsh",
    actionLabel: "Call Emma",
    detailLine: "No follow-up for 20 days",
    severity: "warning",
    bucket: "right_now",
  });

  const receptionContext = { profileKey: "reception" as const };
  const arrivalScore = scoreTodaySignalPriority(arrival, receptionContext).priorityScore;
  const staleScore = scoreTodaySignalPriority(staleLead, receptionContext).priorityScore;

  assert.ok(arrivalScore > staleScore);
  assert.ok(
    comparePrioritisedTodaySignals(arrival, staleLead, receptionContext) < 0,
    "arrival should sort before stale lead"
  );
});

test("surgery payment blocker tomorrow ranks critical", () => {
  const payment = feedItem({
    id: "entity-surgery-payment-1",
    personLabel: "Sarah Chen",
    actionLabel: "Sarah needs payment attention",
    detailLine: "Procedure tomorrow — deposit required",
    groupKey: "entity:surgery_payment",
    severity: "warning",
    bucket: "right_now",
  });

  const result = scoreTodaySignalPriority(payment, { profileKey: "clinic_manager" });
  assert.equal(result.priorityBand, "critical");
  assert.ok(result.priorityScore >= 80);
  assert.ok(result.priorityReasons.some((r) => /surgery tomorrow/i.test(r)));
});

test("pathology review ranks higher for doctor than reception", () => {
  const pathology = feedItem({
    id: "entity-pathology-1",
    personLabel: "Tom Williams",
    actionLabel: "Review Tom pathology result",
    detailLine: "Blood result awaiting clinical review",
    groupKey: "entity:pathology_review",
    severity: "warning",
    bucket: "up_next",
  });

  const doctorScore = scoreTodaySignalPriority(pathology, { profileKey: "doctor" }).priorityScore;
  const receptionScore = scoreTodaySignalPriority(pathology, { profileKey: "reception" }).priorityScore;

  assert.ok(doctorScore > receptionScore);
});

test("stale lead ranks higher for consultant than surgeon", () => {
  const staleLead = feedItem({
    id: "stale-lead-2",
    personLabel: "Alex Rivera",
    actionLabel: "Call Alex",
    detailLine: "No follow-up for 12 days",
    severity: "warning",
    bucket: "up_next",
  });

  const consultantScore = scoreTodaySignalPriority(staleLead, { profileKey: "consultant" }).priorityScore;
  const surgeonScore = scoreTodaySignalPriority(staleLead, { profileKey: "surgeon" }).priorityScore;

  assert.ok(consultantScore > surgeonScore);
});

test("staff compliance blocker ranks high for clinic_manager", () => {
  const staff = feedItem({
    id: "entity-staff-1",
    personLabel: "Dr Patel",
    actionLabel: "Dr Patel — credential expiry",
    detailLine: "Surgery staffing credential expires before next procedure",
    groupKey: "entity:staff_compliance",
    severity: "critical",
    bucket: "right_now",
  });

  const managerScore = scoreTodaySignalPriority(staff, { profileKey: "clinic_manager" }).priorityScore;
  const auditorScore = scoreTodaySignalPriority(staff, { profileKey: "auditor" }).priorityScore;

  assert.ok(managerScore > auditorScore);
  assert.ok(managerScore >= 60);
});

test("existing critical severity is not downgraded", () => {
  const surgery = feedItem({
    id: "entity-surgery-readiness-1",
    personLabel: "Marcus Reid",
    actionLabel: "Marcus surgery preparation incomplete",
    detailLine: "Procedure in 5 days — case not linked yet",
    groupKey: "entity:surgery_readiness",
    severity: "critical",
    bucket: "right_now",
  });

  const result = scoreTodaySignalPriority(surgery, { profileKey: "surgeon" });
  assert.equal(result.severity, "critical");
});

test("scoring is deterministic", () => {
  const item = feedItem({
    id: "reception-2",
    personLabel: "Sarah Chen",
    actionLabel: "Sarah is waiting",
    groupKey: "reception:waiting",
    severity: "warning",
    bucket: "right_now",
  });

  const a = scoreTodaySignalPriority(item, { profileKey: "reception" });
  const b = scoreTodaySignalPriority(item, { profileKey: "reception" });

  assert.deepEqual(a, b);
});

test("sorting is stable for equal scores", () => {
  const itemA = feedItem({
    id: "aaa-item",
    personLabel: "A",
    actionLabel: "Same action",
    groupKey: "reception:in_clinic",
    priorityScore: 40,
    severity: "normal",
  });
  const itemB = feedItem({
    id: "bbb-item",
    personLabel: "B",
    actionLabel: "Same action",
    groupKey: "reception:in_clinic",
    priorityScore: 40,
    severity: "normal",
  });

  const scored = applyTodaySignalPriority([itemA, itemB], { profileKey: "reception" });
  assert.equal(scored[0]?.priorityScore, scored[1]?.priorityScore);
  assert.equal(scored[0]?.id, "aaa-item");
  assert.equal(scored[1]?.id, "bbb-item");
  assert.ok(comparePrioritisedTodaySignals(scored[0]!, scored[1]!) < 0);
  assert.ok(comparePrioritisedTodaySignals(scored[1]!, scored[0]!) > 0);
});

test("classifyTodaySignalPriority maps stable bands", () => {
  assert.equal(classifyTodaySignalPriority(85), "critical");
  assert.equal(classifyTodaySignalPriority(80), "critical");
  assert.equal(classifyTodaySignalPriority(79), "high");
  assert.equal(classifyTodaySignalPriority(60), "high");
  assert.equal(classifyTodaySignalPriority(59), "medium");
  assert.equal(classifyTodaySignalPriority(35), "medium");
  assert.equal(classifyTodaySignalPriority(34), "low");
});

test("inferTodaySignalKind detects key signal types", () => {
  assert.equal(
    inferTodaySignalKind(
      feedItem({
        id: "reception-x",
        groupKey: "reception:arrival_intent",
        actionLabel: "Here",
      })
    ),
    "arrival_intent"
  );
  assert.equal(
    inferTodaySignalKind(
      feedItem({
        id: "entity-pathology-x",
        groupKey: "entity:pathology_review",
        actionLabel: "Review",
      })
    ),
    "pathology_review"
  );
  assert.equal(
    inferTodaySignalKind(
      feedItem({
        id: "stale-lead-x",
        actionLabel: "Call",
      })
    ),
    "stale_lead"
  );
});

test("applyTodaySignalPriority enriches items with priority metadata", () => {
  const item = feedItem({
    id: "reception-3",
    personLabel: "James",
    actionLabel: "James says they're here",
    groupKey: "reception:arrival_intent",
    severity: "critical",
  });

  const [enriched] = applyTodaySignalPriority([item], { profileKey: "reception" });
  assert.ok(enriched?.priorityBand);
  assert.ok(enriched?.priorityReasons?.length);
  assert.ok(enriched?.priorityDimensions);
  assert.equal(typeof enriched?.priorityScore, "number");
});
