"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";

import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { getFiTenantMemberSessionIfAllowed } from "@/src/lib/crm/crmShellAccess";
import {
  buildReceptionCommunicationVariables,
  suggestReceptionCommunicationTemplateKey,
  type ReceptionCommunicationContextInput,
} from "@/src/lib/receptionOs/receptionCommunicationComposer";
import {
  executePaymentReminderWorkflow,
  executeReceptionCommunicationAction,
} from "@/src/lib/receptionOs/receptionCommunicationLog.server";
import { receptionCommunicationActionAllowed } from "@/src/lib/receptionOs/receptionCommunicationPolicy";
import {
  renderReceptionCommunicationTemplateContent,
  RECEPTION_COMMUNICATION_TEMPLATE_KEYS,
} from "@/src/lib/receptionOs/receptionCommunicationTemplates";
import { loadReceptionCommunicationTemplateForTenant } from "@/src/lib/receptionOs/receptionCommunicationTemplates.server";
import { resolvePaymentLinkForPaymentRecord } from "@/src/lib/receptionOs/receptionPaymentLink.server";
import { resolveReceptionOsViewerContext } from "@/src/lib/receptionOs/receptionOsAccess.server";
import { trackReceptionUsageEventSafe } from "@/src/lib/receptionOs/receptionUsageEvents.server";

const optionalAdminKey = z.object({ adminKey: z.string().optional() });

const usageContextSchema = z.object({
  operatingMode: z.enum(["morning_prep", "live_clinic", "end_of_day"]).nullable().optional(),
});

const contextSchema = z.object({
  sourceKind: z.enum([
    "task",
    "action_alert",
    "revenue_alert",
    "deposit",
    "surgery",
    "pipeline",
    "patient",
  ]),
  sourceId: z.string().min(1),
  label: z.string().min(1),
  alertKind: z.string().nullable().optional(),
  taskSourceType: z
    .enum(["booking", "patient", "case", "lead", "payment", "consultation", "surgery", "system"])
    .nullable()
    .optional(),
  patientFirstName: z.string().nullable().optional(),
  appointmentDate: z.string().nullable().optional(),
  surgeryDate: z.string().nullable().optional(),
  quoteAmount: z.union([z.string(), z.number()]).nullable().optional(),
  depositAmount: z.union([z.string(), z.number()]).nullable().optional(),
  currency: z.string().nullable().optional(),
  paymentLink: z.string().nullable().optional(),
  clinicName: z.string().nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
});

const previewSchema = optionalAdminKey.extend({
  context: contextSchema,
  templateKey: z.enum(RECEPTION_COMMUNICATION_TEMPLATE_KEYS).optional(),
  usageContext: usageContextSchema.optional(),
});

const sendSchema = optionalAdminKey.extend({
  context: contextSchema,
  templateKey: z.enum(RECEPTION_COMMUNICATION_TEMPLATE_KEYS),
  channel: z.enum(["sms", "email", "phone", "note"]),
  smsBody: z.string().max(4000).nullable().optional(),
  emailSubject: z.string().max(512).nullable().optional(),
  emailBody: z.string().max(8000).nullable().optional(),
  manualPreview: z.string().max(4000).nullable().optional(),
  manualSubject: z.string().max(512).nullable().optional(),
  callOutcome: z.string().max(64).nullable().optional(),
  toAddress: z.string().max(256).nullable().optional(),
  allowLongSms: z.boolean().optional(),
  updateTaskStatus: z.enum(["in_progress", "resolved"]).nullable().optional(),
  usageContext: usageContextSchema.optional(),
});

const paymentReminderSchema = optionalAdminKey.extend({
  context: contextSchema,
  channel: z.enum(["sms", "email"]).optional(),
  smsBody: z.string().max(4000).nullable().optional(),
  emailSubject: z.string().max(512).nullable().optional(),
  emailBody: z.string().max(8000).nullable().optional(),
  toAddress: z.string().max(256).nullable().optional(),
});

