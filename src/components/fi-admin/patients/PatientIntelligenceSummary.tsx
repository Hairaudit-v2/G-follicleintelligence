import Link from "next/link";
import { Brain, ScanLine, ClipboardList, Pill, Calendar, Users } from "lucide-react";

import type { PatientClinicalDetailsRow } from "@/src/lib/patients/clinicalDetailsServer";
import type { PatientConsultationListItem } from "@/src/lib/patients/patientConsultations";
import { formatClinicalScalesSummary } from "@/src/lib/patients/hairLossScales";
import type { PatientJourneyStatus } from "@/src/lib/fiAdmin/patientJourneyStatus";
import {
  pwsCardFull,
  pwsDivider,
  pwsLabel,
  pwsValue,
  pwsValueMuted,
  pwsEmpty,
  pwsCta,
  pwsCtaCyan,
  pwsMetricTile,
  pwsMetricLabel,
  pwsMetricValue,
} from "./patientWorkspaceStyles";

// ─── Journey status badge ─────────────────────────────────────────────────────

const TONE_CLASSES: Record<PatientJourneyStatus["tone"], string> = {
  neutral: "border-slate-700/40 bg-slate-800/60 text-slate-400",
  info: "border-indigo-500/25 bg-indigo-950/60 text-indigo-300",
  warning: "border-amber-500/25 bg-amber-950/60 text-amber-300",
  success: "border-emerald-500/25 bg-emerald-950/60 text-emerald-300",
};

