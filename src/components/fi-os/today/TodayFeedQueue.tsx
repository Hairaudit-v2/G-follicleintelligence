"use client";

import { useState } from "react";

import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";

import { TodayFeedRow } from "@/src/components/fi-os/today/TodayFeedRow";

/** P0C — Right now queue: show top priority items, collapse the rest. */
export function TodayFeedQueue(props: {
  items: readonly TodayFeedItem[];
  visibleCap: number;
  emptyText: string;
}) {
  const { items, visibleCap, emptyText } = props;
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) {
    return (
      <p className="py-6 text-sm text-slate-500">{emptyText}</p>
    );
  }

  const visible = expanded ? items : items.slice(0, visibleCap);
  const hiddenCount = Math.max(0, items.length - visibleCap);

  return (
    <div>
      <ul className="divide-y divide-white/[0.06]">
        {visible.map((item) => (
          <TodayFeedRow key={item.id} item={item} />
        ))}
      </ul>
      {!expanded && hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 w-full rounded-lg py-2 text-left text-sm font-medium text-cyan-400/90 transition hover:text-cyan-300"
        >
          + {hiddenCount} more
        </button>
      ) : null}
      {expanded && items.length > visibleCap ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-3 w-full rounded-lg py-2 text-left text-sm font-medium text-slate-500 transition hover:text-slate-400"
        >
          Show less
        </button>
      ) : null}
    </div>
  );
}
