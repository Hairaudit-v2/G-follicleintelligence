"use client";

import { useEffect } from "react";

import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";

export default function FiAdminTenantHomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <InfoNotice variant="danger" title="Could not load dashboard">
      <p className="text-sm">{error.message || "Unexpected error"}</p>
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
