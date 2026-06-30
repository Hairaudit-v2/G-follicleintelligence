import "server-only";

import { sendResendEmailHttp } from "@/src/lib/email/resendHttpSend.server";
import {
  isReceptionOsCommunicationDryRun,
  shouldReceptionOsLiveSend,
} from "@/src/lib/receptionOs/receptionCommunicationDeliveryPolicy";
import {
  DryRunReceptionCommunicationProvider,
  type ReceptionCommunicationProvider,
  type ReceptionCommunicationSendRequest,
  type ReceptionCommunicationSendResult,
  getReceptionCommunicationProvider,
  setReceptionCommunicationProvider,
} from "@/src/lib/receptionOs/receptionCommunicationProvider";
import {
  buildResendFromAddress,
  isEmailDeliveryConfigured,
  isSmsDeliveryConfigured,
} from "@/src/lib/reminders/reminderDeliveryConfig";
import { loadReminderDeliveryConfig } from "@/src/lib/reminders/reminderDeliveryConfig.server";
import { sendTwilioSmsViaReminderConfig } from "@/src/lib/reminders/reminderDelivery.server";

/** Live provider — Resend (email) and Twilio (SMS) when configured. */
export class LiveReceptionCommunicationProvider implements ReceptionCommunicationProvider {
  async send(
    request: ReceptionCommunicationSendRequest
  ): Promise<ReceptionCommunicationSendResult> {
    const cfg = loadReminderDeliveryConfig();
    const to = request.toAddress?.trim() ?? "";
    const body = request.body.trim();

    if (request.channel === "email") {
      if (!isEmailDeliveryConfigured(cfg)) {
        throw new Error("Email delivery is not configured (RESEND_API_KEY and RESEND_FROM_EMAIL).");
      }
      if (!to) throw new Error("Email recipient is required.");
      const from = buildResendFromAddress(cfg.resend);
      if (!from) throw new Error("RESEND_FROM_EMAIL is not configured.");

      const { resendId } = await sendResendEmailHttp(
        {
          apiKey: cfg.resend.apiKey!,
          from,
          to: [to],
          subject: request.subject?.trim() || "Message from clinic",
          text: body,
        },
        { tenant_id: request.tenantId, delivery_path: "reception_os_communication" }
      );

      return {
        delivered: true,
        externalMessageId: resendId,
        provider: "resend",
        detail: "Email sent via Resend.",
      };
    }

    if (!isSmsDeliveryConfigured(cfg)) {
      throw new Error("SMS delivery is not configured (Twilio credentials).");
    }
    if (!to) throw new Error("SMS recipient is required.");

    const { externalId } = await sendTwilioSmsViaReminderConfig({ cfg, to, body });
    return {
      delivered: true,
      externalMessageId: externalId,
      provider: "twilio",
      detail: "SMS sent via Twilio.",
    };
  }
}

/** Flag-aware provider — dry-run by default unless env explicitly enables delivery. */
export class ControlledReceptionCommunicationProvider implements ReceptionCommunicationProvider {
  private readonly dryRun = new DryRunReceptionCommunicationProvider();
  private readonly live = new LiveReceptionCommunicationProvider();

  async send(
    request: ReceptionCommunicationSendRequest
  ): Promise<ReceptionCommunicationSendResult> {
    if (isReceptionOsCommunicationDryRun() || !shouldReceptionOsLiveSend(request.channel)) {
      return this.dryRun.send(request);
    }

    try {
      return await this.live.send(request);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Delivery failed.";
      return {
        delivered: false,
        externalMessageId: null,
        provider: request.channel === "email" ? "resend" : "twilio",
        detail: message,
      };
    }
  }
}

let productionProviderRegistered = false;

/** Registers the controlled provider for server-side ReceptionOS sends (idempotent). */
export function ensureReceptionCommunicationProductionProvider(): void {
  if (productionProviderRegistered) return;
  if (getReceptionCommunicationProvider() instanceof DryRunReceptionCommunicationProvider) {
    setReceptionCommunicationProvider(new ControlledReceptionCommunicationProvider());
  }
  productionProviderRegistered = true;
}

ensureReceptionCommunicationProductionProvider();
