/**
 * Supabase client helpers for Follicle Intelligence.
 * - createBrowserClient: client-side (anon key, cookie-backed via @supabase/ssr)
 * - createRecoveryBrowserClient: one-off client for password recovery bootstrap
 * - supabaseAdmin: server-only (lib/supabaseAdmin.ts)
 */
import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

function requireSupabaseEnv(): { url: string; anon: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing Supabase env vars (NEXT_PUBLIC_*)");
  return { url, anon };
}

export function createBrowserClient(): SupabaseClient {
  const { url, anon } = requireSupabaseEnv();
  return createSupabaseBrowserClient(url, anon);
}

/**
 * Non-singleton client that skips URL auto-detection so recovery hash tokens
 * are not consumed before explicit setSession().
 */
export function createRecoveryBrowserClient(): SupabaseClient {
  const { url, anon } = requireSupabaseEnv();
  return createSupabaseBrowserClient(url, anon, {
    isSingleton: false,
    auth: {
      detectSessionInUrl: false,
    },
  });
}
