"use client";

import Link from "next/link";
import { useEffect } from "react";

import { logClientError } from "@/src/lib/client/logClientError";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logClientError("app_root", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#020617] px-6 text-center text-slate-200">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/90">Follicle Intelligence</p>
      <h1 className="mt-4 text-2xl font-semibold text-white">Something went wrong</h1>
      <p className="mt-3 max-w-md text-sm text-slate-400">
        An unexpected error occurred. You can try again or return to the home page.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-slate-500">Reference: {error.digest}</p> : null}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/25"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}