"use client";

import { useEffect, useRef, useState } from "react";

import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";

export type TodayFeedLiveRow = {
  item: TodayFeedItem;
  phase: "active" | "exiting";
};

const EXIT_MS = 420;

/**
 * Keeps resolved rows visible briefly for dissolve animation (Phase 7).
 */
export function useTodayFeedLiveItems(items: readonly TodayFeedItem[]): TodayFeedLiveRow[] {
  const prevItemsRef = useRef<Map<string, TodayFeedItem>>(new Map());
  const [exiting, setExiting] = useState<TodayFeedItem[]>([]);

  useEffect(() => {
    const nextMap = new Map(items.map((i) => [i.id, i] as const));
    const removed: TodayFeedItem[] = [];
    for (const [id, item] of prevItemsRef.current) {
      if (!nextMap.has(id)) removed.push(item);
    }

    if (removed.length) {
      setExiting((prev) => {
        const byId = new Map(prev.map((i) => [i.id, i] as const));
        for (const item of removed) byId.set(item.id, item);
        return Array.from(byId.values());
      });
      const timer = window.setTimeout(() => {
        setExiting((prev) => prev.filter((i) => nextMap.has(i.id)));
      }, EXIT_MS);
      prevItemsRef.current = nextMap;
      return () => window.clearTimeout(timer);
    }

    prevItemsRef.current = nextMap;
  }, [items]);

  const rows: TodayFeedLiveRow[] = items.map((item) => ({ item, phase: "active" }));
  for (const item of exiting) {
    if (items.some((i) => i.id === item.id)) continue;
    rows.push({ item, phase: "exiting" });
  }
  return rows;
}
