"use client";

import { FiAdminSegmentError } from "@/src/components/fi-admin/FiAdminSegmentError";

export default function WorkforceOsRosterError({
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
      title="Roster Command Centre failed to render"
      surface="fi_admin_workforce_roster"
    />
  );
}
