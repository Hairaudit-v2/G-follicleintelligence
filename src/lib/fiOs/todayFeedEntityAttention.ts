import type {
  TodayFeedBucket,
  TodayFeedItem,
  TodayFeedSeverity,
} from "@/src/lib/fiOs/todayFeedDerive";

/** FI-UX-REBUILD D5 — named operational work surfaced from entity resolution. */
export type TodayEntityAttentionCategory =
  | "financial"
  | "surgery"
  | "pathology"
  | "consultation"
  | "staff";

export type TodayEntityAttentionSignal = {
  id: string;
  category: TodayEntityAttentionCategory;
  /** Maps to legacy aggregate fallback id — suppresses module hub row when covered. */
  aggregateKey: string;
  personLabel: string;
  actionLabel: string;
  detailLine?: string;
  actionHint?: string;
  href: string;
  severity: TodayFeedSeverity;
  bucket: TodayFeedBucket;
  priorityScore: number;
  groupKey?: string;
};

/** Named entity items outrank aggregate summaries in Today buckets. */
export const NAMED_ENTITY_PRIORITY_BOOST = 1_000;

export function entityAttentionItems(
  signals: readonly TodayEntityAttentionSignal[],
  opts: { categoryWeight: (category: TodayEntityAttentionCategory) => number }
): TodayFeedItem[] {
  return signals.map((s) => {
    const weight = opts.categoryWeight(s.category);
    return {
      id: s.id,
      personLabel: s.personLabel,
      actionLabel: s.actionLabel,
      detailLine: s.detailLine,
      actionHint: s.actionHint,
      href: s.href,
      severity: s.severity,
      bucket: s.bucket,
      priorityScore: (s.priorityScore + NAMED_ENTITY_PRIORITY_BOOST) * weight,
      autoResolves: true,
      groupKey: s.groupKey,
    } satisfies TodayFeedItem;
  });
}

export function coveredAggregateKeys(signals: readonly TodayEntityAttentionSignal[]): Set<string> {
  return new Set(signals.map((s) => s.aggregateKey));
}

export function compareTodayFeedItems(a: TodayFeedItem, b: TodayFeedItem): number {
  const aNamed = a.personLabel.trim() ? 1 : 0;
  const bNamed = b.personLabel.trim() ? 1 : 0;
  if (aNamed !== bNamed) return bNamed - aNamed;

  const severityRank: Record<TodayFeedSeverity, number> = {
    critical: 3,
    warning: 2,
    normal: 1,
  };
  const sevDiff = severityRank[b.severity] - severityRank[a.severity];
  if (sevDiff !== 0) return sevDiff;

  return b.priorityScore - a.priorityScore;
}
