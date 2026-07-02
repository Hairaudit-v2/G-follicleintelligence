import assert from "node:assert/strict";
import { test } from "node:test";

import {
  compareTodayFeedItems,
  coveredAggregateKeys,
  entityAttentionItems,
  NAMED_ENTITY_PRIORITY_BOOST,
} from "@/src/lib/fiOs/todayFeedEntityAttention";
import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";

test("entityAttentionItems applies named-entity priority boost", () => {
  const items = entityAttentionItems(
    [
      {
        id: "entity-1",
        category: "financial",
        aggregateKey: "surgery_payment",
        personLabel: "Sarah Chen",
        actionLabel: "Sarah payment overdue",
        href: "/fi-admin/t1/financial/payments/x",
        severity: "warning",
        bucket: "right_now",
        priorityScore: 50,
      },
    ],
    { categoryWeight: () => 1 }
  );
  assert.equal(items[0]?.priorityScore, 50 + NAMED_ENTITY_PRIORITY_BOOST);
  assert.equal(items[0]?.personLabel, "Sarah Chen");
});

test("coveredAggregateKeys collects aggregate suppression keys", () => {
  const keys = coveredAggregateKeys([
    {
      id: "a",
      category: "surgery",
      aggregateKey: "surgery_readiness",
      personLabel: "Marcus Reid",
      actionLabel: "Prep incomplete",
      href: "/cases/x",
      severity: "critical",
      bucket: "right_now",
      priorityScore: 90,
    },
    {
      id: "b",
      category: "consultation",
      aggregateKey: "consultations",
      personLabel: "Emma Walsh",
      actionLabel: "Consultation open",
      href: "/consultations/y",
      severity: "normal",
      bucket: "up_next",
      priorityScore: 60,
    },
  ]);
  assert.deepEqual([...keys].sort(), ["consultations", "surgery_readiness"]);
});

test("compareTodayFeedItems prefers named entities over aggregates", () => {
  const named: TodayFeedItem = {
    id: "named",
    personLabel: "Sarah Chen",
    actionLabel: "Payment overdue",
    href: "/x",
    severity: "normal",
    bucket: "up_next",
    priorityScore: 10,
    autoResolves: true,
  };
  const aggregate: TodayFeedItem = {
    id: "aggregate",
    personLabel: "",
    actionLabel: "3 payments need attention",
    href: "/financial/dashboard",
    severity: "critical",
    bucket: "right_now",
    priorityScore: 9999,
    autoResolves: true,
  };
  assert.ok(compareTodayFeedItems(aggregate, named) > 0);
});
