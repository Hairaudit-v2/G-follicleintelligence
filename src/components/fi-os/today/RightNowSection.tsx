import { TodayFeedItemList } from "@/src/components/fi-os/today/TodayFeedItemList";
import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";

export function RightNowSection({ items }: { items: readonly TodayFeedItem[] }) {
  return (
    <TodayFeedItemList
      id="today-right-now-heading"
      kicker="Right now"
      title="Needs you now"
      description="Blocking, overdue, or in-progress — handle these first."
      items={items}
      emptyText="Nothing needs you right now."
    />
  );
}
