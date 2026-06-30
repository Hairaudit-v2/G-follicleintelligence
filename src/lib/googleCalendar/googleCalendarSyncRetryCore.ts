/**
 * CalendarOS GC-8 — Google Calendar API retry helpers (429 backoff, 500/503 single retry).
 */

export type GoogleCalendarApiRetryOptions = {
  max429Attempts?: number;
  baseBackoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_MAX_429_ATTEMPTS = 4;
const DEFAULT_BASE_BACKOFF_MS = 500;

export function isGoogleCalendarRateLimitStatus(status: number | undefined): boolean {
  return status === 429;
}

export function isGoogleCalendarTransientServerStatus(status: number | undefined): boolean {
  return status === 500 || status === 503;
}

export function computeExponentialBackoffMs(
  attempt: number,
  baseMs: number = DEFAULT_BASE_BACKOFF_MS
): number {
  return baseMs * 2 ** Math.max(0, attempt);
}

export async function sleepMs(ms: number, sleep?: (ms: number) => Promise<void>): Promise<void> {
  const delay =
    sleep ?? ((value: number) => new Promise<void>((resolve) => setTimeout(resolve, value)));
  await delay(ms);
}

export type GoogleCalendarFetchAttemptResult = {
  ok: boolean;
  status: number;
  text: string;
};

/**
 * Execute a fetch with retry policy:
 * - 429: exponential backoff up to max429Attempts
 * - 500/503: retry once
 */
export async function fetchGoogleCalendarWithRetry(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
  opts: GoogleCalendarApiRetryOptions = {}
): Promise<GoogleCalendarFetchAttemptResult> {
  const max429Attempts = opts.max429Attempts ?? DEFAULT_MAX_429_ATTEMPTS;
  const baseBackoffMs = opts.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;

  let attempt429 = 0;
  let retriedServerError = false;

  while (true) {
    const res = await fetchFn(url, init);
    const text = await res.text().catch(() => "");

    if (res.ok) {
      return { ok: true, status: res.status, text };
    }

    if (isGoogleCalendarRateLimitStatus(res.status) && attempt429 < max429Attempts - 1) {
      const backoff = computeExponentialBackoffMs(attempt429, baseBackoffMs);
      await sleepMs(backoff, opts.sleep);
      attempt429 += 1;
      continue;
    }

    if (isGoogleCalendarTransientServerStatus(res.status) && !retriedServerError) {
      retriedServerError = true;
      await sleepMs(baseBackoffMs, opts.sleep);
      continue;
    }

    return { ok: false, status: res.status, text };
  }
}

export function formatGoogleCalendarApiError(status: number, text: string): string {
  return `Google Calendar API error (${status}): ${text.slice(0, 300)}`;
}
