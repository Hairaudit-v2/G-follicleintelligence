/**
 * ImagingOS Phase 7D — signed share tokens for approved patient visual summary PDFs.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { PatientVisualSummaryReportType } from "./patientVisualSummaryReportTypes";

export const PATIENT_VISUAL_SUMMARY_SHARE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type PatientVisualSummarySharePayload = {
  tenantId: string;
  caseId: string;
  patientId: string;
  reportType: PatientVisualSummaryReportType;
  nonce: string;
  exp: number;
};

export function resolvePatientVisualSummaryShareSecret(): string | null {
  const secret = (
    process.env.PATIENT_VISUAL_SUMMARY_SHARE_SECRET ??
    process.env.CRON_SECRET ??
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY ??
    ""
  ).trim();
  return secret || null;
}

export function signPatientVisualSummaryShareToken(
  payload: Omit<PatientVisualSummarySharePayload, "nonce" | "exp">,
  secret: string,
  opts?: { nonce?: string; exp?: number }
): string {
  const full: PatientVisualSummarySharePayload = {
    tenantId: payload.tenantId.trim(),
    caseId: payload.caseId.trim(),
    patientId: payload.patientId.trim(),
    reportType: payload.reportType,
    nonce: opts?.nonce ?? randomBytes(12).toString("hex"),
    exp: opts?.exp ?? Date.now() + PATIENT_VISUAL_SUMMARY_SHARE_TOKEN_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(full), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payloadB64, "utf8").digest("base64url");
  return `${payloadB64}.${signature}`;
}

export function verifyPatientVisualSummaryShareToken(
  token: string,
  secret: string
): PatientVisualSummarySharePayload | null {
  const trimmed = token.trim();
  const dotIdx = trimmed.lastIndexOf(".");
  if (dotIdx <= 0) return null;

  const payloadB64 = trimmed.slice(0, dotIdx);
  const providedSig = trimmed.slice(dotIdx + 1);
  const expectedSig = createHmac("sha256", secret).update(payloadB64, "utf8").digest("base64url");

  const a = Buffer.from(expectedSig);
  const b = Buffer.from(providedSig);
  if (a.length !== b.length || a.length === 0) return null;
  try {
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as PatientVisualSummarySharePayload;
    if (
      !parsed.tenantId?.trim() ||
      !parsed.caseId?.trim() ||
      !parsed.patientId?.trim() ||
      !parsed.reportType?.trim() ||
      !parsed.nonce?.trim() ||
      !parsed.exp
    ) {
      return null;
    }
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildPatientVisualSummarySharePath(input: {
  tenantId: string;
  token: string;
}): string {
  const params = new URLSearchParams({ token: input.token });
  return `/patient/${input.tenantId.trim()}/visual-summary/shared/pdf?${params}`;
}