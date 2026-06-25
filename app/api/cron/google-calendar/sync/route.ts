/**
 * GET /api/cron/google-calendar/sync
 * CalendarOS GC-3: scheduled Google Calendar sync for active integrations.
 * Authorisation: Bearer `CRON_SECRET` or `FI_GOOGLE_CALENDAR_CRON_SECRET`, or header `x-fi-google-calendar-secret`.
 */
import { NextRequest } from "next/server";

import { handleGoogleCalendarSyncCronGet } from "@/src/lib/googleCalendar/googleCalendarSync.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return handleGoogleCalendarSyncCronGet(req);
}
