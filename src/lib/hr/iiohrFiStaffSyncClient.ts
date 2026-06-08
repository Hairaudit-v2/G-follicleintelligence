/**
 * HTTP client for FI staff sync (no env reads — safe for unit tests without server-only).
 */

import type { IiohrHrStaffSyncRow } from "@/src/lib/staffImport/iiohrHrStaffSyncTypes";

export type PushStaffSyncToFiInput = {
  tenantId: string;
  rows: IiohrHrStaffSyncRow[];
  mode: "preview" | "commit";
  confirm?: boolean;
};

/** Parsed FI API JSON (POST …/staff-sync). Safe to use from client components (no secrets). */
export type PushStaffSyncToFiResult = {
  httpStatus: number;
  ok: boolean;
  runId: string | null;
  rowsSent: number;
  raw: Record<string, unknown>;
};

export type ExecuteFiStaffSyncPostInput = {
  url: string;
  secret: string;
  body: Record<string, unknown>;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type ExecuteFiStaffSyncPostResult = {
  httpStatus: number;
  json: Record<string, unknown>;
};

/**
 * POST JSON to FI staff-sync. Does not log `secret`. Error messages are scrubbed if they ever contained the secret.
 */
export async function executeFiStaffSyncPost(input: ExecuteFiStaffSyncPostInput): Promise<ExecuteFiStaffSyncPostResult> {
  const secret = input.secret;
  const timeoutMs = input.timeoutMs ?? 25_000;
  const fetchFn = input.fetchImpl ?? fetch;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetchFn(input.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-iiohr-sync-secret": secret,
      },
      body: JSON.stringify(input.body),
      signal: ctrl.signal,
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes(secret)) {
      throw new Error("Staff sync request failed (network).");
    }
    throw new Error(`Staff sync request failed: ${msg}`);
  } finally {
    clearTimeout(timer);
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { httpStatus: res.status, json };
}

export function scrubSecretFromMessage(message: string, secret: string): string {
  if (!secret || !message.includes(secret)) return message;
  return message.split(secret).join("[redacted]");
}
