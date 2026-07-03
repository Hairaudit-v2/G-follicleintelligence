"use client";

import { useEffect, useState } from "react";

import { loadBookingFollowUpContextAction } from "@/lib/actions/fi-follow-up-encounter-actions";
import type { BookingContinuityStatus } from "@/src/lib/followUpEncounters/bookingFollowUpContextCore";
import { BookingFollowUpActionLinks } from "./BookingFollowUpActionLinks";
import { BookingFollowUpContinuityBadge } from "./BookingFollowUpContinuityBadge";

export function BookingFollowUpCalendarPanel({
  tenantId,
  bookingId,
  patientId,
}: {
  tenantId: string;
  bookingId: string;
  patientId?: string | null;
}) {
  const [continuityStatus, setContinuityStatus] = useState<BookingContinuityStatus | null>(null);
  const [continuityLabel, setContinuityLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const r = await loadBookingFollowUpContextAction(tenantId, bookingId);
      if (cancelled) return;
      if (r.ok) {
        setContinuityStatus(r.context.continuityStatus);
        setContinuityLabel(r.context.continuityLabel);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, bookingId]);

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-white/[0.08] bg-[#0F1629]/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
          Continuity of care
        </p>
        {!loading && continuityStatus && continuityLabel ? (
          <BookingFollowUpContinuityBadge status={continuityStatus} label={continuityLabel} />
        ) : loading ? (
          <span className="text-[0.65rem] text-slate-500">Loading…</span>
        ) : null}
      </div>
      <BookingFollowUpActionLinks
        tenantId={tenantId}
        bookingId={bookingId}
        patientId={patientId}
        layout="grid"
      />
    </div>
  );
}
