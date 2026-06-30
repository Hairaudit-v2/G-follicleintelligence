"use client";

import { useEffect } from "react";

import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { logClientError } from "@/src/lib/client/logClientError";

const GENERIC_MESSAGE = "Something went wrong loading this page. Try again or contact support if it persists.";

export function FiAdminSegmentError({
  error,
  reset,
  title,
  surface,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title: string;
  surface: string;
}) {
  useEffect(() => {
    logClientError(surface, error);
  }, [error, surface]);

  const isProd = process.env.NODE_ENV === "production";
  const detail = isProd ? GENERIC_MESSAGE : error.message || GENERIC_MESSAGE;

  return (
    <InfoNotice variant="danger" title={title}>
      <p className="text-sm">{detail}</p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-slate-400">Reference: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-[#F8FAFC] transition hover:bg-white/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#22C1FF]/50"
      >
        Try again
      </button>
    </InfoNotice>
  );
}