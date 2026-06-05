"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

import type { CalendarViewportRange } from "@/lib/calendar/virtualizeAppointments";

const DEFAULT_RANGE: CalendarViewportRange = { scrollTop: 0, viewportHeight: 800 };

export function useScrollViewport(ref: RefObject<HTMLElement | null>): CalendarViewportRange {
  const [range, setRange] = useState<CalendarViewportRange>(DEFAULT_RANGE);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setRange({
      scrollTop: el.scrollTop,
      viewportHeight: el.clientHeight,
    });
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    measure();

    const onScroll = () => measure();
    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [measure, ref]);

  return range;
}
