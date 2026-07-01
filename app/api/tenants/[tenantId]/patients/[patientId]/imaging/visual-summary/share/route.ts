/**
 * POST …/imaging/visual-summary/share — generate share URL and optionally email patient.
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { resolveFiOsPublicOrigin } from "@/src/lib/fiOs/fiOsPublicOrigin.server";
import { z } from "zod";
import {
  generatePatientVisualSummaryShareLink,
  sendPatientVisualSummaryShareEmail,
} from "@/src/lib/imaging-os/patientVisualSummaryShare.server";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    case_id: z.string().uuid(),
    report_type: z.enum(["surgery_post_op_summary", "hairaudit_visual_summary"]),
    send_email: z.boolean().optional(),
    personal_note: z.string().max(2000).nullable().optional(),
  })
  .strict();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; patientId: string }> }
) {
  try {
    const { tenantId, patientId } = await params;
    if (!tenantId?.trim() || !patientId?.trim()) {
      return crmJsonError(400, "Missing route parameters.");
    }

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = bodySchema.parse(body);
    const origin = await resolveFiOsPublicOrigin();

    if (parsed.send_email) {
      const emailed = await sendPatientVisualSummaryShareEmail({
        tenantId,
        patientId,
        caseId: parsed.case_id,
        reportType: parsed.report_type,
        origin,
        personalNote: parsed.personal_note,
      });
      return crmJsonOk({
        share_url: emailed.shareUrl,
        emailed_to: emailed.to,
        resend_id: emailed.resendId,
      });
    }

    const link = await generatePatientVisualSummaryShareLink({
      tenantId,
      patientId,
      caseId: parsed.case_id,
      reportType: parsed.report_type,
      origin,
    });
    return crmJsonOk({
      share_url: link.shareUrl,
      expires_at: link.expiresAt,
    });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}