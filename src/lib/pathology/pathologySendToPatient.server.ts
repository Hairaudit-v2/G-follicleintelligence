import "server-only";

import { appendCrmActivityEvent } from "@/src/lib/crm/activity";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildPathologyPdfInputFromDetail,
  buildPathologyPdfStoragePath,
  loadPathologyRequestDetail,
  PATHOLOGY_PATIENT_PDF_BUCKET,
} from "@/src/lib/pathology/pathologyRequestLoad.server";
import {
  markPathologyRequestEmailedToPatient,
  persistPathologyRequestPdfStorage,
} from "@/src/lib/pathology/pathologyRequestMutations.server";
import { renderPathologyBloodRequestPdfBytes } from "@/src/lib/pathology/pathologyPdfRender.server";
import { sendResendEmailHttp } from "@/src/lib/email/resendHttpSend.server";
import { buildResendFromAddress, isEmailDeliveryConfigured } from "@/src/lib/reminders/reminderDeliveryConfig";
import { loadReminderDeliveryConfig } from "@/src/lib/reminders/reminderDeliveryConfig.server";

/**
 * Sends the pathology request PDF to the patient's email (Resend) and records audit metadata.
 * Caller must enforce `assertCrmTenantWriteAllowed` before invoking.
 */
export async function sendPathologyRequestToPatientEmail(params: {
  tenantId: string;
  patientId: string;
  requestId: string;
  personalNote?: string | null;
}): Promise<{ resendId: string | null; to: string }> {
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();
  const rid = params.requestId.trim();

  const bundle = await loadPathologyRequestDetail(tid, pid, rid);
  if (!bundle) throw new Error("Pathology request not found.");
  if (bundle.request.status === "cancelled") throw new Error("Cannot email a cancelled request.");

  const to = bundle.patientEmail?.trim();
  if (!to) throw new Error("Patient has no email on file for this person record.");

  const cfg = loadReminderDeliveryConfig();
  if (!isEmailDeliveryConfigured(cfg)) throw new Error("Email delivery is not configured (set RESEND_API_KEY and RESEND_FROM_EMAIL).");

  const pdfInput = buildPathologyPdfInputFromDetail(bundle);
  const pdfBytes = await renderPathologyBloodRequestPdfBytes(pdfInput);
  const storagePath = buildPathologyPdfStoragePath(tid, pid, rid);

  const supabase = supabaseAdmin();

  const clinic = bundle.branding.clinicName;
  const firstName = bundle.patientName.split(/\s+/)[0] ?? bundle.patientName;
  const note = params.personalNote?.trim();
  const bodyLines = [
    `Hi ${firstName},`,
    "",
    `Your clinician at ${clinic} has prepared a pathology (blood test) request form for you.`,
    "Please find it attached as a PDF. Take this form to your chosen laboratory or phlebotomy service unless your clinic arranges collection for you.",
    "",
    note ? `Message from your clinician: ${note}` : null,
    "",
    "If you have questions about which tests apply or how to prepare, please contact the clinic using the details below.",
    "",
    `${clinic}`,
    ...bundle.branding.clinicLines.filter((l) => l.trim()).map((l) => l.trim()),
    "",
    "—",
    "This email was sent from Follicle Intelligence (DoctorOS). Do not reply if this inbox is unmonitored; contact your clinic directly.",
  ].filter((x): x is string => Boolean(x));

  const subject = `Your blood test request from ${clinic}`;
  const fromHeader = buildResendFromAddress(cfg.resend);
  if (!fromHeader) throw new Error("RESEND_FROM_EMAIL is not configured.");

  const { resendId } = await sendResendEmailHttp(
    {
      apiKey: cfg.resend.apiKey!,
      from: fromHeader,
      to: [to],
      subject,
      text: bodyLines.join("\n"),
      attachments: [
        {
          filename: `pathology-request-${rid.slice(0, 8)}.pdf`,
          content: Buffer.from(pdfBytes).toString("base64"),
        },
      ],
    },
    {
      tenant_id: tid,
      pathology_request_id: rid,
      recipient_email_domain: to.includes("@") ? to.split("@")[1]?.toLowerCase() ?? null : null,
      delivery_path: "pathology_patient_pdf",
    }
  );

  try {
    const { error: upErr } = await supabase.storage
      .from(PATHOLOGY_PATIENT_PDF_BUCKET)
      .upload(storagePath, Buffer.from(pdfBytes), { contentType: "application/pdf", upsert: true });
    if (!upErr) {
      await persistPathologyRequestPdfStorage(
        { tenantId: tid, patientId: pid, requestId: rid, bucket: PATHOLOGY_PATIENT_PDF_BUCKET, storagePath },
        supabase
      );
    }
  } catch {
    /* best-effort copy in patient storage */
  }

  const sentAt = new Date().toISOString();
  await markPathologyRequestEmailedToPatient({ tenantId: tid, patientId: pid, requestId: rid, occurredAtIso: sentAt }, supabase);

  await appendCrmActivityEvent({
    tenantId: tid,
    activityKind: "pathology.blood_request.sent",
    title: "Blood request emailed to patient",
    patientId: pid,
    detail: {
      pathology_request_id: rid,
      resend_id: resendId,
      to_email_domain: to.includes("@") ? to.split("@")[1]?.toLowerCase() ?? null : null,
    },
    occurredAt: sentAt,
  });

  return { resendId, to };
}
