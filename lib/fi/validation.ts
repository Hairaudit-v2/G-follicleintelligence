/**
 * Server-authoritative validation for Follicle Intelligence.
 * All validation runs on the server; client checks are for UX only.
 */

export type CaseRequirements = {
  full_name: string;
  email: string;
  dob: string;
  sex: string;
  primary_concern?: string;
  country?: string;
};

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function validateCaseCreate(input: unknown): ValidationResult<CaseRequirements> {
  const o = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const full_name = String(o.full_name ?? "").trim();
  const email = String(o.email ?? "").trim();
  const dob = String(o.dob ?? "").trim();
  const sex = String(o.sex ?? "").trim();
  const primary_concern = String(o.primary_concern ?? "").trim();
  const country = String(o.country ?? "").trim();

  if (!full_name) return { ok: false, error: "full_name is required." };
  if (!email) return { ok: false, error: "email is required." };
  if (!dob) return { ok: false, error: "dob is required." };
  if (!sex) return { ok: false, error: "sex is required." };

  return {
    ok: true,
    data: {
      full_name,
      email,
      dob,
      sex,
      primary_concern: primary_concern || undefined,
      country: country || undefined,
    },
  };
}

import type { FiUploadType } from "./uploadTypes";
import { FI_UPLOAD_LIMITS } from "./uploadTypes";

export function validateUploadFileByType(
  file: { name: string; type: string; size: number },
  uploadType: FiUploadType
): ValidationResult<{ maxBytes: number }> {
  const limits = FI_UPLOAD_LIMITS[uploadType];
  const allowed =
    limits.mimeTypes.length === 0 ||
    limits.mimeTypes.some(
      (m) =>
        file.type === m ||
        (m === "text/plain" && file.name.toLowerCase().endsWith(".csv")) ||
        (m === "application/pdf" && file.name.toLowerCase().endsWith(".pdf"))
    );
  if (!allowed)
    return {
      ok: false,
      error: `File "${file.name}" has disallowed MIME type for ${uploadType}.`,
    };
  if (file.size > limits.maxBytes)
    return {
      ok: false,
      error: `File "${file.name}" exceeds ${Math.round(limits.maxBytes / 1024 / 1024)} MB limit.`,
    };
  return { ok: true, data: { maxBytes: limits.maxBytes } };
}
