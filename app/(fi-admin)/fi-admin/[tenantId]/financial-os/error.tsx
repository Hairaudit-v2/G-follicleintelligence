"use client";

import { FiAdminSegmentError } from "@/src/components/fi-admin/FiAdminSegmentError";

export default function FiAdminFinancialOsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <FiAdminSegmentError
      error={error}
      reset={reset}
      title="Could not load Financial OS"
      surface="fi_admin_financial_os"
    />
  );
}
