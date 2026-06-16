import { startTransition } from "react";

import { measureCalendarSync } from "@/lib/calendar/calendarInteractionPerfDev";

type CalendarRouter = {
  push: (href: string) => void;
  replace: (href: string) => void;
};

/**
 * Schedule App Router navigation as a React transition so toolbar clicks return to the
 * browser quickly while RSC payload work proceeds.
 */
export function pushCalendarHref(router: CalendarRouter, href: string): void {
  startTransition(() => {
    measureCalendarSync("calendar.router.push", () => {
      router.push(href);
    });
  });
}

export function replaceCalendarHref(router: CalendarRouter, href: string): void {
  startTransition(() => {
    measureCalendarSync("calendar.router.replace", () => {
      router.replace(href);
    });
  });
}
