/**
 * POST /api/tenants/[tenantId]/calendar/appointments/[eventId]/create-patient-from-google
 * FI-CALENDAR-PATIENT-LINK-1A — idempotent create + link from Google hydration.
 */
import { handleCreatePatientFromGoogleHydration } from "@/src/lib/calendar/calendarOsWritebackRoutes.server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ tenantId: string; eventId: string }> }
): Promise<Response> {
  const { tenantId, eventId } = await ctx.params;
  return handleCreatePatientFromGoogleHydration(tenantId.trim(), eventId.trim(), req);
}
