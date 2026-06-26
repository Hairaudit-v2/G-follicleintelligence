/**
 * GET /api/cron/platform-events/process
 * GC-10B: process pending FI Platform Event Bus deliveries.
 * Authorisation: Bearer `CRON_SECRET` or `FI_PLATFORM_EVENTS_CRON_SECRET`, or header `x-fi-platform-events-secret`.
 */
import { NextRequest } from "next/server";

import { handlePlatformEventsProcessCronGet } from "@/src/lib/events/fiPlatformEventsCron.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return handlePlatformEventsProcessCronGet(req);
}
