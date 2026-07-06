import type { AuthError, EmailOtpType, SupabaseClient } from "@supabase/supabase-js";

export const FI_OS_UPDATE_PASSWORD_PATH = "/follicle-intelligence/update-password";

/** Supabase Dashboard → Authentication → URL configuration redirect allowlist. */
export const FI_OS_PASSWORD_RESET_REDIRECT_ALLOWLIST = [
  "https://follicleintelligence.ai/follicle-intelligence/update-password",
  "https://www.follicleintelligence.ai/follicle-intelligence/update-password",
  "http://localhost:3000/follicle-intelligence/update-password",
] as const;

export type AuthLinkCredentials =
  | { kind: "tokens"; accessToken: string; refreshToken: string; authType: string | null }
  | { kind: "code"; code: string }
  | { kind: "otp"; tokenHash: string; type: EmailOtpType }
  | { kind: "none" };

export type AuthBootstrapFailureReason =
  | "expired"
  | "missing_token"
  | "invalid_session"
  | "already_used"
  | "unsupported_type";

export type AuthBootstrapResult = { ok: true } | { ok: false; reason: AuthBootstrapFailureReason };

const AUTH_HASH_PARAM_NAMES = [
  "access_token",
  "refresh_token",
  "expires_at",
  "expires_in",
  "token_type",
  "type",
] as const;

export function buildFiOsPasswordResetRedirectUrl(origin: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${FI_OS_UPDATE_PASSWORD_PATH}`;
}

export function parseAuthLinkCredentialsFromParts(
  hashRaw: string,
  searchRaw: string
): AuthLinkCredentials {
  const hash = new URLSearchParams(hashRaw.replace(/^#/, ""));
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) {
    return {
      kind: "tokens",
      accessToken,
      refreshToken,
      authType: hash.get("type"),
    };
  }

  const search = new URLSearchParams(searchRaw.replace(/^\?/, ""));
  const code = search.get("code");
  if (code) return { kind: "code", code };

  const tokenHash = search.get("token_hash");
  const type = search.get("type");
  if (tokenHash && type) {
    return { kind: "otp", tokenHash, type: type as EmailOtpType };
  }

  return { kind: "none" };
}

export function readAuthLinkCredentialsFromUrl(): AuthLinkCredentials {
  if (typeof window === "undefined") return { kind: "none" };
  return parseAuthLinkCredentialsFromParts(window.location.hash, window.location.search);
}

export function isRecoveryAuthLink(credentials: AuthLinkCredentials): boolean {
  if (credentials.kind === "tokens") {
    return credentials.authType === "recovery";
  }
  if (credentials.kind === "otp") {
    return credentials.type === "recovery";
  }
  return false;
}

export function isRecoveryHashFragment(hashRaw: string): boolean {
  const hash = hashRaw.replace(/^#/, "");
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  if (params.get("type") === "recovery") return true;
  return Boolean(params.get("access_token") && params.get("refresh_token"));
}

export function shouldRedirectAuthHashToUpdatePassword(
  credentials: AuthLinkCredentials,
  pathname: string
): boolean {
  if (credentials.kind === "none") return false;
  if (pathname !== "/") return false;
  if (credentials.kind === "tokens") {
    return credentials.authType === "recovery" || credentials.authType === null;
  }
  if (credentials.kind === "otp") {
    return credentials.type === "recovery";
  }
  return credentials.kind === "code";
}

export function buildFiOsUpdatePasswordRecoveryUrl(hashRaw: string, searchRaw: string): string {
  const search = searchRaw.startsWith("?") || searchRaw === "" ? searchRaw : `?${searchRaw}`;
  const hash = hashRaw.startsWith("#") || hashRaw === "" ? hashRaw : `#${hashRaw}`;
  return `${FI_OS_UPDATE_PASSWORD_PATH}${search}${hash}`;
}

