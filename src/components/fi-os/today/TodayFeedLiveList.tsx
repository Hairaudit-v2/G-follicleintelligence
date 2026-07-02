"use client";

import { cn } from "@/lib/utils";
import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";

import { TodayFeedRow } from "@/src/components/fi-os/today/TodayFeedRow";
import { useTodayFeedLiveItems } from "@/src/components/fi-os/today/useTodayFeedLiveItems";

/** Animated Today list — new rows fade in, resolved rows dissolve (no toasts). */
export function TodayFeedLiveList({ items }: { items: readonly TodayFeedItem[] }) {
  const rows = useTodayFeedLiveItems(items);

  return (
    <ul className="divide-y divide-white/[0.06]">
      {rows.map(({ item, phase }) => (
        <li
          key={item.id}
          className={cn(
            "transition-all duration-300 ease-out",
            phase === "active" && "animate-in fade-in slide-in-from-top-1",
            phase === "exiting" && "pointer-events-none opacity-0"
          )}
        >
          <TodayFeedRow item={item} />
        </li>
      ))}
    </ul>
  );
}
