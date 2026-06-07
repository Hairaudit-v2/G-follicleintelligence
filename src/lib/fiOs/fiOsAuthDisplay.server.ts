import "server-only";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions, type SetAllCookies } from "@supabase/ssr";

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
