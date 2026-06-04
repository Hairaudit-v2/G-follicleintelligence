"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions, type SetAllCookies } from "@supabase/ssr";

import { resolveFiOsPostLoginRedirect } from "@/src/lib/fiOs/fiOsRedirect.server";

function getRequestOrigin(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim() || "http";
  if (host) return `${proto}://${host}`;
  const fallback = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return fallback && fallback.length > 0 ? fallback : "http://localhost:3000";
}

function readNextPath(raw: FormDataEntryValue | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s.startsWith("/") || s.startsWith("//")) return null;
  return s;
}

export async function fiOsPasswordSignInAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const next = readNextPath(formData.get("next"));

  if (!email || !password) {
    redirect("/follicle-intelligence/login?error=missing_credentials");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    redirect("/follicle-intelligence/login?error=server_misconfigured");
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
    redirect("/follicle-intelligence/login?error=invalid_credentials");
  }

  const dest = next ?? (await resolveFiOsPostLoginRedirect(data.user.id));
  redirect(dest);
}

export async function fiOsRequestPasswordResetAction(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { ok: false, error: "Enter the email address for your OS account." };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    return { ok: false, error: "Server misconfigured." };
  }

  const origin = getRequestOrigin();
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin.replace(/\/$/, "")}/follicle-intelligence/update-password`,
  });

  if (error) {
    return { ok: false, error: "Could not start password recovery. Try again or contact support." };
  }

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
