import "server-only";

import { createCrmLeadCommunication } from "@/src/lib/crm/leadCommunications";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildReceptionCommunicationVariables,
  type ReceptionCommunicationContextInput,
} from "@/src/lib/receptionOs/receptionCommunicationComposer";
import {
  resolveReceptionCommunicationContactSubject,
  resolveReceptionCommunicationToAddress,
} from "@/src/lib/receptionOs/receptionCommunicationContact.server";
import {
  mapSendResultToDeliveryStatus,
  persistReceptionCommunicationDelivery,
} from "@/src/lib/receptionOs/receptionCommunicationDelivery.server";
import type { ReceptionCommunicationDeliveryStatus } from "@/src/lib/receptionOs/receptionCommunicationDelivery.types";
import { isReceptionOsCommunicationDryRun } from "@/src/lib/receptionOs/receptionCommunicationDeliveryPolicy";
import { receptionCommunicationActionAllowed } from "@/src/lib/receptionOs/receptionCommunicationPolicy";
import { sendReceptionCommunication } from "@/src/lib/receptionOs/receptionCommunicationProvider";
import "@/src/lib/receptionOs/receptionCommunicationProviderLive.server";
import { validateReceptionCommunicationSafety } from "@/src/lib/receptionOs/receptionCommunicationSafety";
import {
  renderReceptionCommunicationTemplateContent,
  type ReceptionCommunicationTemplateKey,
} from "@/src/lib/receptionOs/receptionCommunicationTemplates";
import { loadReceptionCommunicationTemplateForTenant } from "@/src/lib/receptionOs/receptionCommunicationTemplates.server";
import { resolvePaymentLinkForPaymentRecord } from "@/src/lib/receptionOs/receptionPaymentLink.server";
import type { ReceptionOsViewerRole } from "@/src/lib/receptionOs/receptionOsBoardModel";
import { insertReceptionTaskAuditEvent } from "@/src/lib/receptionOs/receptionTaskAudit.server";
import { setReceptionTaskStatus } from "@/src/lib/receptionOs/receptionTasks.server";

export type ReceptionCommunicationLogChannel = "sms" | "email" | "phone" | "note";

export type ExecuteReceptionCommunicationParams = {
  tenantId: string;
  role: ReceptionOsViewerRole;
  actorFiUserId: string | null;
  channel: ReceptionCommunicationLogChannel;
  templateKey: ReceptionCommunicationTemplateKey;
  context: ReceptionCommunicationContextInput;
  /** Staff-edited copy (preview body / subject). */
  smsBody?: string | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  /** For log_call / add_note without template send. */
  manualPreview?: string | null;
  manualSubject?: string | null;
  callOutcome?: string | null;
  updateTaskStatus?: "in_progress" | "resolved" | null;
  toAddress?: string | null;
  allowLongSms?: boolean;
};

export type ExecuteReceptionCommunicationResult = {
  communicationId: string | null;
  deliveryId: string | null;
  externalMessageId: string | null;
  provider: string;
  deliveryStatus: string | null;
  paymentLink: string | null;
  taskStatusUpdated: boolean;
};

