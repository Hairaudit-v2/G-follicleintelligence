import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdminFetchWithRetry } from "./supabaseAdminFetch";

let _client: SupabaseClient | null = null;
let _ipv4FirstApplied = false;

function tryApplyIpv4FirstDns(): void {
  if (_ipv4FirstApplied) return;
  _ipv4FirstApplied = true;
  if (typeof process === "undefined" || !process.versions?.node) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- avoid static `node:dns` in Edge bundles that tree-shake poorly
    const { setDefaultResultOrder } = require("node:dns") as typeof import("node:dns");
    setDefaultResultOrder("ipv4first");
  } catch {
    /* Edge / restricted runtimes */
  }
}

export function supabaseAdmin(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY). For Next.js use .env.local at the repo root. For tsx scripts (e.g. provision), export them in the shell or rely on the script loading .env.local."
      );
    }
    tryApplyIpv4FirstDns();
    // Node < 22 has no global WebSocket; @supabase/realtime-js requires `ws` as transport for scripts/CLI.
    let wsTransport: typeof import("ws") | undefined;
    if (typeof window === "undefined" && typeof process !== "undefined" && process.versions?.node) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- keep Edge bundles from statically linking `ws`
        wsTransport = require("ws") as typeof import("ws");
      } catch {
        wsTransport = undefined;
      }
    }
    _client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: supabaseAdminFetchWithRetry },
      ...(wsTransport ? { realtime: { transport: wsTransport as never } } : {}),
    });
  }
  return _client;
}
