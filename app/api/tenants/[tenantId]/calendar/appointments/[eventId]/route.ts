/**
 * PATCH /api/tenants/[tenantId]/calendar/appointments/[eventId]
 * Quick Edit / drag write-back for google_linked_fios CalendarOS events.
 */
import { handlePatchCalendarOsAppointment } from "@/src/lib/calendar/calendarOsWritebackRoutes.server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ tenantId: string; eventId: string }> }
): Promise<Response> {
  const { tenantId, eventId } = await ctx.params;
  return handlePatchCalendarOsAppointment(tenantId.trim(), eventId.trim(), req);
}
