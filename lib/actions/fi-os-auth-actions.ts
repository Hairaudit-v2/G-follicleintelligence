"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions, type SetAllCookies } from "@supabase/ssr";

import { loadFiOsIdentity, loadFirstTenantIdForAuthUser } from "@/src/lib/fiOs/fiOsIdentity.server";
import { resolveFiOsPublicOrigin } from "@/src/lib/fiOs/fiOsPublicOrigin.server";
import { resolveFiOsPostLoginRedirect } from "@/src/lib/fiOs/fiOsRedirect.server";
/** Temporary diagnostic logging — env presence only; never log secrets or tokens. */
function logFiOsSignIn(stage: string, details: Record<string, unknown>): void {
  console.info("[fi-os-auth]", stage, JSON.stringify(details));
}

function readNextPath(raw: FormDataEntryValue | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s.startsWith("/") || s.startsWith("//")) return null;
  return s;
}

function signInErrorRedirect(formData: FormData, error: string): string {
  const errorReturn = readNextPath(formData.get("errorReturn"));
  const base = errorReturn ?? "/follicle-intelligence/login";
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}error=${error}`;
}

export async function fiOsPasswordSignInAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const next = readNextPath(formData.get("next"));

  if (!email || !password) {
    redirect(signInErrorRedirect(formData, "missing_credentials"));
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  logFiOsSignIn("env_check", {
    hasSupabaseUrl: Boolean(url),
    hasAnonKey: Boolean(anon),
  });
  if (!url || !anon) {
    logFiOsSignIn("redirect", {
      reason: "server_misconfigured",
      target: "/follicle-intelligence/login?error=server_misconfigured",
    });
    redirect(signInErrorRedirect(formData, "server_misconfigured"));
  }

  const cookieStore = cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as CookieOptions);
          });
        } catch {
          /* ignore */
        }
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    logFiOsSignIn("auth_error", {
      code: error?.code ?? "no_user",
      message: error?.message ?? "signInWithPassword returned no user",
    });
    logFiOsSignIn("redirect", {
      reason: "invalid_credentials",
      target: "/follicle-intelligence/login?error=invalid_credentials",
    });
    redirect(signInErrorRedirect(formData, "invalid_credentials"));
  }

  const dest = next ?? (await resolveFiOsPostLoginRedirect(data.user.id));
  const [osIdentity, tenantId] = await Promise.all([
    loadFiOsIdentity(data.user.id),
    loadFirstTenantIdForAuthUser(data.user.id),
  ]);
  logFiOsSignIn("membership", {
    hasOsIdentity: Boolean(osIdentity),
    osRole: osIdentity?.osRole ?? null,
    hasTenantMembership: Boolean(tenantId),
    tenantIdPresent: Boolean(tenantId),
  });
  logFiOsSignIn("redirect", {
    reason: next ? "explicit_next" : "post_login_resolver",
    target: dest,
  });
  redirect(dest);
}

export async function fiOsRequestPasswordResetAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { ok: false, error: "Enter the email address for your OS account." };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    return { ok: false, error: "Server misconfigured." };
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const origin = (await resolveFiOsPublicOrigin()).replace(/\/+$/, "");
  const redirectUrl = `${origin}/follicle-intelligence/update-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });

  if (error) {
    logFiOsSignIn("password_reset_error", { code: error.code ?? "unknown" });
    return { ok: false, error: "Could not start password recovery. Try again or contact support." };
  }

  logFiOsSignIn("password_reset_requested", { redirectHost: new URL(redirectUrl).host });
  return { ok: true };
}

export async function fiOsSignOutAction(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    redirect("/follicle-intelligence/login");
  }

  const cookieStore = cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as CookieOptions);
          });
        } catch {
          /* ignore */
        }
      },
    },
  });

  await supabase.auth.signOut();
  redirect("/follicle-intelligence/login");
}
