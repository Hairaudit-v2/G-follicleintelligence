import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";

/** FI-UX-REBUILD D5 — collapse entity/reception rows when 3+ share a groupKey. */
export const ENTITY_GROUP_MIN_COUNT = 3;

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
    if (members.length < ENTITY_GROUP_MIN_COUNT) {
      result.push(...members);
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
  if (groupKey === "reception:arrival_intent") {
    return `${count} patients say they're here`;
  }
  if (groupKey === "reception:waiting") {
    return `${count} patients waiting to be seen`;
  }
  if (groupKey === "reception:in_clinic") {
    return `${count} patients currently in clinic`;
  }
  if (groupKey === "entity:pathology_review") {
    return `${count} pathology results need review`;
  }
  if (groupKey === "entity:payment_overdue" || groupKey === "entity:surgery_payment") {
    return `${count} payments need attention`;
  }
  if (groupKey === "entity:financial_clearance") {
    return `${count} surgeries need financial clearance`;
  }
  if (groupKey === "entity:surgery_readiness") {
    return `${count} surgery preparation items incomplete`;
  }
  if (groupKey === "entity:consultation") {
    return `${count} consultations need completion`;
  }
  if (groupKey === "entity:staff_compliance") {
    return `${count} staff compliance items need attention`;
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
  if (groupKey.startsWith("entity:")) {
    return `Expand to see each person`;
  }
  return `Tap to expand ${count} items`;
}
