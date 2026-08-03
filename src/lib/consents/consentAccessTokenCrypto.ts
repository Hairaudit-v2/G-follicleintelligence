/**
 * Node crypto helpers for consent access tokens.
 * Server/node only — do not import from client components (Webpack cannot resolve node:crypto).
 */

import { createHash, randomBytes } from "node:crypto";

export function generateConsentAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashConsentAccessToken(rawToken: string): string {
  return createHash("sha256").update(rawToken.trim(), "utf8").digest("hex");
}
