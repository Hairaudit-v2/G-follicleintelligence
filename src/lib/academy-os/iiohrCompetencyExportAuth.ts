import {
  CRON_OR_WEBHOOK_SECRET_MIN_LENGTH,
  timingSafeUtf8Equal,
} from "@/src/lib/security/timingSafeSecret";

export const IIOHR_COMPETENCY_EXPORT_HDR_SECRET = "x-iiohr-competency-export-secret";

export function isIiohrCompetencyExportEnabled(): boolean {
  const flag = process.env.IIOHR_FI_COMPETENCY_EXPORT_ENABLED?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

export type IiohrCompetencyExportAuthResult =
  | { ok: true }
  | { ok: false; httpStatus: number; error: string };

/**
 * Validates inbound IIOHR competency export webhook authentication.
 * Requires `IIOHR_FI_COMPETENCY_EXPORT_ENABLED=true` and a configured shared secret.
 */
export function evaluateIiohrCompetencyExportAuth(
  request: Request
): IiohrCompetencyExportAuthResult {
  if (!isIiohrCompetencyExportEnabled()) {
    return { ok: false, httpStatus: 503, error: "Service unavailable." };
  }

  const configured = process.env.IIOHR_FI_COMPETENCY_EXPORT_SECRET?.trim();
  if (!configured || configured.length < CRON_OR_WEBHOOK_SECRET_MIN_LENGTH) {
    return { ok: false, httpStatus: 503, error: "Service unavailable." };
  }

  const provided = request.headers.get(IIOHR_COMPETENCY_EXPORT_HDR_SECRET)?.trim() ?? "";
  if (!provided || !timingSafeUtf8Equal(configured, provided)) {
    return { ok: false, httpStatus: 401, error: "Unauthorized." };
  }

  return { ok: true };
}
