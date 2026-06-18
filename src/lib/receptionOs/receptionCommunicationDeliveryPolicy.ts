/**
 * ReceptionOS Phase 5 — controlled live delivery feature flags.
 * Default remains dry-run unless env explicitly enables outbound delivery.
 */

function envTruthy(v: string | undefined): boolean {
  const t = v?.trim().toLowerCase();
  return t === "true" || t === "1" || t === "on";
}

function envFalsy(v: string | undefined): boolean {
  const t = v?.trim().toLowerCase();
  return t === "false" || t === "0" || t === "off";
}

/** When true (default), outbound SMS/email are logged but not sent externally. */
export function isReceptionOsCommunicationDryRun(): boolean {
  const v = process.env.RECEPTION_OS_COMMUNICATION_DRY_RUN;
  if (envFalsy(v)) return false;
  if (envTruthy(v)) return true;
  return true;
}

export function isReceptionOsEmailSendEnabled(): boolean {
  return envTruthy(process.env.RECEPTION_OS_EMAIL_SEND_ENABLED);
}

export function isReceptionOsSmsSendEnabled(): boolean {
  return envTruthy(process.env.RECEPTION_OS_SMS_SEND_ENABLED);
}

export function shouldReceptionOsLiveSend(channel: "sms" | "email"): boolean {
  if (isReceptionOsCommunicationDryRun()) return false;
  return channel === "email" ? isReceptionOsEmailSendEnabled() : isReceptionOsSmsSendEnabled();
}
