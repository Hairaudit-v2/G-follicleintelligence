/**
 * DELETE /api/patient/v1/devices/{deviceId}
 * FI-PATIENT-APP-2G — disable current device registration (logout / revoke).
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import { disablePatientNotificationDevice } from "@/src/lib/patientPortal/patientGatewayDevices.server";
import {
  mapPatientGatewayRouteError,
  patientGatewayJsonDeny,
  patientGatewayJsonOk,
} from "@/src/lib/patientPortal/patientGatewayHttp";
import { writePatientGatewayAudit } from "@/src/lib/patientPortal/patientGatewayAudit.server";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ deviceId: string }> }
) {
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
        action: "patient_device_disabled",
        outcome: "deny",
        code: gate.code,
        resourceKind: "notification",
      });
      return patientGatewayJsonDeny(gate);
    }

    const { deviceId } = await ctx.params;
    const result = await disablePatientNotificationDevice(gate.context, deviceId ?? "");
    if (!result.ok) return patientGatewayJsonDeny(result);
    return patientGatewayJsonOk({ ok: true, deviceId: result.deviceId });
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