function JourneyBadge({ status }: { status: PatientJourneyStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[status.tone]}`}
    >
      {status.label}
    </span>
  );
}

// ─── Clinical signal row ──────────────────────────────────────────────────────

function SignalRow({
  icon,
  label,
  value,
  empty,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  empty: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-slate-500">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className={pwsLabel}>{label}</p>
        {value ? (
          <p className={`mt-0.5 ${pwsValue}`}>{value}</p>
        ) : (
          <div>
            <p className={`mt-0.5 ${pwsEmpty}`}>{empty}</p>
            {hint && <p className="mt-0.5 text-[0.65rem] text-slate-600">{hint}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function PatientIntelligenceSummary({
  tenantId,
  patientId,
  journeyStatus,
  clinical,
  consultations,
  totalLeads,
  upcomingBookings,
  completedBookings,
  imageCount,
}: {
  tenantId: string;
  patientId: string;
  journeyStatus: PatientJourneyStatus;
  clinical: PatientClinicalDetailsRow | null;
  consultations: PatientConsultationListItem[];
  totalLeads: number;
  upcomingBookings: number;
  completedBookings: number;
  imageCount: number;
}) {
  const base = `/fi-admin/${tenantId}/patients/${patientId}`;

  const patternLine = clinical
    ? formatClinicalScalesSummary({
        norwood_scale: clinical.norwood_scale,
        ludwig_scale: clinical.ludwig_scale,
        hairline_pattern: clinical.hairline_pattern,
        primary_concern: clinical.primary_concern,
      })
    : null;

  const latestConsultation = consultations[0] ?? null;
  const completedConsultations = consultations.filter((c) => c.status === "completed" || c.status === "quoted" || c.status === "accepted" || c.status === "converted_to_case");

  const medicationsValue = clinical?.current_medications?.trim() || null;
  const treatmentInterestValue = clinical?.treatment_interest?.trim() || null;
  const hasDuration = Boolean(clinical?.hair_loss_duration?.trim());

  return (
    <section className={pwsCardFull}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
          <h2 className="text-sm font-semibold text-slate-100">Patient intelligence</h2>
        </div>
        <Link href={`${base}/twin`} className={pwsCtaCyan}>
          Open Twin
        </Link>
      </div>

      {/* Journey status */}
      <div className={`mt-3 flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.03] p-3`}>
        <div className="min-w-0 flex-1">
          <p className={pwsLabel}>Patient journey</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <JourneyBadge status={journeyStatus} />
          </div>
          <p className={`mt-1.5 text-xs ${pwsValueMuted}`}>{journeyStatus.description}</p>
        </div>
      </div>

      {/* Hair loss classification */}
      <div className={`mt-4 space-y-3 ${pwsDivider} pt-4`}>
        <SignalRow
          icon={<ClipboardList className="h-3.5 w-3.5" aria-hidden />}
          label="Hair loss classification"
          value={patternLine}
          empty="Classification not documented yet."
          hint="Complete during consultation."
        />

        {hasDuration && (
          <SignalRow
            icon={<Calendar className="h-3.5 w-3.5" aria-hidden />}
            label="Duration"
            value={clinical?.hair_loss_duration ?? null}
            empty="Duration not recorded."
          />
        )}

        <SignalRow
          icon={<ClipboardList className="h-3.5 w-3.5" aria-hidden />}
          label="Treatment interest"
          value={treatmentInterestValue}
          empty="Not recorded."
        />

        <SignalRow
          icon={<Pill className="h-3.5 w-3.5" aria-hidden />}
          label="Current medications"
          value={medicationsValue}
          empty="Not recorded."
        />
      </div>

      {/* Consultation + imaging status */}
      <div className={`mt-4 space-y-3 ${pwsDivider} pt-4`}>
        <div>
          <p className={pwsLabel}>Consultations</p>
          {latestConsultation ? (
            <div className="mt-1 flex items-center gap-2">
              <Link
                href={`/fi-admin/${tenantId}/consultations/${latestConsultation.id}`}
                className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
              >
                {latestConsultation.consultation_type_label}
              </Link>
              <span className="text-xs text-slate-500">· {latestConsultation.status}</span>
              {completedConsultations.length > 0 && completedConsultations.length !== consultations.length && (
                <span className="text-xs text-slate-600">
                  · {completedConsultations.length} of {consultations.length} completed
                </span>
              )}
            </div>
          ) : (
            <div>
              <p className={`mt-0.5 ${pwsEmpty}`}>No consultations recorded.</p>
              <p className="mt-0.5 text-[0.65rem] text-slate-600">
                Use &ldquo;New consultation&rdquo; to document a clinical review.
              </p>
            </div>
          )}
        </div>

        <div>
          <p className={pwsLabel}>Imaging</p>
          {imageCount > 0 ? (
            <div className="mt-1 flex items-center gap-2">
              <Link
                href={`${base}/imaging`}
                className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
              >
                {imageCount} image{imageCount !== 1 ? "s" : ""} on file
              </Link>
            </div>
          ) : (
            <div>
              <p className={`mt-0.5 ${pwsEmpty}`}>No imaging protocol completed yet.</p>
              <p className="mt-0.5 text-[0.65rem] text-slate-600">
                Start ImagingOS to create a baseline.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Metric tiles */}
      <dl className={`mt-4 grid grid-cols-3 gap-2 ${pwsDivider} pt-4`}>
        <div className={pwsMetricTile}>
          <dt className={pwsMetricLabel}>Enquiries</dt>
          <dd className={`${pwsMetricValue} flex items-center gap-1`}>
            <Users className="h-3.5 w-3.5 text-slate-500" aria-hidden />
            {totalLeads}
          </dd>
        </div>
        <div className={pwsMetricTile}>
          <dt className={pwsMetricLabel}>Upcoming</dt>
          <dd className={`${pwsMetricValue} flex items-center gap-1`}>
            <Calendar className="h-3.5 w-3.5 text-slate-500" aria-hidden />
            {upcomingBookings}
          </dd>
        </div>
        <div className={pwsMetricTile}>
          <dt className={pwsMetricLabel}>Completed</dt>
          <dd className={pwsMetricValue}>{completedBookings}</dd>
        </div>
      </dl>

      {/* CTAs */}
      <div className={`mt-3 flex flex-wrap gap-2 ${pwsDivider} pt-3`}>
        <Link href={`${base}/twin`} className={`flex-1 text-center ${pwsCtaCyan}`}>
          <Brain className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          Patient Twin
        </Link>
        <Link href={`${base}/imaging`} className={`flex-1 text-center ${pwsCta}`}>
          <ScanLine className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          ImagingOS
        </Link>
        <Link
          href={`/fi-admin/${tenantId}/surgery-readiness`}
          className={`flex-1 text-center ${pwsCta}`}
        >
          Surgery readiness
        </Link>
      </div>
    </section>
  );
}
