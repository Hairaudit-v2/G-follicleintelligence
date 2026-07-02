import { TodayFeedItemList } from "@/src/components/fi-os/today/TodayFeedItemList";
import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";

export function UpNextSection({ items }: { items: readonly TodayFeedItem[] }) {
  return (
    <TodayFeedItemList
      id="today-up-next-heading"
      kicker="Up next"
      title="Queued for today"
      description="Due later today — not urgent yet, but on the clock."
      items={items}
      emptyText="Nothing queued for later today."
    />
  );
}
