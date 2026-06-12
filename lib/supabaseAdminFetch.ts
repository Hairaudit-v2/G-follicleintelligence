/**
 * Retrying fetch for Supabase-js when Node reports `TypeError: fetch failed`
 * (common on Windows with flaky IPv6 / TLS / transient network).
 *
 * Used by `lib/supabaseAdmin.ts` only (Node / server contexts).
 */
export async function supabaseAdminFetchWithRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let last: unknown;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      return await fetch(input, init);
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, Math.min(2500, 350 * attempt ** 2)));
    }
  }
  throw last;
}
