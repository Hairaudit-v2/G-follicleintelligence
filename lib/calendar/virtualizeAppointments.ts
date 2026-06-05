import type { ProviderColumnOverlapLayout } from "@/components/calendar/ProviderColumn";

/** Only virtualize DOM when a column exceeds this count. */
export const CALENDAR_VIRTUALIZE_THRESHOLD = 20;

/** Extra pixels rendered above/below the viewport to avoid pop-in while scrolling. */
export const CALENDAR_VIRTUAL_OVERSCAN_PX = 160;

export type CalendarViewportRange = {
  scrollTop: number;
  viewportHeight: number;
};

export function shouldVirtualizeAppointments(count: number): boolean {
  return count >= CALENDAR_VIRTUALIZE_THRESHOLD;
}

/** True when an absolutely-positioned card intersects the scroll viewport (with overscan). */
export function layoutIntersectsViewport(
  layout: Pick<ProviderColumnOverlapLayout, "topPx" | "heightPx">,
  range: CalendarViewportRange,
  overscanPx = CALENDAR_VIRTUAL_OVERSCAN_PX
): boolean {
  const { scrollTop, viewportHeight } = range;
  const top = scrollTop - overscanPx;
  const bottom = scrollTop + viewportHeight + overscanPx;
  const cardTop = layout.topPx;
  const cardBottom = layout.topPx + layout.heightPx;
  return cardBottom >= top && cardTop <= bottom;
}

export function filterVisibleAppointmentIds(
  layouts: Map<string, ProviderColumnOverlapLayout>,
  range: CalendarViewportRange,
  alwaysIncludeIds?: Iterable<string>
): Set<string> {
  const forced = new Set(alwaysIncludeIds ?? []);
  const visible = new Set<string>();

  layouts.forEach((layout, id) => {
    if (forced.has(id) || layoutIntersectsViewport(layout, range)) {
      visible.add(id);
    }
  });

  forced.forEach((id) => {
    if (layouts.has(id)) visible.add(id);
  });

  return visible;
}
