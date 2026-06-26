import "server-only";

import { NextResponse } from "next/server";

import {
  createFiCalendarAppointment,
  type FiAppointmentServerOpts,
} from "./googleCalendarAppointment.server";
import type { FiAppointmentInput } from "./googleCalendarTypes";
import {
  assertGoogleCalendarTenantAdminAccess,
  GoogleCalendarIntegrationAccessError,
  type GoogleCalendarIntegrationAccessOpts,
} from "./googleCalendarIntegrationAccess.server";

type RouteOpts = GoogleCalendarIntegrationAccessOpts & FiAppointmentServerOpts;

function parseAppointmentBody(
  tenantId: string,
  body: unknown
): FiAppointmentInput | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Request body must be a JSON object." };
  }

  const raw = body as Record<string, unknown>;

  return {
    tenantId,
    title: String(raw.title ?? ""),
    description: raw.description != null ? String(raw.description) : null,
    location: raw.location != null ? String(raw.location) : null,
    startTime: String(raw.startTime ?? ""),
    endTime: String(raw.endTime ?? ""),
    eventType: raw.eventType != null ? String(raw.eventType) : null,
    patientId: raw.patientId != null ? String(raw.patientId) : null,
    leadId: raw.leadId != null ? String(raw.leadId) : null,
    addGoogleMeet: Boolean(raw.addGoogleMeet),
    attendees: Array.isArray(raw.attendees) ? raw.attendees.map(String) : undefined,
    metadata:
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : undefined,
  };
}

/** POST /api/tenants/[tenantId]/calendar/appointments — create FI-native appointment mirrored to Google. */
export async function handleCreateCalendarAppointment(
  tenantId: string,
  request: Request,
  opts: RouteOpts = {}
): Promise<NextResponse> {
  try {
    const access = await assertGoogleCalendarTenantAdminAccess(tenantId, { ...opts, request });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = parseAppointmentBody(tenantId.trim(), body);
    if ("error" in parsed) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }

    const result = await createFiCalendarAppointment(parsed, {
      ...opts,
      actorAuthUserId: access.actorAuthUserId,
    });

    if (!result.ok) {
      const status = result.error.includes("not connected") || result.error.includes("expired")
        ? 503
        : result.error.includes("required") ||
            result.error.includes("Invalid") ||
            result.error.includes("after start")
          ? 400
          : 502;
      return NextResponse.json({ success: false, error: result.error }, { status });
    }

    return NextResponse.json({
      success: true,
      appointment: result.data!.appointment,
    });
  } catch (e) {
    if (e instanceof GoogleCalendarIntegrationAccessError) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Unexpected error.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
