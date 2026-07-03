import "server-only";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions, type SetAllCookies } from "@supabase/ssr";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolvePersonDisplayNameForToday } from "@/src/lib/fiOs/todayPersonLabels";

/**
 * Auth user email for FI OS chrome (profile menu). Mirrors cookie session used by CRM gate.
 */
export async function resolveFiOsAuthUserEmail(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return null;

  try {
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
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    const email = data.user?.email?.trim();
    return email && email.length > 0 ? email : null;
  } catch {
    return null;
  }
}

/** Display label for a Supabase Auth user (service role). Used for impersonation banner. */
export async function resolveFiOsAuthUserDisplayNameById(authUserId: string): Promise<string> {
  const id = authUserId.trim();
  if (!id) return "Unknown user";
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.auth.admin.getUserById(id);
    if (error || !data?.user) return id;
    const meta = data.user.user_metadata as Record<string, unknown> | undefined;
    const resolved = resolvePersonDisplayNameForToday({
      first_name: typeof meta?.first_name === "string" ? meta.first_name : undefined,
      firstName: typeof meta?.firstName === "string" ? meta.firstName : undefined,
      full_name: typeof meta?.full_name === "string" ? meta.full_name : undefined,
      fullName: typeof meta?.fullName === "string" ? meta.fullName : undefined,
      display_name: typeof meta?.display_name === "string" ? meta.display_name : undefined,
      displayName: typeof meta?.displayName === "string" ? meta.displayName : undefined,
      name: typeof meta?.name === "string" ? meta.name : undefined,
      email: data.user.email?.trim() || undefined,
    });
    if (resolved) return resolved;
    const email = data.user.email?.trim();
    if (email) return email;
    return id;
  } catch {
    return id;
  }
}
