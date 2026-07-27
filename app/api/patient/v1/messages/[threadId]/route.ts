/**
 * GET  /api/patient/v1/messages/{threadId}
 * POST /api/patient/v1/messages/{threadId}
 * FI-PATIENT-APP-1F — thread detail + send into owned/approved thread.
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import { writePatientGatewayAudit } from "@/src/lib/patientPortal/patientGatewayAudit.server";
import {
  getPatientGatewayMessageThread,
  sendPatientGatewayMessage,
} from "@/src/lib/patientPortal/patientGatewayMessaging.server";
import {
  mapPatientGatewayRouteError,
  patientGatewayJsonDeny,
  patientGatewayJsonOk,
} from "@/src/lib/patientPortal/patientGatewayHttp";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ threadId: string }> }
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
        action: "message_thread_read_denied",
        outcome: "deny",
        code: gate.code,
        resourceKind: "message",
      });
      return patientGatewayJsonDeny(gate);
    }

    const { threadId } = await ctx.params;
    const result = await getPatientGatewayMessageThread(gate.context, threadId);
    if (!result.ok) return patientGatewayJsonDeny(result);
    return patientGatewayJsonOk(result);
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ threadId: string }> }
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
        action: "patient_message_send_denied",
        outcome: "deny",
        code: gate.code,
        resourceKind: "message",
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

    const { threadId } = await ctx.params;
    const result = await sendPatientGatewayMessage(gate.context, threadId, body);
    if (!result.ok) return patientGatewayJsonDeny(result);
    return patientGatewayJsonOk(result, 201);
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
