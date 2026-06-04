import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";

export function PatientProfileSummaryCards({ data }: { data: PatientProfileFoundationData }) {
  const s = data.summary;
  const last = s.lastActivityAt ? s.lastActivityAt.slice(0, 10) : "—";
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <SummaryCard label="Linked leads" value={String(s.totalLeads)} />
      <SummaryCard label="Cases" value={String(s.totalCases)} />
      <SummaryCard label="Upcoming bookings" value={String(s.upcomingBookings)} />
      <SummaryCard label="Completed bookings" value={String(s.completedBookings)} />
      <SummaryCard label="Last activity" value={last} />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">{value}</p>
    </div>
  );
}
