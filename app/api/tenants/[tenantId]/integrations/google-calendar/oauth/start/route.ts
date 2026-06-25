/**
 * GET /api/tenants/[tenantId]/integrations/google-calendar/oauth/start
 * Begin Google Calendar OAuth — redirects to Google authorize URL.
 */
import { handleGoogleCalendarOAuthStart } from "@/src/lib/googleCalendar/googleCalendarIntegrationRoutes.server";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ tenantId: string }> }
): Promise<Response> {
  const { tenantId } = await ctx.params;
  return handleGoogleCalendarOAuthStart(tenantId.trim(), { request: req });
}
