import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import { formatClinicalScalesSummary } from "@/src/lib/patients/hairLossScales";

export function PatientProfileSummaryCards({ data }: { data: PatientProfileFoundationData }) {
  const s = data.summary;
  const last = s.lastActivityAt ? s.lastActivityAt.slice(0, 10) : "—";
  const clinical = data.clinicalDetails.row;
  const patternLine =
    clinical != null
      ? formatClinicalScalesSummary({
          norwood_scale: clinical.norwood_scale,
          ludwig_scale: clinical.ludwig_scale,
          hairline_pattern: clinical.hairline_pattern,
          primary_concern: clinical.primary_concern,
        })
      : null;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Linked leads" value={String(s.totalLeads)} />
        <SummaryCard label="Clinical patients" value={String(s.totalCases)} />
        <SummaryCard label="Upcoming bookings" value={String(s.upcomingBookings)} />
        <SummaryCard label="Completed bookings" value={String(s.completedBookings)} />
        <SummaryCard label="Last activity" value={last} />
      </div>
      {patternLine ? (
        <div className="rounded border border-indigo-200 bg-indigo-50/80 p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-800">Hair loss pattern</p>
          <p className="mt-1 text-sm font-semibold leading-snug text-indigo-950">{patternLine}</p>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-3 shadow-lg shadow-black/40">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{value}</p>
    </div>
  );
}
