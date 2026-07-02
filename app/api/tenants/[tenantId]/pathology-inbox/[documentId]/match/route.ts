/**
 * PATCH /api/tenants/[tenantId]/pathology-inbox/[documentId]/match
 * Body JSON: { action: "confirm"|"reject"|"suggest", patient_id?, extracted_patient_name?, extracted_dob?, extracted_mrn?, reason? }
 */
import { z } from "zod";
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import {
  crmJsonError,
  crmJsonOk,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import {
  confirmInboundDocumentMatch,
  refreshInboundDocumentMatchSuggestion,
  rejectInboundDocumentMatch,
} from "@/src/lib/pathology/pathologyInboxMutations.server";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("confirm"),
    patient_id: z.string().trim().min(1, "patient_id is required."),
  }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().trim().optional().nullable(),
  }),
  z.object({
    action: z.literal("suggest"),
    extracted_patient_name: z.string().trim().optional().nullable(),
    extracted_dob: z.string().trim().optional().nullable(),
    extracted_mrn: z.string().trim().optional().nullable(),
  }),
]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; documentId: string }> }
) {
  try {
    const { tenantId, documentId } = await params;
    if (!tenantId?.trim() || !documentId?.trim()) {
      return crmJsonError(400, "Missing tenantId or documentId.");
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return crmJsonError(500, "Server misconfigured.");
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return crmJsonError(400, "Invalid JSON body.");
    }

    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return crmJsonError(
        400,
        parsed.error.issues.map((i) => i.message).join(" ") || "Invalid body."
      );
    }

    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), req);
    const tid = tenantId.trim();
    const did = documentId.trim();

    if (parsed.data.action === "confirm") {
      const document = await confirmInboundDocumentMatch({
        tenantId: tid,
        documentId: did,
        patientId: parsed.data.patient_id.trim(),
        actingUserId,
      });
      return crmJsonOk({ document });
    }

    if (parsed.data.action === "reject") {
      const document = await rejectInboundDocumentMatch({
        tenantId: tid,
        documentId: did,
        actingUserId,
        reason: parsed.data.reason ?? null,
      });
      return crmJsonOk({ document });
    }

    const document = await refreshInboundDocumentMatchSuggestion({
      tenantId: tid,
      documentId: did,
      extractedPatientName: parsed.data.extracted_patient_name ?? null,
      extractedDob: parsed.data.extracted_dob ?? null,
      extractedMrn: parsed.data.extracted_mrn ?? null,
      actingUserId,
    });
    return crmJsonOk({ document });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
