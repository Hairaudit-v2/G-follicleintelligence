/**
 * Dev-only: warn when synchronous calendar work exceeds a threshold (INP / main-thread hygiene).
 * Never logs large payloads — timing and small counts only.
 */

const SLOW_MS = 50;

export function calendarInteractionPerfEnabled(): boolean {
  return typeof process !== "undefined" && process.env.NODE_ENV === "development";
}

/** Warn if synchronous work exceeded {@link SLOW_MS}. */
export function warnIfSlowCalendarSync(label: string, durationMs: number): void {
  if (!calendarInteractionPerfEnabled()) return;
  if (durationMs <= SLOW_MS) return;
  // eslint-disable-next-line no-console -- intentional dev instrumentation
  console.warn(`[fi-calendar/inp] slow sync: ${label} took ${durationMs.toFixed(1)}ms (>${SLOW_MS}ms)`);
}

/** Measure a synchronous block; warns when over threshold. */
export function measureCalendarSync<T>(label: string, fn: () => T): T {
  if (!calendarInteractionPerfEnabled()) return fn();
  const t0 = performance.now();
  try {
    return fn();
  } finally {
    warnIfSlowCalendarSync(label, performance.now() - t0);
  }
}
