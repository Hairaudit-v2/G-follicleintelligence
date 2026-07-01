"use client";

import { useRouter } from "next/navigation";

import { SurgeryBookingWizard } from "./SurgeryBookingWizard";
import type { SurgeryBookingWizardPrefill } from "@/src/lib/surgeryBooking/surgeryBookingTypes";

export function SurgeryBookingWizardClient({
  tenantId,
  prefill,
  cancelHref,
}: {
  tenantId: string;
  prefill: SurgeryBookingWizardPrefill;
  cancelHref: string;
}) {
  const router = useRouter();
  return (
    <SurgeryBookingWizard
      tenantId={tenantId}
      prefill={prefill}
      onClose={() => router.push(cancelHref)}
    />
  );
}