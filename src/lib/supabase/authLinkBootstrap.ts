import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";

export type AuthLinkCredentials =
  | { kind: "tokens"; accessToken: string; refreshToken: string; authType: string | null }
  | { kind: "code"; code: string }
  | { kind: "otp"; tokenHash: string; type: EmailOtpType }
  | { kind: "none" };

export function readAuthLinkCredentialsFromUrl(): AuthLinkCredentials {
  if (typeof window === "undefined") return { kind: "none" };

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
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

  const search = new URLSearchParams(window.location.search);
  const code = search.get("code");
  if (code) return { kind: "code", code };

  const tokenHash = search.get("token_hash");
  const type = search.get("type");
  if (tokenHash && type) {
    return { kind: "otp", tokenHash, type: type as EmailOtpType };
  }

  return { kind: "none" };
}

export function stripAuthParamsFromUrlKeepSearch() {
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

export async function bootstrapSupabaseSessionFromAuthLink(
  supabase: SupabaseClient,
  credentials: AuthLinkCredentials
): Promise<boolean> {
  if (credentials.kind === "tokens") {
    const { error } = await supabase.auth.setSession({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
    });
    return !error;
  }

  if (credentials.kind === "code") {
    const { error } = await supabase.auth.exchangeCodeForSession(credentials.code);
    return !error;
  }

  if (credentials.kind === "otp") {
    const { error } = await supabase.auth.verifyOtp({
      type: credentials.type,
      token_hash: credentials.tokenHash,
    });
    return !error;
  }

  return false;
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
