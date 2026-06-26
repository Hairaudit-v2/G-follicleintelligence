import Link from "next/link";
import { Brain, CalendarDays, ClipboardList } from "lucide-react";

import type { PatientDetailNextAppointment } from "@/src/lib/patients/patientDetailLoader";
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";

function fmtAppt(appt: PatientDetailNextAppointment): string {
  try {
    return new Date(appt.startAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return appt.startAt;
  }
}

function SummaryCard({
  icon,
  title,
  value,
  caption,
  ctaLabel,
  ctaHref,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  caption?: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {icon}
          {title}
        </div>
        <p className="text-sm font-medium text-gray-900">{value}</p>
        {caption && <p className="text-xs text-gray-500">{caption}</p>}
      </div>
      <Link
        href={ctaHref}
        className="self-start rounded border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

export function PatientCommandSummaryRow({
  tenantId,
  patientId,
  nextAppointment,
  treatmentPlanSummary,
}: {
  tenantId: string;
  patientId: string;
  nextAppointment: PatientDetailNextAppointment | null;
  treatmentPlanSummary: string | null;
}) {
  const base = `/fi-admin/${tenantId}/patients/${patientId}`;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard
        icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden />}
        title="Next appointment"
        value={nextAppointment ? bookingTypeLabel(nextAppointment.bookingType) : "No appointment scheduled"}
        caption={nextAppointment ? fmtAppt(nextAppointment) : undefined}
        ctaLabel="Book appointment"
        ctaHref={`${base}?tab=appointments`}
      />
      <SummaryCard
        icon={<ClipboardList className="h-3.5 w-3.5" aria-hidden />}
        title="Treatment plan"
        value={treatmentPlanSummary ?? "Not documented yet"}
        ctaLabel="View treatment history"
        ctaHref={`${base}?tab=treatment_history`}
      />
      <SummaryCard
        icon={<Brain className="h-3.5 w-3.5" aria-hidden />}
        title="Patient intelligence"
        value="Patient Twin"
        caption="Unified longitudinal patient record"
        ctaLabel="Open Patient Twin"
        ctaHref={`${base}/twin`}
      />
    </div>
  );
}
