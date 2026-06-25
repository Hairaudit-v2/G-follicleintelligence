/**
 * POST /api/tenants/[tenantId]/integrations/google-calendar/validate
 * Probe Google Calendar API connection and return sanitized status.
 */
import { handleGoogleCalendarValidate } from "@/src/lib/googleCalendar/googleCalendarIntegrationRoutes.server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ tenantId: string }> }
): Promise<Response> {
  const { tenantId } = await ctx.params;
  return handleGoogleCalendarValidate(tenantId.trim(), { request: req });
}
