/**
 * GET /api/google-calendar/oauth/callback
 * Google Calendar OAuth callback — validates state, stores encrypted tokens, redirects to FI Admin.
 */
import { handleGoogleCalendarOAuthCallback } from "@/src/lib/googleCalendar/googleCalendarIntegrationRoutes.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return handleGoogleCalendarOAuthCallback(req);
}
