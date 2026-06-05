"use client";

import { useState } from "react";
import { Phone } from "lucide-react";

import { QuickCallInBookingModal } from "@/src/components/fi/appointments/QuickCallInBookingModal";
import { QUICK_CALL_IN_DEFAULT_TIMEZONE } from "@/src/lib/calendar/quickCallInConstants";

export function TenantHomeQuickCallIn(props: { tenantId: string }) {
  const { tenantId } = props;
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.12)] transition hover:border-emerald-300/60 hover:bg-emerald-500/25"
      >
        <Phone className="h-4 w-4 shrink-0" aria-hidden />
        New call-in booking
      </button>
      <QuickCallInBookingModal tenantId={tenantId} open={open} onClose={() => setOpen(false)} calendarTimezone={QUICK_CALL_IN_DEFAULT_TIMEZONE} />
    </>
  );
}
