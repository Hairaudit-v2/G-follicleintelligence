/**
 * POST /api/tenants/[tenantId]/calendar/appointments/[eventId]/convert
 */
import { handleConvertExternalCalendarEvent } from "@/src/lib/calendar/calendarOsWritebackRoutes.server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ tenantId: string; eventId: string }> }
): Promise<Response> {
  const { tenantId, eventId } = await ctx.params;
  return handleConvertExternalCalendarEvent(tenantId.trim(), eventId.trim(), req);
}