function previewBounded(text: string | null | undefined, max = 512): string | null {
  if (!text?.trim()) return null;
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

async function enrichPaymentLink(
  tenantId: string,
  context: ReceptionCommunicationContextInput
): Promise<string | null> {
  if (context.paymentLink?.trim()) return context.paymentLink.trim();
  if (context.sourceKind === "deposit" && context.sourceId) {
    return resolvePaymentLinkForPaymentRecord(tenantId, context.sourceId);
  }
  return null;
}

export async function executeReceptionCommunicationAction(
  params: ExecuteReceptionCommunicationParams
): Promise<ExecuteReceptionCommunicationResult> {
  const tenantId = assertNonEmptyUuid(params.tenantId, "tenantId");
  const { role, channel, templateKey, context, actorFiUserId } = params;

  const paymentLink = await enrichPaymentLink(tenantId, context);
  const enrichedContext: ReceptionCommunicationContextInput = {
    ...context,
    paymentLink: paymentLink ?? context.paymentLink ?? null,
  };

  const action =
    channel === "sms"
      ? "send_sms"
      : channel === "email"
        ? "send_email"
        : channel === "phone"
          ? "log_call"
          : "add_note";

  if (!receptionCommunicationActionAllowed(role, action, templateKey)) {
    throw new Error(`Action "${action}" is not permitted for your role and template.`);
  }

  const template = await loadReceptionCommunicationTemplateForTenant(tenantId, templateKey);
  const variables = buildReceptionCommunicationVariables(enrichedContext);
  const rendered = renderReceptionCommunicationTemplateContent(template, variables);

  let subject: string | null = null;
  let preview: string | null = null;
  let communicationType = "other";
  let direction = "outbound";
  let outcome: string | null = null;
  let externalMessageId: string | null = null;
  let providerName = "manual";
  let deliveryStatus: ReceptionCommunicationDeliveryStatus | null = null;
  let deliveryId: string | null = null;
  let deliveryError: string | null = null;

  const contactSubject = await resolveReceptionCommunicationContactSubject(tenantId, {
    leadId: enrichedContext.leadId,
    taskId: enrichedContext.taskId,
  });
  const leadId = contactSubject.leadId;
  const patientId = contactSubject.patientId;

  if (channel === "sms" || channel === "email") {
    const body =
      channel === "sms"
        ? (params.smsBody ?? rendered.smsBody ?? "").trim()
        : (params.emailBody ?? rendered.emailBody ?? "").trim();
    subject =
      channel === "email"
        ? previewBounded(params.emailSubject ?? rendered.emailSubject ?? null, 512)
        : null;

    const toAddress = resolveReceptionCommunicationToAddress(
      channel,
      params.toAddress,
      contactSubject
    );
    const safety = validateReceptionCommunicationSafety({
      channel,
      templateKey,
      body,
      toAddress,
      leadId,
      patientId,
      allowLongSms: params.allowLongSms,
    });
    if (!safety.ok) throw new Error(safety.reason);

    const sendResult = await sendReceptionCommunication({
      tenantId,
      channel,
      toAddress,
      subject,
      body,
      metadata: {
        template_key: templateKey,
        source_kind: context.sourceKind,
        source_id: context.sourceId,
      },
    });

    preview = previewBounded(body);
    communicationType = channel;
    externalMessageId = sendResult.externalMessageId;
    providerName = sendResult.provider;
    outcome = sendResult.delivered ? "replied" : "follow_up_required";

    const dryRun = isReceptionOsCommunicationDryRun();
    deliveryStatus = mapSendResultToDeliveryStatus({ sendResult, dryRun });
    if (deliveryStatus === "failed" && !sendResult.delivered) {
      deliveryError = sendResult.detail;
    }

    const deliveryRow = await persistReceptionCommunicationDelivery({
      tenantId,
      leadId,
      patientId,
      taskId: context.taskId ?? null,
      channel,
      templateKey,
      toAddress,
      sendResult,
      deliveryStatus,
      errorMessage: deliveryError,
      metadata: {
        reception_os_phase5: true,
        source_kind: context.sourceKind,
        source_id: context.sourceId,
        dry_run: dryRun,
      },
    });
    deliveryId = deliveryRow.id;
  } else if (channel === "phone") {
    preview = previewBounded(params.manualPreview ?? `Call logged for ${context.label}`);
    subject = previewBounded(params.manualSubject ?? "Phone call", 512);
    communicationType = "phone";
    outcome = params.callOutcome?.trim() || "connected";
  } else {
    preview = previewBounded(params.manualPreview ?? params.emailBody ?? "");
    subject = previewBounded(params.manualSubject ?? "Internal note", 512);
    communicationType = "other";
    direction = "internal";
    outcome = "other";
  }

  let communicationId: string | null = null;

  if (leadId) {
    const row = await createCrmLeadCommunication({
      tenantId,
      leadId,
      communicationType,
      direction,
      outcome,
      subject,
      preview,
      externalMessageId,
      actorUserId: actorFiUserId,
      metadata: {
        reception_os_phase4: true,
        reception_os_phase5: channel === "sms" || channel === "email",
        template_key: templateKey,
        source_kind: context.sourceKind,
        source_id: context.sourceId,
        task_id: context.taskId ?? null,
        provider: providerName,
        payment_link: paymentLink,
        delivery_id: deliveryId,
        delivery_status: deliveryStatus,
        channel: channel === "sms" || channel === "email" ? channel : null,
        error_message: deliveryError,
        sent_at: deliveryStatus === "sent" ? new Date().toISOString() : null,
      },
    });
    communicationId = row.id;

    if (deliveryId) {
      await supabaseAdmin()
        .from("fi_reception_communication_deliveries")
        .update({ crm_communication_id: communicationId })
        .eq("tenant_id", tenantId)
        .eq("id", deliveryId);
    }
  }

  let taskStatusUpdated = false;
  if (context.taskId?.trim()) {
    await insertReceptionTaskAuditEvent({
      tenantId,
      taskId: context.taskId.trim(),
      eventKind: "communication_sent",
      actorFiUserId,
      detail: {
        channel,
        template_key: templateKey,
        communication_id: communicationId,
        delivery_id: deliveryId,
        delivery_status: deliveryStatus,
        lead_id: leadId,
        source_kind: context.sourceKind,
        source_id: context.sourceId,
        provider: providerName,
        payment_reminder:
          templateKey === "deposit_reminder" || templateKey === "payment_link_follow_up",
      },
    });

    if (params.updateTaskStatus) {
      await setReceptionTaskStatus({
        tenantId,
        taskId: context.taskId.trim(),
        status: params.updateTaskStatus,
        actorFiUserId,
        resolutionNotes: null,
      });
      taskStatusUpdated = true;
    } else if (channel === "sms" || channel === "email" || channel === "phone") {
      await setReceptionTaskStatus({
        tenantId,
        taskId: context.taskId.trim(),
        status: "in_progress",
        actorFiUserId,
        resolutionNotes: null,
      });
      taskStatusUpdated = true;
    }
  }

  return {
    communicationId,
    deliveryId,
    externalMessageId,
    provider: providerName,
    deliveryStatus,
    paymentLink,
    taskStatusUpdated,
  };
}

/** Payment reminder workflow — send deposit reminder, log, keep alert open (no resolve). */
export async function executePaymentReminderWorkflow(
  params: Omit<
    ExecuteReceptionCommunicationParams,
    "templateKey" | "channel" | "updateTaskStatus"
  > & {
    channel?: "sms" | "email";
  }
): Promise<ExecuteReceptionCommunicationResult> {
  const link = await enrichPaymentLink(params.tenantId, params.context);
  const templateKey: ReceptionCommunicationTemplateKey = link
    ? "payment_link_follow_up"
    : "deposit_reminder";
  return executeReceptionCommunicationAction({
    ...params,
    channel: params.channel ?? "sms",
    templateKey,
    updateTaskStatus: "in_progress",
    context: { ...params.context, paymentLink: link },
  });
}
