import { TodayFeedQueue } from "@/src/components/fi-os/today/TodayFeedQueue";
import { TodayFeedSection } from "@/src/components/fi-os/today/TodayFeedSection";
import { RIGHT_NOW_VISIBLE_CAP, type TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";

export function RightNowSection({ items }: { items: readonly TodayFeedItem[] }) {
  return (
    <TodayFeedSection
      id="today-right-now-heading"
      kicker="Right now"
      title="Needs you now"
      items={items}
      emptyText="Nothing needs you right now."
    >
      <TodayFeedQueue
        items={items}
        visibleCap={RIGHT_NOW_VISIBLE_CAP}
        emptyText="Nothing needs you right now."
      />
    </TodayFeedSection>
  );
}
