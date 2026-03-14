/**
 * Supabase client helpers for Follicle Intelligence.
 * - createBrowserClient: client-side (anon key)
 * - supabaseAdmin: server-only (lib/supabaseAdmin.ts)
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _browserClient: SupabaseClient | null = null;

export function createBrowserClient(): SupabaseClient {
  if (!_browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) throw new Error("Missing Supabase env vars (NEXT_PUBLIC_*)");
    _browserClient = createClient(url, anon);
  }
  return _browserClient;
}
