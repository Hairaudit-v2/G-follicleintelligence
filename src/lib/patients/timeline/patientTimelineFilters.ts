import type {
  PatientTimelineItem,
  PatientTimelineItemType,
  PatientTimelineSortDirection,
  PatientTimelineSourceType,
} from "./patientTimelineTypes";

export type PatientTimelineFilterState = {
  itemTypes: readonly PatientTimelineItemType[] | null;
  sourceTypes: readonly PatientTimelineSourceType[] | null;
};

export function sortPatientTimelineItems(
  items: readonly PatientTimelineItem[],
  direction: PatientTimelineSortDirection
): PatientTimelineItem[] {
  const copy = [...items];
  const mul = direction === "newest_first" ? -1 : 1;
  copy.sort(
    (a, b) => mul * (Date.parse(String(a.occurred_at)) - Date.parse(String(b.occurred_at)))
  );
  return copy;
}

export function filterPatientTimelineItems(
  items: readonly PatientTimelineItem[],
  filters: PatientTimelineFilterState
): PatientTimelineItem[] {
  const types = filters.itemTypes && filters.itemTypes.length ? new Set(filters.itemTypes) : null;
  const sources =
    filters.sourceTypes && filters.sourceTypes.length ? new Set(filters.sourceTypes) : null;
  return items.filter((it) => {
    if (types && !types.has(it.item_type)) return false;
    if (sources && !sources.has(it.source_type)) return false;
    return true;
  });
}

export type PatientTimelinePeriodGroup = "today" | "this_week" | "earlier";

export function patientTimelinePeriodForOccurredAt(
  occurredAtIso: string,
  nowMs: number
): PatientTimelinePeriodGroup {
  const t = Date.parse(String(occurredAtIso));
  if (Number.isNaN(t)) return "earlier";
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  const startMs = startOfToday.getTime();
  if (t >= startMs) return "today";

  const weekAgo = startMs - 7 * 24 * 60 * 60 * 1000;
  if (t >= weekAgo) return "this_week";
  return "earlier";
}

export function groupPatientTimelineByPeriod(
  items: readonly PatientTimelineItem[],
  nowIso?: string
): Record<PatientTimelinePeriodGroup, PatientTimelineItem[]> {
  const nowMs = nowIso ? Date.parse(nowIso) : Date.now();
  const groups: Record<PatientTimelinePeriodGroup, PatientTimelineItem[]> = {
    today: [],
    this_week: [],
    earlier: [],
  };
  for (const it of items) {
    groups[patientTimelinePeriodForOccurredAt(it.occurred_at, nowMs)].push(it);
  }
  return groups;
}
