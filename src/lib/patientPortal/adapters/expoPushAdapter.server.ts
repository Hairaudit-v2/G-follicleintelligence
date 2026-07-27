/**
 * FI-PATIENT-APP-2G — Expo Push Service adapter (provider implementation only).
 * Domain code must call through the dispatch service, not this module directly.
 */
import "server-only";

export type PushAdapterSendInput = {
  providerToken: string;
  title: string;
  body: string;
  data: Record<string, string>;
  /** Android channel id when supported by Expo. */
  channelId?: string;
};

export type PushAdapterSendResult =
  | { ok: true; ticketId?: string }
  | {
      ok: false;
      kind: "invalid_token" | "temporary" | "permanent";
      message: string;
    };

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Send one Expo push notification. Never logs the full token.
 */
export async function sendExpoPushNotification(
  input: PushAdapterSendInput
): Promise<PushAdapterSendResult> {
  const token = input.providerToken.trim();
  if (!token) {
    return { ok: false, kind: "invalid_token", message: "empty_token" };
  }

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: token,
        title: input.title,
        body: input.body,
        data: input.data,
        sound: "default",
        channelId: input.channelId,
        priority: "default",
      }),
    });

    if (res.status >= 500) {
      return { ok: false, kind: "temporary", message: `expo_http_${res.status}` };
    }
    if (res.status === 429) {
      return { ok: false, kind: "temporary", message: "expo_rate_limited" };
    }
    if (!res.ok) {
      return { ok: false, kind: "permanent", message: `expo_http_${res.status}` };
    }

    const json = (await res.json()) as {
      data?:
        | { status?: string; id?: string; message?: string; details?: { error?: string } }
        | Array<{
            status?: string;
            id?: string;
            message?: string;
            details?: { error?: string };
          }>;
    };

    const ticket = Array.isArray(json.data) ? json.data[0] : json.data;
    if (!ticket) {
      return { ok: false, kind: "temporary", message: "expo_empty_ticket" };
    }

    if (ticket.status === "ok") {
      return { ok: true, ticketId: ticket.id };
    }

    const errCode = ticket.details?.error ?? ticket.message ?? "unknown";
    if (
      errCode === "DeviceNotRegistered" ||
      errCode === "InvalidCredentials" ||
      /not.?registered|invalid.?token/i.test(String(errCode))
    ) {
      return { ok: false, kind: "invalid_token", message: String(errCode) };
    }
    if (/MessageTooBig|MessageRateExceeded|ProviderError/i.test(String(errCode))) {
      return { ok: false, kind: "temporary", message: String(errCode) };
    }
    return { ok: false, kind: "permanent", message: String(errCode) };
  } catch {
    return { ok: false, kind: "temporary", message: "expo_network_error" };
  }
}
