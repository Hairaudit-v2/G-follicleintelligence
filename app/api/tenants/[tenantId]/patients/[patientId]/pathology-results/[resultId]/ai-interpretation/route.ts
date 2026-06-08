import { z } from "zod";
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import { crmJsonError, crmJsonOk, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import {
  archivePathologyAiInterpretation,
  generatePathologyAiInterpretation,
  markPathologyAiInterpretationReviewed,
  updatePathologyAiInterpretationSummaries,
} from "@/src/lib/pathology/pathologyAiInterpretationMutations.server";

export const dynamic = "force-dynamic";

const patchBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update_summaries"),
    interpretation_id: z.string().uuid().nullable().optional(),
    doctor_summary: z.string().max(8000).nullable().optional(),
    patient_friendly_summary: z.string().max(8000).nullable().optional(),
  }),
  z.object({
    action: z.literal("mark_reviewed"),
    interpretation_id: z.string().uuid().nullable().optional(),
  }),
  z.object({
    action: z.literal("archive"),
    interpretation_id: z.string().uuid().nullable().optional(),
  }),
]);

function mapAiRouteError(e: unknown) {
  if (e instanceof Error && (e.message.includes("OpenAI") || e.message.includes("schema validation"))) {
    return crmJsonError(502, e.message);
  }
  return mapCrmRouteError(e);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; patientId: string; resultId: string }> }
) {
  try {
    const { tenantId, patientId, resultId } = await params;
    if (!tenantId?.trim() || !patientId?.trim() || !resultId?.trim()) {
      return crmJsonError(400, "Missing tenantId, patientId, or resultId.");
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return crmJsonError(500, "Server misconfigured.");
    }

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), req);

    const interpretation = await generatePathologyAiInterpretation(tenantId.trim(), patientId.trim(), resultId.trim(), actingUserId);
    return crmJsonOk({ interpretation });
  } catch (e) {
    return mapAiRouteError(e);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; patientId: string; resultId: string }> }
) {
  try {
    const { tenantId, patientId, resultId } = await params;
    if (!tenantId?.trim() || !patientId?.trim() || !resultId?.trim()) {
      return crmJsonError(400, "Missing tenantId, patientId, or resultId.");
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return crmJsonError(500, "Server misconfigured.");
    }

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return crmJsonError(400, parsed.error.issues.map((i) => i.message).join(" ") || "Invalid body.");
    }

    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), req);
    if (parsed.data.action === "update_summaries") {
      const interpretation = await updatePathologyAiInterpretationSummaries(tenantId.trim(), patientId.trim(), resultId.trim(), {
        interpretationId: parsed.data.interpretation_id ?? null,
        doctorSummary: parsed.data.doctor_summary ?? null,
        patientFriendlySummary: parsed.data.patient_friendly_summary ?? null,
      });
      return crmJsonOk({ interpretation });
    }

    if (parsed.data.action === "mark_reviewed") {
      const interpretation = await markPathologyAiInterpretationReviewed(
        tenantId.trim(),
        patientId.trim(),
        resultId.trim(),
        parsed.data.interpretation_id ?? null,
        actingUserId
      );
      return crmJsonOk({ interpretation });
    }

    const interpretation = await archivePathologyAiInterpretation(
      tenantId.trim(),
      patientId.trim(),
      resultId.trim(),
      parsed.data.interpretation_id ?? null
    );
    return crmJsonOk({ interpretation });
  } catch (e) {
    return mapAiRouteError(e);
  }
}
