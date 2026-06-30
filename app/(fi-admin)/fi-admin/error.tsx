"use client";

import Link from "next/link";

import { FiAdminSegmentError } from "@/src/components/fi-admin/FiAdminSegmentError";

export default function FiAdminShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <FiAdminSegmentError
        error={error}
        reset={reset}
        title="Could not load FI OS workspace"
        surface="fi_admin_shell"
      />
      <p className="mt-6 text-center text-sm text-slate-400">
        <Link href="/follicle-intelligence/login" className="text-cyan-400 hover:text-cyan-300 hover:underline">
          Return to sign in
        </Link>
      </p>
    </div>
  );
}