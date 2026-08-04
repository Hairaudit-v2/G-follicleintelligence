"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions, type SetAllCookies } from "@supabase/ssr";

import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { resolveFiOsPublicOrigin } from "@/src/lib/fiOs/fiOsPublicOrigin.server";
import { resolveFiOsPostLoginRedirect } from "@/src/lib/fiOs/fiOsRedirect.server";
import { repairStaffTenantLinkOnAuthConfirm } from "@/src/lib/workforce/staffTenantLinkRepair.server";
import {
  buildFiOsPasswordResetRedirectUrl,
  redactAuthUrlForLog,
  safeInternalPath,
} from "@/src/lib/supabase/authLinkBootstrap";
import { emitAuditEventBackground } from "@/src/lib/systemAudit/emitAuditEvent.server";
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

  const cookieStore = await cookies();
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
    // Tenant-scoped table: only audit when a tenant can be inferred from next/errorReturn path.
    const pathHint = next ?? readNextPath(formData.get("errorReturn"));
    const tenantHint = pathHint?.match(/\/fi-admin\/([0-9a-f-]{36})/i)?.[1] ?? null;
    if (tenantHint) {
      emitAuditEventBackground({
        tenantId: tenantHint,
        action: "auth.login_failed",
        entityType: "session",
        summary: "Login failed",
        metadata: {
          email_domain: email.includes("@") ? email.split("@")[1] : null,
          code: error?.code ?? "no_user",
        },
        actorType: "system",
        actorUserId: null,
      });
    }
    logFiOsSignIn("redirect", {
      reason: "invalid_credentials",
      target: "/follicle-intelligence/login?error=invalid_credentials",
    });
    redirect(signInErrorRedirect(formData, "invalid_credentials"));
  }

  const dest = next ?? (await resolveFiOsPostLoginRedirect(data.user.id, next));
  const osIdentity = await loadFiOsIdentity(data.user.id);
  // Best-effort: resolve a tenant from post-login path for tenant-scoped audit.
  const tenantFromPath = dest.match(/\/fi-admin\/([0-9a-f-]{36})/i)?.[1] ?? null;
  if (tenantFromPath) {
    emitAuditEventBackground({
      tenantId: tenantFromPath,
      action: "auth.login",
      entityType: "session",
      entityId: null,
      summary: "Staff login success",
      metadata: { os_role: osIdentity?.osRole ?? null, dest },
      actorUserId: data.user.id,
      actorRole: osIdentity?.osRole ?? null,
      actorType: "staff",
    });
  }
  logFiOsSignIn("membership", {
    hasOsIdentity: Boolean(osIdentity),
    osRole: osIdentity?.osRole ?? null,
    target: dest,
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

  const origin = await resolveFiOsPublicOrigin();
  const redirectUrl = buildFiOsPasswordResetRedirectUrl(origin);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });

  if (error) {
    logFiOsSignIn("password_reset_error", { code: error.code ?? "unknown" });
    return { ok: false, error: "Could not start password recovery. Try again or contact support." };
  }

  logFiOsSignIn("password_reset_requested", {
    redirectPath: "/follicle-intelligence/update-password",
    redirectUrlRedacted: redactAuthUrlForLog(redirectUrl),
  });
  return { ok: true };
}

export async function fiOsSignOutAction(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    redirect("/follicle-intelligence/login");
  }

  const cookieStore = await cookies();
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

/** After Supabase invite/magic-link confirm, repair tenant-scoped fi_users/fi_staff linkage. */
export async function repairStaffTenantLinkOnAuthConfirmAction(input: {
  nextPath: string;
}): Promise<{ ok: true } | { ok: false }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return { ok: false };

  const cookieStore = await cookies();
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

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id || !data.user.email) return { ok: false };

  const nextPath = safeInternalPath(input.nextPath, "/fi-admin");
  try {
    await repairStaffTenantLinkOnAuthConfirm({
      authUserId: data.user.id,
      email: data.user.email,
      nextPath,
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
