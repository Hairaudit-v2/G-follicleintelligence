"use client";

import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import type { ReceptionOsDemoModeState } from "@/src/lib/receptionOs/receptionOsDemoModeModel";

export function ReceptionOsDemoBanner({ demoMode }: { demoMode: ReceptionOsDemoModeState }) {
  if (!demoMode.active) return null;

  const amountNote = demoMode.maskAmounts ? " Dollar amounts are masked." : "";
  const sampleNote = demoMode.usingSampleData
    ? " Showing sample records — no live clinic data."
    : "";

  return (
    <InfoNotice variant="info" title="Demo Mode">
      Patient names are anonymised and contact details are hidden for external demonstrations.
      {amountNote}
      {sampleNote} Live sends remain disabled by default.
    </InfoNotice>
  );
}
