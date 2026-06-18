/**
 * ReceptionOS Phase 4/5 — outbound communication provider interface + dry-run/stub providers.
 */

export type ReceptionCommunicationChannel = "sms" | "email";

export type ReceptionCommunicationSendRequest = {
  tenantId: string;
  channel: ReceptionCommunicationChannel;
  toAddress: string | null;
  subject: string | null;
  body: string;
  metadata?: Record<string, unknown>;
};

export type ReceptionCommunicationSendResult = {
  delivered: boolean;
  externalMessageId: string | null;
  provider: "stub" | "resend" | "twilio";
  detail: string;
};

export interface ReceptionCommunicationProvider {
  send(request: ReceptionCommunicationSendRequest): Promise<ReceptionCommunicationSendResult>;
}

/** Stub provider — logs intent; no external API calls (Phase 4 default / tests). */
export class StubReceptionCommunicationProvider implements ReceptionCommunicationProvider {
  async send(request: ReceptionCommunicationSendRequest): Promise<ReceptionCommunicationSendResult> {
    const id = `stub-${request.channel}-${Date.now()}`;
    return {
      delivered: false,
      externalMessageId: id,
      provider: "stub",
      detail: `Stub ${request.channel} queued (provider not wired). Preview saved to contact log.`,
    };
  }
}

/** Dry-run provider — no external API calls; preserves Phase 4 stub semantics in send result. */
export class DryRunReceptionCommunicationProvider implements ReceptionCommunicationProvider {
  async send(request: ReceptionCommunicationSendRequest): Promise<ReceptionCommunicationSendResult> {
    const id = `dry-run-${request.channel}-${Date.now()}`;
    return {
      delivered: false,
      externalMessageId: id,
      provider: "stub",
      detail: `Dry run ${request.channel} — logged without external delivery.`,
    };
  }
}

let defaultProvider: ReceptionCommunicationProvider = new DryRunReceptionCommunicationProvider();

/** Test hook — swap provider implementation. */
export function setReceptionCommunicationProvider(provider: ReceptionCommunicationProvider): void {
  defaultProvider = provider;
}

export function resetReceptionCommunicationProviderToDefault(): void {
  defaultProvider = new DryRunReceptionCommunicationProvider();
}

export function getReceptionCommunicationProvider(): ReceptionCommunicationProvider {
  return defaultProvider;
}

export async function sendReceptionCommunication(
  request: ReceptionCommunicationSendRequest,
): Promise<ReceptionCommunicationSendResult> {
  const body = request.body.trim();
  if (!body) throw new Error("Message body is required.");
  return getReceptionCommunicationProvider().send(request);
}
