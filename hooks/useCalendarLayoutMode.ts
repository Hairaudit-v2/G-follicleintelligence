"use client";

import { useEffect, useState } from "react";

import {
  CALENDAR_MEDIA_QUERIES,
  type CalendarLayoutMode,
} from "@/lib/calendar/calendarResponsive";

export type { CalendarLayoutMode };

/**
 * Reactive calendar layout mode driven by CSS breakpoints.
 * - compact: mobile (< 768px)
 * - tablet: md–lg (768px–1023px)
 * - desktop: lg+ (≥ 1024px)
 */
export function useCalendarLayoutMode(): CalendarLayoutMode {
  const [mode, setMode] = useState<CalendarLayoutMode>("desktop");

  useEffect(() => {
    const desktopMq = window.matchMedia(CALENDAR_MEDIA_QUERIES.desktop);
    const tabletMq = window.matchMedia(CALENDAR_MEDIA_QUERIES.tablet);

    const sync = () => {
      if (desktopMq.matches) setMode("desktop");
      else if (tabletMq.matches) setMode("tablet");
      else setMode("compact");
    };

    sync();
    desktopMq.addEventListener("change", sync);
    tabletMq.addEventListener("change", sync);
    return () => {
      desktopMq.removeEventListener("change", sync);
      tabletMq.removeEventListener("change", sync);
    };
  }, []);

  return mode;
}
