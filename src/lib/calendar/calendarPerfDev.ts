/**
 * Dev-only calendar performance logging.
 * Server: logs loader timings (no client bundle).
 * Client: enable verbose logs with `NEXT_PUBLIC_FI_CALENDAR_PERF=1` to avoid console noise on every navigation.
 */

const clientVerbose =
  typeof process !== "undefined" &&
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_FI_CALENDAR_PERF === "1";

export function logOperationalCalendarServerTiming(payload: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "development") return;
  // eslint-disable-next-line no-console -- intentional dev instrumentation
  console.info("[fi-calendar/server]", payload);
}

export function logCalendarClientPerf(scope: string, payload: Record<string, unknown>): void {
  if (!clientVerbose) return;
  // eslint-disable-next-line no-console -- intentional dev instrumentation
  console.info(`[fi-calendar/client:${scope}]`, payload);
}
