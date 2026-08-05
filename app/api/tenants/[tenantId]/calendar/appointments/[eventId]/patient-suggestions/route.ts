/**
 * GET /api/tenants/[tenantId]/calendar/appointments/[eventId]/patient-suggestions
 */
import { handleCalendarOsPatientSuggestions } from "@/src/lib/calendar/calendarOsWritebackRoutes.server";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ tenantId: string; eventId: string }> }
): Promise<Response> {
  const { tenantId, eventId } = await ctx.params;
  return handleCalendarOsPatientSuggestions(tenantId.trim(), eventId.trim(), req);
}
