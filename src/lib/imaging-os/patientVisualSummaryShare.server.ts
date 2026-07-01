import "server-only";

import { appendCrmActivityEvent } from "@/src/lib/crm/activity";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveEffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import { derivePatientIdentityContact } from "@/src/lib/patients/patientIdentityContact";
import { sendResendEmailHttp } from "@/src/lib/email/resendHttpSend.server";
import {
  buildResendFromAddress,
  isEmailDeliveryConfigured,
} from "@/src/lib/reminders/reminderDeliveryConfig";
import { loadReminderDeliveryConfig } from "@/src/lib/reminders/reminderDeliveryConfig.server";
import {
  patientVisualSummaryPatientAccessAllowed,
  readPatientVisualSummaryApproval,
} from "./patientVisualSummaryApprovalCore";
import {
  buildPatientVisualSummarySharePath,
  resolvePatientVisualSummaryShareSecret,
  signPatientVisualSummaryShareToken,
} from "./patientVisualSummaryShareTokenCore";
import type { PatientVisualSummaryReportType } from "./patientVisualSummaryReportTypes";

export type GeneratePatientVisualSummaryShareLinkResult = {
  shareUrl: string;
  expiresAt: string;
};

function resolveCasePatientId(row: {
  patient_id?: string | null;
  foundation_patient_id?: string | null;
}): string | null {
  const legacy = row.patient_id != null ? String(row.patient_id).trim() : "";
  if (legacy) return legacy;
  const foundation =
    row.foundation_patient_id != null ? String(row.foundation_patient_id).trim() : "";
  return foundation || null;
}

export async function generatePatientVisualSummaryShareLink(input: {
  tenantId: string;
  caseId: string;
  patientId: string;
  reportType: PatientVisualSummaryReportType;
  origin: string;
}): Promise<GeneratePatientVisualSummaryShareLinkResult> {
  const secret = resolvePatientVisualSummaryShareSecret();
  if (!secret) {
    throw new Error(
      "Share links are not configured (set PATIENT_VISUAL_SUMMARY_SHARE_SECRET or CRON_SECRET)."
    );
  }

  const tid = input.tenantId.trim();
  const caseId = input.caseId.trim();
  const patientId = input.patientId.trim();

  const supabase = supabaseAdmin();
  const { data: caseRow, error } = await supabase
    .from("fi_cases")
    .select("patient_id, foundation_patient_id, metadata, tenant_id")
    .eq("id", caseId)
    .eq("tenant_id", tid)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!caseRow) throw new Error("Case not found.");

  const casePatientId = resolveCasePatientId(caseRow as {
    patient_id?: string | null;
    foundation_patient_id?: string | null;
  });
  if (!casePatientId || casePatientId !== patientId) {
    throw new Error("Case does not belong to this patient.");
  }

  const metadata =
    caseRow.metadata && typeof caseRow.metadata === "object" && !Array.isArray(caseRow.metadata)
      ? (caseRow.metadata as Record<string, unknown>)
      : {};
  const approval = readPatientVisualSummaryApproval(metadata, input.reportType);
  if (!approval || !patientVisualSummaryPatientAccessAllowed(approval)) {
    throw new Error("Report must be approved before sharing with the patient.");
  }

  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const token = signPatientVisualSummaryShareToken(
    {
      tenantId: tid,
      caseId,
      patientId,
      reportType: input.reportType,
    },
    secret,
    { exp }
  );

  const path = buildPatientVisualSummarySharePath({ tenantId: tid, token });
  const origin = input.origin.replace(/\/$/, "");
  return {
    shareUrl: `${origin}${path}`,
    expiresAt: new Date(exp).toISOString(),
  };
}