const paymentLinkSchema = optionalAdminKey.extend({
  paymentRecordId: z.string().uuid().optional(),
  context: contextSchema.optional(),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateReceptionOsPaths(tenantId: string) {
  revalidatePath(`/fi-admin/${tenantId.trim()}/reception-os`);
}

async function assertCommunicationAccess(
  tenantId: string,
  adminKey?: string
): Promise<{
  role: import("@/src/lib/receptionOs/receptionOsBoardModel").ReceptionOsViewerRole;
  actorFiUserId: string | null;
}> {
  const tid = tenantId.trim();
  await assertCrmTenantReadAllowed({ tenantId: tid, adminKey, request: undefined });
  const viewer = await resolveReceptionOsViewerContext(tid);
  if (!viewer.canAccessReceptionOs) {
    throw new Error(
      "ReceptionOS access requires an active staff or CRM shell role for this tenant."
    );
  }
  const member = await getFiTenantMemberSessionIfAllowed(tid);
  return { role: viewer.receptionOsRole, actorFiUserId: member?.fiUserId ?? null };
}

export type ReceptionCommunicationPreviewPayload = {
  templateKey: import("@/src/lib/receptionOs/receptionCommunicationTemplates").ReceptionCommunicationTemplateKey;
  suggestedTemplateKey: import("@/src/lib/receptionOs/receptionCommunicationTemplates").ReceptionCommunicationTemplateKey;
  smsBody: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  paymentLink: string | null;
  canSendSms: boolean;
  canSendEmail: boolean;
  canLogCall: boolean;
  canAddNote: boolean;
  canCopyPaymentLink: boolean;
};

export async function previewReceptionCommunicationAction(
  tenantId: string,
  body: unknown
): Promise<
  { ok: true; preview: ReceptionCommunicationPreviewPayload } | { ok: false; error: string }
> {
  try {
    const parsed = previewSchema.parse(body);
    const { role, actorFiUserId } = await assertCommunicationAccess(tenantId, parsed.adminKey);
    const context = parsed.context as ReceptionCommunicationContextInput;
    const suggested = suggestReceptionCommunicationTemplateKey(context);
    const templateKey = parsed.templateKey ?? suggested;

    let paymentLink = context.paymentLink ?? null;
    if (!paymentLink && context.sourceKind === "deposit") {
      paymentLink = await resolvePaymentLinkForPaymentRecord(tenantId, context.sourceId);
    }

    const template = await loadReceptionCommunicationTemplateForTenant(tenantId, templateKey);
    const rendered = renderReceptionCommunicationTemplateContent(
      template,
      buildReceptionCommunicationVariables({ ...context, paymentLink })
    );

    trackReceptionUsageEventSafe({
      tenantId: tenantId.trim(),
      profileId: actorFiUserId,
      eventKind: "communication_previewed",
      context: {
        operatingMode: parsed.usageContext?.operatingMode ?? null,
        taskId: context.taskId ?? null,
        alertKind: context.alertKind ?? null,
        sourceRefId: context.sourceId,
        metadata: { templateKey, sourceKind: context.sourceKind, channel: "preview" },
      },
    });

    return {
      ok: true,
      preview: {
        templateKey,
        suggestedTemplateKey: suggested,
        smsBody: rendered.smsBody,
        emailSubject: rendered.emailSubject,
        emailBody: rendered.emailBody,
        paymentLink,
        canSendSms: receptionCommunicationActionAllowed(role, "send_sms", templateKey),
        canSendEmail: receptionCommunicationActionAllowed(role, "send_email", templateKey),
        canLogCall: receptionCommunicationActionAllowed(role, "log_call", templateKey),
        canAddNote: receptionCommunicationActionAllowed(role, "add_note", templateKey),
        canCopyPaymentLink: receptionCommunicationActionAllowed(
          role,
          "copy_payment_link",
          templateKey
        ),
      },
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function sendReceptionCommunicationAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; communicationId: string | null; paymentLink: string | null; provider: string }
  | { ok: false; error: string }
> {
  try {
    const parsed = sendSchema.parse(body);
    const { role, actorFiUserId } = await assertCommunicationAccess(tenantId, parsed.adminKey);
    const result = await executeReceptionCommunicationAction({
      tenantId: tenantId.trim(),
      role,
      actorFiUserId,
      channel: parsed.channel,
      templateKey: parsed.templateKey,
      context: parsed.context as ReceptionCommunicationContextInput,
      smsBody: parsed.smsBody,
      emailSubject: parsed.emailSubject,
      emailBody: parsed.emailBody,
      manualPreview: parsed.manualPreview,
      manualSubject: parsed.manualSubject,
      callOutcome: parsed.callOutcome,
      updateTaskStatus: parsed.updateTaskStatus ?? null,
      toAddress: parsed.toAddress,
      allowLongSms: parsed.allowLongSms,
    });
    if (result.provider === "dry_run" || result.provider === "stub") {
      trackReceptionUsageEventSafe({
        tenantId: tenantId.trim(),
        profileId: actorFiUserId,
        eventKind: "communication_dry_run_sent",
        context: {
          operatingMode: parsed.usageContext?.operatingMode ?? null,
          taskId: parsed.context.taskId ?? null,
          alertKind: parsed.context.alertKind ?? null,
          sourceRefId: parsed.context.sourceId,
          metadata: {
            templateKey: parsed.templateKey,
            channel: parsed.channel,
            provider: result.provider,
          },
        },
      });
    }
    revalidateReceptionOsPaths(tenantId);
    return {
      ok: true,
      communicationId: result.communicationId,
      paymentLink: result.paymentLink,
      provider: result.provider,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function sendPaymentReminderAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; communicationId: string | null; paymentLink: string | null; provider: string }
  | { ok: false; error: string }
> {
  try {
    const parsed = paymentReminderSchema.parse(body);
    const { role, actorFiUserId } = await assertCommunicationAccess(tenantId, parsed.adminKey);
    const result = await executePaymentReminderWorkflow({
      tenantId: tenantId.trim(),
      role,
      actorFiUserId,
      channel: parsed.channel,
      context: parsed.context as ReceptionCommunicationContextInput,
      smsBody: parsed.smsBody,
      emailSubject: parsed.emailSubject,
      emailBody: parsed.emailBody,
      toAddress: parsed.toAddress,
    });
    revalidateReceptionOsPaths(tenantId);
    return {
      ok: true,
      communicationId: result.communicationId,
      paymentLink: result.paymentLink,
      provider: result.provider,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function resolveReceptionPaymentLinkAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; paymentLink: string | null } | { ok: false; error: string }> {
  try {
    const parsed = paymentLinkSchema.parse(body);
    await assertCommunicationAccess(tenantId, parsed.adminKey);
    const recordId =
      parsed.paymentRecordId ??
      (parsed.context?.sourceKind === "deposit" ? parsed.context.sourceId : null);
    if (!recordId) return { ok: true, paymentLink: null };
    const paymentLink = await resolvePaymentLinkForPaymentRecord(tenantId, recordId);
    return { ok: true, paymentLink };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
