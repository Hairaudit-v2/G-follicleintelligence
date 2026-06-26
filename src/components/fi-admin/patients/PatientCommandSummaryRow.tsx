import Link from "next/link";
import { Brain, CalendarDays, ClipboardList } from "lucide-react";

import type { PatientDetailNextAppointment } from "@/src/lib/patients/patientDetailLoader";
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import type { PatientJourneyStatus } from "@/src/lib/fiAdmin/patientJourneyStatus";
import {
  pwsCard,
  pwsCardPad,
  pwsLabel,
  pwsValue,
  pwsValueMuted,
  pwsCta,
  pwsCtaCyan,
} from "./patientWorkspaceStyles";

const JOURNEY_TONE_CLASSES: Record<PatientJourneyStatus["tone"], string> = {
  neutral: "border-slate-700/40 bg-slate-800/60 text-slate-400",
  info: "border-indigo-500/25 bg-indigo-950/60 text-indigo-300",
  warning: "border-amber-500/25 bg-amber-950/60 text-amber-300",
  success: "border-emerald-500/25 bg-emerald-950/60 text-emerald-300",
};

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
  ctaVariant = "neutral",
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  caption?: string;
  ctaLabel: string;
  ctaHref: string;
  ctaVariant?: "neutral" | "cyan";
}) {
  return (
    <div className={`flex flex-col justify-between gap-3 ${pwsCard} ${pwsCardPad}`}>
      <div className="space-y-1.5">
        <div className={`flex items-center gap-1.5 ${pwsLabel}`}>
          {icon}
          {title}
        </div>
        <p className={pwsValue}>{value}</p>
        {caption && <p className={pwsValueMuted}>{caption}</p>}
      </div>
      <Link
        href={ctaHref}
        className={`self-start ${ctaVariant === "cyan" ? pwsCtaCyan : pwsCta}`}
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
  journeyStatus,
}: {
  tenantId: string;
  patientId: string;
  nextAppointment: PatientDetailNextAppointment | null;
  treatmentPlanSummary: string | null;
  journeyStatus: PatientJourneyStatus;
}) {
  const base = `/fi-admin/${tenantId}/patients/${patientId}`;

  const apptValue = nextAppointment
    ? bookingTypeLabel(nextAppointment.bookingType)
    : "No appointment scheduled yet.";
  const apptCaption = nextAppointment ? fmtAppt(nextAppointment) : undefined;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard
        icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden />}
        title="Next appointment"
        value={apptValue}
        caption={apptCaption}
        ctaLabel="Book appointment"
        ctaHref={`${base}?tab=appointments`}
      />
      <SummaryCard
        icon={<ClipboardList className="h-3.5 w-3.5" aria-hidden />}
        title="Treatment plan"
        value={treatmentPlanSummary ?? "Not documented yet."}
        ctaLabel="View consultations"
        ctaHref={`${base}?tab=treatment_history`}
      />
      {/* Patient journey — replaces generic "Patient intelligence" card */}
      <div className={`flex flex-col justify-between gap-3 ${pwsCard} ${pwsCardPad}`}>
        <div className="space-y-2">
          <div className={`flex items-center gap-1.5 ${pwsLabel}`}>
            <Brain className="h-3.5 w-3.5 text-cyan-400" aria-hidden />
            Patient journey
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${JOURNEY_TONE_CLASSES[journeyStatus.tone]}`}
          >
            {journeyStatus.label}
          </span>
          <p className={pwsValueMuted}>{journeyStatus.description}</p>
        </div>
        <Link href={`${base}/twin`} className={`self-start ${pwsCtaCyan}`}>
          Open Patient Twin
        </Link>
      </div>
    </div>
  );
}
