"use client";

import { CalendarPage } from "@/components/calendar/CalendarPage";
import type { OperationalCalendarPageData } from "@/src/lib/calendar/operationalCalendarTypes";

/** FI Admin tenant calendar — delegates to the shared {@link CalendarPage} shell. */
export function OperationalCalendarPage({ data }: { data: OperationalCalendarPageData }) {
  return <CalendarPage data={data} route="fi-admin" />;
}
