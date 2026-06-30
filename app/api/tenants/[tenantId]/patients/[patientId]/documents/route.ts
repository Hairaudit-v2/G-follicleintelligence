/**
 * GET  — list patient documents (optional ?document_type=consent)
 * POST — multipart upload of consent PDF/image (document_type=consent)
 */
import { revalidatePath } from "next/cache";

import {
  assertCrmTenantReadAllowed,
  assertCrmTenantWriteAllowed,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import {
  crmJsonError,
  crmJsonOk,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { patientDocumentListQuerySchema } from "@/src/lib/patients/patientDocumentApiSchemas";
import {
  listPatientDocuments,
  uploadPatientConsentDocument,
} from "@/src/lib/patients/patientDocumentsServer";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; patientId: string }> }
) {
  try {
    const { tenantId, patientId } = await params;
    const tid = tenantId?.trim() ?? "";
    const pid = patientId?.trim() ?? "";
    if (!tid || !pid) return crmJsonError(400, "Missing tenantId or patientId.");

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId: tid, adminKey, request: req });

    const url = new URL(req.url);
    const parsed = patientDocumentListQuerySchema.safeParse({
      document_type: url.searchParams.get("document_type") ?? undefined,
    });
    if (!parsed.success) {
      return crmJsonError(400, parsed.error.errors[0]?.message ?? "Invalid query.");
    }

    const rows = await listPatientDocuments(tid, pid, {
      documentType: parsed.data.document_type,
    });

    return crmJsonOk({ documents: rows });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; patientId: string }> }
) {
  try {
    const { tenantId, patientId } = await params;
    const tid = tenantId?.trim() ?? "";
    const pid = patientId?.trim() ?? "";
    if (!tid || !pid) return crmJsonError(400, "Missing tenantId or patientId.");

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return crmJsonError(500, "Server misconfigured.");
    }

    const form = await req.formData();
    const adminKey = extractAdminKeyFromRequest(req, { adminKey: form.get("adminKey") });
    await assertCrmTenantWriteAllowed({ tenantId: tid, adminKey, request: req });

    const file = form.get("file");
    if (!(file instanceof File) || !file.size) {
      return crmJsonError(400, "Missing or empty file.");
    }

    const notesRaw = form.get("notes");
    const notes = notesRaw != null ? String(notesRaw) : null;
    const actingUserId = await tryResolveFiUserIdForTenant(tid, req);

    const row = await uploadPatientConsentDocument({
      tenantId: tid,
      patientId: pid,
      file,
      notes,
      actingUserId,
    });

    revalidatePath(`/fi-admin/${tid}/patients/${pid}`);

    return crmJsonOk({ document: row });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}