export function isAuthHashExpired(hashRaw: string, nowMs = Date.now()): boolean {
  const params = new URLSearchParams(hashRaw.replace(/^#/, ""));
  const expiresAt = params.get("expires_at");
  if (!expiresAt) return false;
  const epoch = Number(expiresAt);
  if (!Number.isFinite(epoch)) return false;
  return epoch * 1000 <= nowMs;
}

/** Redact URL fragments and sensitive query params before logging. */
export function redactAuthUrlForLog(url: string): string {
  try {
    const parsed = new URL(url, "http://localhost");
    for (const key of [...parsed.searchParams.keys()]) {
      if (key === "code" || key === "token_hash" || key === "access_token" || key === "refresh_token") {
        parsed.searchParams.set(key, "[REDACTED]");
      }
    }
    const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    for (const name of AUTH_HASH_PARAM_NAMES) {
      if (hashParams.has(name)) hashParams.set(name, "[REDACTED]");
    }
    const redactedHash = hashParams.toString();
    parsed.hash = redactedHash ? `#${redactedHash}` : "";
    if (parsed.origin === "http://localhost") {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return `${parsed.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "[invalid-url]";
  }
}

export function mapAuthBootstrapError(error: AuthError | null): AuthBootstrapFailureReason {
  const code = (error?.code ?? "").toLowerCase();
  const message = (error?.message ?? "").toLowerCase();
  if (code.includes("expired") || message.includes("expired")) return "expired";
  if (code.includes("already") || message.includes("already been used")) return "already_used";
  if (code.includes("invalid") || message.includes("invalid")) return "invalid_session";
  return "invalid_session";
}

export function authBootstrapFailureMessage(reason: AuthBootstrapFailureReason): string {
  switch (reason) {
    case "expired":
      return "This reset link has expired. Request a new one from the forgot password page.";
    case "missing_token":
      return "This reset link is missing required information. Request a new link from the forgot password page.";
    case "already_used":
      return "This reset link has already been used. Request a new one if you still need to change your password.";
    case "unsupported_type":
      return "This link is not a password reset link. Use the forgot password page to request a new reset email.";
    case "invalid_session":
    default:
      return "This reset link is invalid or could not be verified. Request a new one from the forgot password page.";
  }
}

export function stripAuthParamsFromUrlKeepSearch() {
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

export async function bootstrapSupabaseSessionFromAuthLink(
  supabase: SupabaseClient,
  credentials: AuthLinkCredentials
): Promise<AuthBootstrapResult> {
  if (credentials.kind === "tokens") {
    const { error } = await supabase.auth.setSession({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
    });
    if (error) return { ok: false, reason: mapAuthBootstrapError(error) };
    return { ok: true };
  }

  if (credentials.kind === "code") {
    const { error } = await supabase.auth.exchangeCodeForSession(credentials.code);
    if (error) return { ok: false, reason: mapAuthBootstrapError(error) };
    return { ok: true };
  }

  if (credentials.kind === "otp") {
    const { error } = await supabase.auth.verifyOtp({
      type: credentials.type,
      token_hash: credentials.tokenHash,
    });
    if (error) return { ok: false, reason: mapAuthBootstrapError(error) };
    return { ok: true };
  }

  return { ok: false, reason: "missing_token" };
}

export function safeInternalPath(raw: string | null | undefined, fallback: string): string {
  const next = (raw ?? fallback).trim();
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

export function buildFiOsAuthConfirmUrl(origin: string, nextPath: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/follicle-intelligence/auth/confirm?next=${encodeURIComponent(nextPath)}`;
}

/** Invite and signup links should set a password before entering the OS workspace. */
export function resolvePostAuthLinkDestination(next: string, authType: string | null): string {
  if (authType === "invite" || authType === "signup") {
    return `/follicle-intelligence/update-password?next=${encodeURIComponent(next)}`;
  }
  return next;
}

export function readAuthTypeFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type");
}
