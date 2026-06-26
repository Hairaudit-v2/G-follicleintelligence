/**
 * POST /api/tenants/[tenantId]/calendar/appointments
 * Create native FI OS calendar appointment mirrored to Google Calendar (optional Google Meet).
 */
import { handleCreateCalendarAppointment } from "@/src/lib/googleCalendar/googleCalendarAppointmentRoutes.server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ tenantId: string }> }
): Promise<Response> {
  const { tenantId } = await ctx.params;
  return handleCreateCalendarAppointment(tenantId.trim(), req);
}
