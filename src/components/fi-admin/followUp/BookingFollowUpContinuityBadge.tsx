import type { BookingContinuityStatus } from "@/src/lib/followUpEncounters/bookingFollowUpContextCore";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<BookingContinuityStatus, string> = {
  no_fi_patient_linked: "border-amber-500/30 bg-amber-950/40 text-amber-200",
  legacy_timely_patient: "border-sky-500/30 bg-sky-950/40 text-sky-200",
  follow_up_started: "border-violet-500/30 bg-violet-950/40 text-violet-200",
  photos_captured: "border-teal-500/30 bg-teal-950/40 text-teal-200",
  ai_imaging_review_pending: "border-orange-500/30 bg-orange-950/40 text-orange-200",
  clinician_approved: "border-emerald-500/30 bg-emerald-950/40 text-emerald-200",
};

export function BookingFollowUpContinuityBadge({
  status,
  label,
  className,
}: {
  status: BookingContinuityStatus;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
        STATUS_STYLES[status],
        className
      )}
    >
      {label}
    </span>
  );
}
