"use client";

import { FiAdminSegmentError } from "@/src/components/fi-admin/FiAdminSegmentError";

export default function FiAdminTenantError({
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
      title="Could not load this workspace"
      surface="fi_admin_tenant"
    />
  );
}
