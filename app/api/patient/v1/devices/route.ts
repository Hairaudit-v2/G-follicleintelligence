/**
 * GET  /api/patient/v1/devices
 * POST /api/patient/v1/devices
 * FI-PATIENT-APP-2G — patient push device registration.
 *
 * Identity is always derived via requirePatientGatewayContext.
 * Clients must never supply authoritative patientId / tenantId.
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import {
  listPatientNotificationDevices,
  registerPatientNotificationDevice,
} from "@/src/lib/patientPortal/patientGatewayDevices.server";
import {
  mapPatientGatewayRouteError,
  patientGatewayJsonDeny,
  patientGatewayJsonOk,
} from "@/src/lib/patientPortal/patientGatewayHttp";
import { writePatientGatewayAudit } from "@/src/lib/patientPortal/patientGatewayAudit.server";

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
        action: "patient_device_list",
        outcome: "deny",
        code: gate.code,
        resourceKind: "notification",
      });
      return patientGatewayJsonDeny(gate);
    }

    const result = await listPatientNotificationDevices(gate.context);
    if (!result.ok) return patientGatewayJsonDeny(result);
    return patientGatewayJsonOk({ ok: true, devices: result.devices });
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}

export async function POST(req: Request) {
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
        action: "patient_device_registered",
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

    // Reject client-supplied identity claims (defense in depth — gate already owns identity).
    if (
      body.patientId != null ||
      body.patient_id != null ||
      body.tenantId != null ||
      body.tenant_id != null
    ) {
      return patientGatewayJsonDeny({
        ok: false,
        code: "ownership_denied",
        status: 403,
        message: "Client identity claims are not accepted.",
      });
    }

    const result = await registerPatientNotificationDevice(gate.context, {
      platform: typeof body.platform === "string" ? body.platform : "",
      provider: typeof body.provider === "string" ? body.provider : "",
      token: typeof body.token === "string" ? body.token : "",
      appVersion:
        typeof body.appVersion === "string"
          ? body.appVersion
          : typeof body.app_version === "string"
            ? body.app_version
            : null,
      deviceLabel:
        typeof body.deviceLabel === "string"
          ? body.deviceLabel
          : typeof body.device_label === "string"
            ? body.device_label
            : null,
      environment: typeof body.environment === "string" ? body.environment : null,
    });
    if (!result.ok) return patientGatewayJsonDeny(result);
    return patientGatewayJsonOk(
      { ok: true, device: result.device, refreshed: result.refreshed },
      result.refreshed ? 200 : 201
    );
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
