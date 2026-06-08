import {
  executeFiStaffSyncPost,
  scrubSecretFromMessage,
  type PushStaffSyncToFiInput,
  type PushStaffSyncToFiResult,
} from "@/src/lib/hr/iiohrFiStaffSyncClient";

function readFiBaseUrl(): string {
  const raw = process.env.FI_BASE_URL?.trim();
  if (!raw) {
    throw new Error("FI_BASE_URL is not configured; cannot push staff sync to Follicle Intelligence.");
  }
  return raw.replace(/\/+$/, "");
}

function readSyncSecret(): string {
  const s = process.env.IIOHR_HR_SYNC_SECRET?.trim();
  if (!s) {
    throw new Error("IIOHR_HR_SYNC_SECRET is not configured; cannot authenticate to FI staff sync.");
  }
  return s;
}

function staffSyncPath(tenantId: string): string {
  const tid = encodeURIComponent(tenantId.trim());
  return `/api/tenants/${tid}/integrations/iiohr-hr/staff-sync`;
}

/**
 * POSTs operational staff rows to the FI IIOHR HR staff-sync endpoint (same contract as inbound producer).
 * Never logs the shared secret. Throws on network/HTTP failure with messages that do not echo the secret.
 */
export async function pushStaffSyncToFi(input: PushStaffSyncToFiInput): Promise<PushStaffSyncToFiResult> {
  const base = readFiBaseUrl();
  const secret = readSyncSecret();
  const url = `${base}${staffSyncPath(input.tenantId)}`;

  const body: Record<string, unknown> = {
    mode: input.mode,
    rows: input.rows,
  };
  if (input.mode === "commit") {
    if (input.confirm !== true) {
      throw new Error("commit requires confirm: true when calling pushStaffSyncToFi.");
    }
    body.confirm = true;
  }

  const { httpStatus, json } = await executeFiStaffSyncPost({ url, secret, body });
  const runId = json.runId != null ? String(json.runId) : null;
  const ok = Boolean(json.ok);

  if (!httpStatus || httpStatus < 200 || httpStatus >= 300) {
    const errRaw =
      typeof json.error === "string" && json.error.trim()
        ? json.error.trim()
        : `FI staff sync returned ${httpStatus}`;
    throw new Error(scrubSecretFromMessage(errRaw, secret));
  }

  return {
    httpStatus,
    ok,
    runId,
    rowsSent: input.rows.length,
    raw: json,
  };
}
