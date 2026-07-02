import "server-only";

import { isAffirmative } from "@/src/lib/env/zod-helpers";

export type LoaderPerfSpan = {
  label: string;
  ms: number;
};

const spans: LoaderPerfSpan[] = [];

export function isLoaderPerfSpansEnabled(): boolean {
  return isAffirmative(process.env.FI_LOADER_PERF_SPANS);
}

/** Record a loader sub-span when FI_LOADER_PERF_SPANS=1 (dev/smoke profiling). */
export function recordLoaderPerfSpan(label: string, ms: number): void {
  if (!isLoaderPerfSpansEnabled()) return;
  spans.push({ label, ms: Math.round(ms) });
}

/** Run fn, record span, return result. */
export async function withLoaderPerfSpan<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    recordLoaderPerfSpan(label, performance.now() - t0);
  }
}

export function drainLoaderPerfSpans(): LoaderPerfSpan[] {
  const out = [...spans];
  spans.length = 0;
  return out;
}