/**
 * ReceptionOS Phase 6 — pilot / production readiness status model (pure).
 */

import type { ReceptionCloseoutSnapshot } from "@/src/lib/receptionOs/receptionDailyCloseoutModel";

export type ReceptionOsProviderMode =
  | "dry_run"
  | "stub"
  | "live_email"
  | "live_sms"
  | "live_both"
  | "live_blocked";

export type ReceptionOsCloseoutStatus = "open" | "closed";

export type ReceptionOsPilotBannerVariant = "info" | "warning" | "success" | "danger";

export type ReceptionOsPilotBanner = {
  variant: ReceptionOsPilotBannerVariant;
  title: string;
  message: string;
};

export type ReceptionOsSystemStatus = {
  dryRunEnabled: boolean;
  emailSendEnabled: boolean;
  smsSendEnabled: boolean;
  providerMode: ReceptionOsProviderMode;
  resendConfigured: boolean;
  twilioConfigured: boolean;
  pilotModeActive: boolean;
  pilotBanner: ReceptionOsPilotBanner | null;
  lastPayloadLoadedAt: string;
  failedSendsToday: number;
  closeoutStatus: ReceptionOsCloseoutStatus;
  closeoutOperatingDate: string;
  envChecklist: Array<{ key: string; label: string; present: boolean; optional?: boolean }>;
};

export type BuildReceptionOsSystemStatusInput = {
  dryRunEnabled: boolean;
  emailSendEnabled: boolean;
  smsSendEnabled: boolean;
  resendConfigured: boolean;
  twilioConfigured: boolean;
  loadedAt: string;
  closeout: Pick<
    ReceptionCloseoutSnapshot,
    "operatingDate" | "existingCloseoutId" | "failedCommunications" | "itemCounts"
  >;
};

export function deriveReceptionOsProviderMode(input: {
  dryRunEnabled: boolean;
  emailSendEnabled: boolean;
  smsSendEnabled: boolean;
  resendConfigured: boolean;
  twilioConfigured: boolean;
}): ReceptionOsProviderMode {
  if (input.dryRunEnabled) return "dry_run";
  const emailLive = input.emailSendEnabled && input.resendConfigured;
  const smsLive = input.smsSendEnabled && input.twilioConfigured;
  if (emailLive && smsLive) return "live_both";
  if (emailLive) return "live_email";
  if (smsLive) return "live_sms";
  if (input.emailSendEnabled || input.smsSendEnabled) return "live_blocked";
  return "dry_run";
}

export function isReceptionOsPilotModeActive(input: {
  dryRunEnabled: boolean;
  emailSendEnabled: boolean;
  smsSendEnabled: boolean;
  providerMode: ReceptionOsProviderMode;
}): boolean {
  if (input.dryRunEnabled) return true;
  if (!input.emailSendEnabled && !input.smsSendEnabled) return true;
  return (
    input.providerMode === "dry_run" ||
    input.providerMode === "stub" ||
    input.providerMode === "live_blocked"
  );
}

export function buildReceptionOsPilotBanner(
  status: Pick<
    ReceptionOsSystemStatus,
    | "pilotModeActive"
    | "dryRunEnabled"
    | "emailSendEnabled"
    | "smsSendEnabled"
    | "providerMode"
    | "resendConfigured"
    | "twilioConfigured"
  >
): ReceptionOsPilotBanner | null {
  if (!status.pilotModeActive) return null;

  if (status.providerMode === "live_blocked") {
    return {
      variant: "danger",
      title: "ReceptionOS pilot — live flags on but provider not configured",
      message:
        "RECEPTION_OS_EMAIL_SEND_ENABLED and/or RECEPTION_OS_SMS_SEND_ENABLED is true, but Resend or Twilio credentials are missing. Outbound messages will not deliver until credentials are set or flags are turned off.",
    };
  }

  const channelNote =
    !status.emailSendEnabled && !status.smsSendEnabled
      ? "Live email and SMS sends are disabled."
      : status.dryRunEnabled
        ? "RECEPTION_OS_COMMUNICATION_DRY_RUN is active."
        : "Provider is in dry-run/stub mode.";

  return {
    variant: "warning",
    title: "ReceptionOS clinic pilot — no external messages will be sent",
    message: `${channelNote} SMS/email actions log to the CRM contact timeline and delivery table only. Safe for Evolved Hair front-desk testing.`,
  };
}

export function buildReceptionOsSystemStatus(
  input: BuildReceptionOsSystemStatusInput
): ReceptionOsSystemStatus {
  const providerMode = deriveReceptionOsProviderMode(input);
  const pilotModeActive = isReceptionOsPilotModeActive({
    dryRunEnabled: input.dryRunEnabled,
    emailSendEnabled: input.emailSendEnabled,
    smsSendEnabled: input.smsSendEnabled,
    providerMode,
  });

  const base: ReceptionOsSystemStatus = {
    dryRunEnabled: input.dryRunEnabled,
    emailSendEnabled: input.emailSendEnabled,
    smsSendEnabled: input.smsSendEnabled,
    providerMode,
    resendConfigured: input.resendConfigured,
    twilioConfigured: input.twilioConfigured,
    pilotModeActive,
    pilotBanner: null,
    lastPayloadLoadedAt: input.loadedAt,
    failedSendsToday: input.closeout.failedCommunications.length,
    closeoutStatus: input.closeout.existingCloseoutId ? "closed" : "open",
    closeoutOperatingDate: input.closeout.operatingDate,
    envChecklist: [
      {
        key: "RECEPTION_OS_COMMUNICATION_DRY_RUN",
        label: "Dry-run mode (default on)",
        present: input.dryRunEnabled,
      },
      {
        key: "RECEPTION_OS_EMAIL_SEND_ENABLED",
        label: "Live email send flag",
        present: input.emailSendEnabled,
        optional: true,
      },
      {
        key: "RECEPTION_OS_SMS_SEND_ENABLED",
        label: "Live SMS send flag",
        present: input.smsSendEnabled,
        optional: true,
      },
      {
        key: "RESEND_API_KEY + RESEND_FROM_EMAIL",
        label: "Resend configured",
        present: input.resendConfigured,
        optional: true,
      },
      {
        key: "TWILIO_*",
        label: "Twilio configured",
        present: input.twilioConfigured,
        optional: true,
      },
    ],
  };

  return {
    ...base,
    pilotBanner: buildReceptionOsPilotBanner(base),
  };
}

export function providerModeLabel(mode: ReceptionOsProviderMode): string {
  switch (mode) {
    case "dry_run":
      return "Dry-run (no external send)";
    case "stub":
      return "Stub provider";
    case "live_email":
      return "Live email";
    case "live_sms":
      return "Live SMS";
    case "live_both":
      return "Live email + SMS";
    case "live_blocked":
      return "Live flags on — provider not ready";
    default:
      return mode;
  }
}
