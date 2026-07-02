import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";

/** Presentation-layer grouping — keeps shadow diff on raw `buildTodayFeed` output. */
export function groupTodayFeedItems(items: readonly TodayFeedItem[]): TodayFeedItem[] {
  const result: TodayFeedItem[] = [];
  const grouped = new Map<string, TodayFeedItem[]>();

  for (const item of items) {
    if (!item.groupKey) {
      result.push(item);
      continue;
    }
    const bucket = grouped.get(item.groupKey) ?? [];
    bucket.push(item);
    grouped.set(item.groupKey, bucket);
  }

  for (const [groupKey, members] of grouped) {
    if (members.length === 1) {
      result.push(members[0]!);
      continue;
    }

    const sorted = [...members].sort((a, b) => b.priorityScore - a.priorityScore);
    const lead = sorted[0]!;
    const count = members.length;

    result.push({
      ...lead,
      id: `group-${groupKey}`,
      personLabel: "",
      actionLabel: groupLabelForKey(groupKey, count),
      detailLine: groupDetailForKey(groupKey, count),
      groupMembers: sorted,
      priorityScore: Math.max(...members.map((m) => m.priorityScore)),
    });
  }

  return result.sort((a, b) => b.priorityScore - a.priorityScore);
}

function groupLabelForKey(groupKey: string, count: number): string {
  if (groupKey === "reception:arriving_soon") {
    return `${count} patients arriving within the next 30 minutes`;
  }
  if (groupKey === "reception:waiting") {
    return `${count} patients waiting to be seen`;
  }
  if (groupKey === "reception:in_clinic") {
    return `${count} patients currently in clinic`;
  }
  return `${count} similar items need attention`;
}

function groupDetailForKey(groupKey: string, count: number): string {
  if (groupKey === "reception:arriving_soon") {
    return `Expand to see each arrival`;
  }
  if (groupKey === "reception:waiting") {
    return `${count} people checked in and waiting`;
  }
  return `Tap to expand ${count} items`;
}
