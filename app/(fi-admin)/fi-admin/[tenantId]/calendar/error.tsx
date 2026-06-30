"use client";

import { FiAdminSegmentError } from "@/src/components/fi-admin/FiAdminSegmentError";

export default function FiAdminCalendarError({
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
      title="Could not load calendar"
      surface="fi_admin_calendar"
    />
  );
}
