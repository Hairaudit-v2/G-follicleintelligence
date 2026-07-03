import Link from "next/link";
import { Camera, RotateCcw } from "lucide-react";

import { buildReturningPatientFlowHref } from "@/src/lib/followUpEncounters/followUpImagingRoutes";
import { cn } from "@/lib/utils";

const btn =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition";

export function BookingFollowUpActionLinks({
  tenantId,
  bookingId,
  patientId,
  layout = "grid",
  className,
}: {
  tenantId: string;
  bookingId: string;
  patientId?: string | null;
  layout?: "grid" | "row";
  className?: string;
}) {
  const followUpHref = buildReturningPatientFlowHref(tenantId, {
    bookingId,
    patientId: patientId ?? undefined,
    intent: "follow_up",
  });
  const legacyHref = buildReturningPatientFlowHref(tenantId, {
    bookingId,
    patientId: patientId ?? undefined,
    intent: "legacy",
  });
  const photosHref = buildReturningPatientFlowHref(tenantId, {
    bookingId,
    patientId: patientId ?? undefined,
    intent: "photos",
    encounterType: "photos_only",
  });

  const wrap =
    layout === "grid"
      ? "grid grid-cols-2 gap-2"
      : "flex flex-wrap gap-2";

  return (
    <div className={cn(wrap, className)}>
      <Link href={followUpHref} className={cn(btn, "bg-sky-700/90 text-white hover:bg-sky-600")}>
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        Start follow-up
      </Link>
      <Link href={legacyHref} className={cn(btn, "border border-sky-500/40 bg-sky-950/50 text-sky-200 hover:bg-sky-900/60")}>
        Returning Timely patient
      </Link>
      <Link
        href={photosHref}
        className={cn(btn, "border border-teal-500/30 bg-teal-950/40 text-teal-200 hover:bg-teal-900/50", layout === "grid" ? "col-span-2" : "")}
      >
        <Camera className="h-3.5 w-3.5" aria-hidden />
        Capture photos
      </Link>
      <Link
        href={followUpHref}
        className={cn(
          btn,
          "border border-white/[0.1] bg-white/[0.04] text-slate-300 hover:border-cyan-500/30",
          layout === "grid" ? "col-span-2" : ""
        )}
      >
        Continue care in FI OS
      </Link>
    </div>
  );
}
