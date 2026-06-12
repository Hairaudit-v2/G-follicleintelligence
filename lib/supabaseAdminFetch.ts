/**
 * Retrying fetch for Supabase-js when Node reports `TypeError: fetch failed`
 * (common on Windows with flaky IPv6 / TLS / transient network).
 *
 * Used by `lib/supabaseAdmin.ts` only (Node / server contexts).
 */
function describeUnderlyingFetchError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const bits: string[] = [err.name, err.message].filter(Boolean);
  const c = (err as Error & { cause?: unknown }).cause;
  if (c instanceof Error) {
    bits.push(`cause: ${c.message}`);
    const code = (c as NodeJS.ErrnoException).code;
    const errno = (c as NodeJS.ErrnoException).errno;
    if (code) bits.push(`errno_code: ${code}`);
    if (typeof errno === "number") bits.push(`errno: ${errno}`);
  } else if (typeof AggregateError !== "undefined" && c instanceof AggregateError) {
    for (const sub of c.errors) {
      if (sub instanceof Error) bits.push(`cause: ${sub.message}`);
    }
  } else if (c != null && typeof c === "object") {
    bits.push(`cause: ${JSON.stringify(c)}`);
  }
  return bits.join(" | ");
}

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
  const detail = describeUnderlyingFetchError(last);
  throw new Error(`Supabase fetch failed after 6 attempts (${detail}). Check NEXT_PUBLIC_SUPABASE_URL, network/VPN/firewall, and that the Supabase project is not paused.`, {
    cause: last,
  });
}
