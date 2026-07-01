/**
 * POST /api/patient/[tenantId]/images
 * Patient-portal multipart upload — capture_source=patient_portal, unified ingest pipeline.
 */
import { mapCrmRouteError, crmJsonError, crmJsonOk } from "@/src/lib/crm/crmHttp";
import { uploadPatientPortalImage } from "@/src/lib/patientPortal/patientPortalImageUpload.server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    const tid = tenantId?.trim() ?? "";
    if (!tid) return crmJsonError(400, "Missing tenantId.");

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return crmJsonError(500, "Server misconfigured.");
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) {
      return crmJsonError(400, "Missing or empty file.");
    }

    const protocolSlotSlug = form.get("imaging_protocol_slot_slug");
    const followUpInterval = form.get("follow_up_interval");
    const result = await uploadPatientPortalImage({
      tenantId: tid,
      file,
      protocolSlotSlug:
        protocolSlotSlug == null || protocolSlotSlug instanceof File
          ? null
          : String(protocolSlotSlug),
      followUpInterval:
        followUpInterval == null || followUpInterval instanceof File
          ? null
          : String(followUpInterval),
      caption: form.get("caption") == null ? null : String(form.get("caption")),
    });

    return crmJsonOk({
      image: result.image,
      changed_keys: result.changed_keys,
    });
  } catch (e) {
    if (e instanceof Error) {
      const msg = e.message;
      if (
        msg.includes("Sign in with a patient-linked portal account") ||
        msg.includes("consent")
      ) {
        return crmJsonError(403, msg);
      }
    }
    return mapCrmRouteError(e);
  }
}