export async function sendPatientVisualSummaryShareEmail(input: {
  tenantId: string;
  patientId: string;
  caseId: string;
  reportType: PatientVisualSummaryReportType;
  origin: string;
  personalNote?: string | null;
}): Promise<{ shareUrl: string; to: string; resendId: string | null }> {
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();

  const link = await generatePatientVisualSummaryShareLink({
    tenantId: tid,
    caseId: input.caseId,
    patientId: pid,
    reportType: input.reportType,
    origin: input.origin,
  });

  const supabase = supabaseAdmin();
  const { data: patientRow, error: pErr } = await supabase
    .from("fi_patients")
    .select("id, metadata, person_id")
    .eq("tenant_id", tid)
    .eq("id", pid)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!patientRow) throw new Error("Patient not found.");

  const personId = String((patientRow as { person_id: string }).person_id);
  const { data: personRow, error: personErr } = await supabase
    .from("fi_persons")
    .select("metadata")
    .eq("id", personId)
    .maybeSingle();
  if (personErr) throw new Error(personErr.message);

  const personMetadata =
    personRow && typeof (personRow as { metadata?: unknown }).metadata === "object"
      ? ((personRow as { metadata: Record<string, unknown> }).metadata ?? {})
      : {};
  const patientMetadata =
    typeof (patientRow as { metadata?: unknown }).metadata === "object"
      ? ((patientRow as { metadata: Record<string, unknown> }).metadata ?? {})
      : {};

  const identity = derivePatientIdentityContact({ personMetadata, patientMetadata });
  const to = identity.primaryEmail?.trim();
  if (!to) throw new Error("Patient has no email on file for this person record.");

  const cfg = loadReminderDeliveryConfig();
  if (!isEmailDeliveryConfigured(cfg)) {
    throw new Error("Email delivery is not configured (set RESEND_API_KEY and RESEND_FROM_EMAIL).");
  }

  const branding = await resolveEffectiveBranding({ tenantId: tid }, supabase);
  const clinic = branding.clinic_display_name ?? branding.brand_name ?? "Your clinic";
  const firstName = identity.fullName.split(/\s+/)[0] ?? identity.fullName;
  const note = input.personalNote?.trim();
  const reportLabel =
    input.reportType === "hairaudit_visual_summary"
      ? "HairAudit visual summary"
      : "post-surgery visual summary";

  const bodyLines = [
    `Hi ${firstName},`,
    "",
    `Your clinician at ${clinic} has shared an approved ${reportLabel} with you.`,
    "Open the secure link below to view or download your patient-safe PDF:",
    "",
    link.shareUrl,
    "",
    note ? `Message from your clinician: ${note}` : null,
    "",
    `This link expires on ${new Date(link.expiresAt).toLocaleString()}.`,
    "",
    "If you have questions, please contact the clinic directly.",
    "",
    "—",
    "This email was sent from Follicle Intelligence. Do not reply if this inbox is unmonitored.",
  ].filter((x): x is string => Boolean(x));

  const fromHeader = buildResendFromAddress(cfg.resend);
  if (!fromHeader) throw new Error("RESEND_FROM_EMAIL is not configured.");

  const { resendId } = await sendResendEmailHttp(
    {
      apiKey: cfg.resend.apiKey!,
      from: fromHeader,
      to: [to],
      subject: `Your ${reportLabel} from ${clinic}`,
      text: bodyLines.join("\n"),
    },
    {
      tenant_id: tid,
      delivery_path: "patient_visual_summary_share_link",
      recipient_email_domain: to.includes("@") ? (to.split("@")[1]?.toLowerCase() ?? null) : null,
    }
  );

  await appendCrmActivityEvent({
    tenantId: tid,
    activityKind: "imaging.visual_summary.shared",
    title: "Visual summary share link sent to patient",
    patientId: pid,
    detail: {
      case_id: input.caseId.trim(),
      report_type: input.reportType,
      resend_id: resendId,
      expires_at: link.expiresAt,
      to_email_domain: to.includes("@") ? (to.split("@")[1]?.toLowerCase() ?? null) : null,
    },
  });

  return { shareUrl: link.shareUrl, to, resendId };
}