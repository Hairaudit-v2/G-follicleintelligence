"use client";

import { useEffect } from "react";

import { logClientError } from "@/src/lib/client/logClientError";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logClientError("app_global", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#020617] font-sans text-slate-200 antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/90">Follicle Intelligence</p>
          <h1 className="mt-4 text-2xl font-semibold text-white">Application error</h1>
          <p className="mt-3 max-w-md text-sm text-slate-400">
            A critical error prevented this page from loading. Try again or refresh the browser.
          </p>
          {error.digest ? <p className="mt-2 font-mono text-xs text-slate-500">Reference: {error.digest}</p> : null}
          <button
            type="button"
            onClick={() => reset()}
            className="mt-6 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}