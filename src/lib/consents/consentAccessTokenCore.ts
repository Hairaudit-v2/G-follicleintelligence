/**
 * Pure helpers for consent e-sign access tokens (no I/O).
 */

import { createHash, randomBytes } from "node:crypto";

import type { ConsentChannel, ConsentFormKey, ConsentInstanceStatus } from "./consentTypes";

/** Default link validity (days). */
export const CONSENT_ACCESS_TOKEN_EXPIRY_DAYS = 7;

export const CONSENT_TOKEN_ERRORS = {
  NOT_FOUND: "This consent link is not valid. Ask the clinic for a new link.",
  EXPIRED: "This consent link has expired. Ask the clinic for a new link.",
  ALREADY_SIGNED: "This consent has already been signed. Thank you.",
  NOT_OUTSTANDING: "This consent is no longer available to sign.",
  INVALID_NAME: "Enter your full legal name to sign.",
  AGREEMENT_REQUIRED: "Please confirm you have read and agree before signing.",
  GENERIC: "We could not record this consent. Try again or contact the clinic.",
} as const;

export type ConsentTokenResolveOutcome =
  | "valid"
  | "not_found"
  | "expired"
  | "already_signed"
  | "not_outstanding";

export function generateConsentAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashConsentAccessToken(rawToken: string): string {
  return createHash("sha256").update(rawToken.trim(), "utf8").digest("hex");
}

export function consentAccessTokenExpiresAt(
  from: Date = new Date(),
  days: number = CONSENT_ACCESS_TOKEN_EXPIRY_DAYS
): Date {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + Math.max(1, Math.floor(days)));
  return d;
}

/** Public patient e-sign path (no staff session). */
export function buildConsentAccessPath(
  rawToken: string,
  opts?: { clinicDevice?: boolean }
): string {
  const token = rawToken.trim();
  const path = `/consent/${encodeURIComponent(token)}`;
  if (opts?.clinicDevice) return `${path}?device=clinic`;
  return path;
}

export function channelFromDeviceFlag(clinicDevice: boolean): ConsentChannel {
  return clinicDevice ? "fi_clinic_device" : "fi_patient_link";
}

/**
 * Classify whether a resolved token row + instance may be signed.
 * Prefer: valid until instance signed or expires_at (used_at set on sign).
 */
export function classifyConsentTokenAccess(input: {
  tokenFound: boolean;
  expiresAt: string | Date | null;
  instanceStatus: ConsentInstanceStatus | string | null | undefined;
  nowMs?: number;
}): ConsentTokenResolveOutcome {
  if (!input.tokenFound) return "not_found";
  const now = input.nowMs ?? Date.now();
  const exp =
    input.expiresAt instanceof Date
      ? input.expiresAt.getTime()
      : input.expiresAt
        ? Date.parse(String(input.expiresAt))
        : NaN;
  if (!Number.isFinite(exp) || exp <= now) return "expired";

  const status = String(input.instanceStatus ?? "").trim().toLowerCase();
  if (status === "signed") return "already_signed";
  if (status !== "outstanding") return "not_outstanding";
  return "valid";
}

export function patientSafeMessageForTokenOutcome(
  outcome: ConsentTokenResolveOutcome
): string {
  switch (outcome) {
    case "expired":
      return CONSENT_TOKEN_ERRORS.EXPIRED;
    case "already_signed":
      return CONSENT_TOKEN_ERRORS.ALREADY_SIGNED;
    case "not_outstanding":
      return CONSENT_TOKEN_ERRORS.NOT_OUTSTANDING;
    case "not_found":
    default:
      return CONSENT_TOKEN_ERRORS.NOT_FOUND;
  }
}

export function isDraftConsentBody(bodyMd: string): boolean {
  return bodyMd.includes("DRAFT — not legal-final") || bodyMd.includes("DRAFT - not legal-final");
}

export function validateConsentSignInput(input: {
  signedName: string;
  agreed: boolean;
}): { ok: true; signedName: string } | { ok: false; error: string } {
  const signedName = input.signedName.trim().replace(/\s+/g, " ");
  if (signedName.length < 2 || signedName.length > 200) {
    return { ok: false, error: CONSENT_TOKEN_ERRORS.INVALID_NAME };
  }
  if (!input.agreed) {
    return { ok: false, error: CONSENT_TOKEN_ERRORS.AGREEMENT_REQUIRED };
  }
  return { ok: true, signedName };
}

/** Surgery readiness: surgery_procedure must be signed when required. */
export function surgeryConsentKeysSatisfied(input: {
  required: ConsentFormKey[];
  signed: ConsentFormKey[];
}): boolean {
  const signedSet = new Set(input.signed);
  if (!input.required.includes("surgery_procedure")) {
    // No surgery form required — treat framework surgery consent as N/A (not a positive signal alone).
    return false;
  }
  return signedSet.has("surgery_procedure");
}

/**
 * Minimal safe markdown → HTML for consent body (no raw HTML passthrough).
 * Supports paragraphs, **bold**, lists, headings (#).
 */
export function renderConsentBodyMarkdownSafe(md: string): string {
  const escaped = escapeHtml(md.replace(/\r\n/g, "\n"));
  const lines = escaped.split("\n");
  const blocks: string[] = [];
  let listBuf: string[] = [];
  let paraBuf: string[] = [];

  const flushPara = () => {
    if (paraBuf.length === 0) return;
    const text = applyInline(paraBuf.join(" ").trim());
    if (text) blocks.push(`<p class="mb-3 leading-relaxed">${text}</p>`);
    paraBuf = [];
  };
  const flushList = () => {
    if (listBuf.length === 0) return;
    blocks.push(
      `<ul class="mb-3 list-disc space-y-1 pl-5">${listBuf
        .map((li) => `<li>${applyInline(li)}</li>`)
        .join("")}</ul>`
    );
    listBuf = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      flushPara();
      continue;
    }
    const listMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    if (listMatch) {
      flushPara();
      listBuf.push(listMatch[1] ?? "");
      continue;
    }
    flushList();
    const h2 = /^##\s+(.+)$/.exec(trimmed);
    if (h2) {
      flushPara();
      blocks.push(`<h2 class="mb-2 mt-4 text-base font-semibold">${applyInline(h2[1] ?? "")}</h2>`);
      continue;
    }
    const h1 = /^#\s+(.+)$/.exec(trimmed);
    if (h1) {
      flushPara();
      blocks.push(`<h1 class="mb-2 mt-4 text-lg font-semibold">${applyInline(h1[1] ?? "")}</h1>`);
      continue;
    }
    paraBuf.push(trimmed);
  }
  flushList();
  flushPara();
  return blocks.join("\n") || `<p class="mb-3 leading-relaxed">${applyInline(escaped)}</p>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyInline(s: string): string {
  // **bold** after escape — only asterisks remain as markup
  return s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
