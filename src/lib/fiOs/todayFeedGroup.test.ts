import assert from "node:assert/strict";
import { test } from "node:test";

import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";
import { groupTodayFeedItems } from "@/src/lib/fiOs/todayFeedGroup";

function receptionItem(id: string, name: string): TodayFeedItem {
  return {
    id: `reception-${id}`,
    personLabel: name,
    actionLabel: `${name.split(" ")[0]} arriving in 5 minutes`,
    detailLine: "Appointment starting soon",
    actionHint: "Check in",
    href: `/fi-admin/t1/patients/${id}`,
    severity: "warning",
    bucket: "right_now",
    priorityScore: 85,
    autoResolves: true,
    groupKey: "reception:arriving_soon",
  };
}

test("groupTodayFeedItems: collapses 4 arriving-soon cards into one group row", () => {
  const items = [
    receptionItem("1", "SMOKETEST Patient A"),
    receptionItem("2", "SMOKETEST Patient B"),
    receptionItem("3", "SMOKETEST Patient C"),
    receptionItem("4", "SMOKETEST Patient D"),
  ];

  const grouped = groupTodayFeedItems(items);
  assert.equal(grouped.length, 1);
  assert.match(grouped[0]?.actionLabel ?? "", /4 patients arriving/i);
  assert.equal(grouped[0]?.groupMembers?.length, 4);
});

test("groupTodayFeedItems: leaves singleton groupKey items ungrouped", () => {
  const items = [receptionItem("1", "James Morrison")];
  const grouped = groupTodayFeedItems(items);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0]?.id, "reception-1");
  assert.equal(grouped[0]?.groupMembers, undefined);
});
