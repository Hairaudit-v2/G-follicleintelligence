/**
 * POST /api/google/calendar/webhook
 * CalendarOS GC-9: Google Calendar push notification receiver.
 * Validates channel/resource ids against stored subscriptions — never trusts body payload.
 */
import { NextRequest, NextResponse } from "next/server";

import { handleGoogleCalendarWebhookNotification } from "@/src/lib/googleCalendar/googleCalendarWebhookSubscriptions.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const channelId = req.headers.get("X-Goog-Channel-ID")?.trim() ?? "";
  const resourceId = req.headers.get("X-Goog-Resource-ID")?.trim() ?? "";
  const resourceState = req.headers.get("X-Goog-Resource-State")?.trim() ?? "";
  const messageNumber = req.headers.get("X-Goog-Message-Number")?.trim() ?? undefined;

  const result = await handleGoogleCalendarWebhookNotification({
    channelId,
    resourceId,
    resourceState,
    messageNumber,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, outcome: result.outcome, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({ success: true, outcome: result.outcome }, { status: result.status });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "google-calendar-webhook" });
}
