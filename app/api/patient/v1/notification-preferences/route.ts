/**
 * GET   /api/patient/v1/notification-preferences
 * PATCH /api/patient/v1/notification-preferences
 * FI-PATIENT-APP-1F — patient notification preferences (optional channels).
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import { writePatientGatewayAudit } from "@/src/lib/patientPortal/patientGatewayAudit.server";
import {
  loadPatientGatewayNotificationPreferences,
  updatePatientGatewayNotificationPreferences,
} from "@/src/lib/patientPortal/patientGatewayNotificationPreferences.server";
import {
  mapPatientGatewayRouteError,
  patientGatewayJsonDeny,
  patientGatewayJsonOk,
} from "@/src/lib/patientPortal/patientGatewayHttp";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return patientGatewayJsonDeny({
        ok: false,
        code: "misconfigured",
        status: 500,
        message: "Server misconfigured.",
      });
    }

    const gate = await requirePatientGatewayContext(req);
    if (!gate.ok) {
      writePatientGatewayAudit({
        action: "notification_preferences_read",
        outcome: "deny",
        code: gate.code,
        resourceKind: "notification",
      });
      return patientGatewayJsonDeny(gate);
    }

    const result = await loadPatientGatewayNotificationPreferences(gate.context);
    if (!result.ok) return patientGatewayJsonDeny(result);
    return patientGatewayJsonOk({ ok: true, preferences: result.preferences });
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return patientGatewayJsonDeny({
        ok: false,
        code: "misconfigured",
        status: 500,
        message: "Server misconfigured.",
      });
    }

    const gate = await requirePatientGatewayContext(req);
    if (!gate.ok) {
      writePatientGatewayAudit({
        action: "notification_preferences_updated",
        outcome: "deny",
        code: gate.code,
        resourceKind: "notification",
      });
      return patientGatewayJsonDeny(gate);
    }

    let body: Record<string, unknown> = {};
    try {
      const parsed = await req.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      body = {};
    }

    const result = await updatePatientGatewayNotificationPreferences(gate.context, body);
    if (!result.ok) return patientGatewayJsonDeny(result);
    return patientGatewayJsonOk({ ok: true, preferences: result.preferences });
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
