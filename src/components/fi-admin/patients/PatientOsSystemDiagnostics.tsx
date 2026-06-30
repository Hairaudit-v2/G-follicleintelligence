import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { DashboardCard, SectionHeader, StatCard } from "@/src/components/fi-admin/dashboard-ui";
import type { PatientDirectorySummary } from "@/src/lib/patients/patientDirectoryLoader";
import type { PatientOsOverviewModel } from "@/src/lib/patients/patientOsDashboardLoader.server";
import { formatPatientWhen, patientDiagnosticCounts } from "@/src/lib/fiAdmin/patientPresentation";

export function PatientOsSystemDiagnostics({
  tenantId,
  overview,
  summary,
  showDiagnosticsExpanded = false,
  sessionLabel,
}: {
  tenantId: string;
  overview: PatientOsOverviewModel;
  summary: PatientDirectorySummary;
  showDiagnosticsExpanded?: boolean;
  sessionLabel?: string;
}) {
  const counts = patientDiagnosticCounts(overview, summary);
  const base = `/fi-admin/${tenantId}`;

  return (
    <details
      className="rounded-2xl border border-white/[0.08] bg-[#0c1220]/60 backdrop-blur-sm"
      open={showDiagnosticsExpanded}
    >
      <summary className="cursor-pointer list-none px-5 py-4 sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
              Operators
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#F8FAFC]">System diagnostics</h2>
            <p className="mt-1 max-w-3xl text-sm text-[#94A3B8]">
              For platform operators only. These checks support patient record integrity and do not
              affect day-to-day patient journey coordination.
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-cyan-300/80">
            {showDiagnosticsExpanded ? "Collapse" : "Expand"}
          </span>
        </div>
      </summary>

      <div className="space-y-6 border-t border-white/[0.06] px-5 py-5 sm:px-6 sm:py-6">
        {sessionLabel ? (
          <p className="text-xs text-[#64748B]">
            Session: <span className="text-[#94A3B8]">{sessionLabel}</span>
          </p>
        ) : null}

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="Patient directory aggregates"
            description="Summary counts from the patient directory loader (tenant-scoped)."
            className="mb-3"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total patients" value={counts.totalPatients} />
            <StatCard label="Active patients" value={counts.activePatients} />
            <StatCard label="With active case" value={counts.withActiveCase} />
            <StatCard label="With future booking" value={counts.withUpcomingBooking} />
          </div>
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="Overview loader window"
            description="Row counts returned by loadPatientOsOverview for dashboard sections."
            className="mb-3"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Recent patients" value={counts.recentPatientsLoaded} />
            <StatCard label="Active journeys" value={counts.activeJourneysLoaded} />
            <StatCard label="Upcoming bookings" value={counts.upcomingBookingsLoaded} />
            <StatCard label="Timeline highlights" value={counts.timelineHighlightsLoaded} />
          </div>
          <p className="mt-3 text-xs text-[#64748B]">
            Follow-ups due (distinct patients):{" "}
            <span className="tabular-nums text-[#E2E8F0]">{counts.followUpsDue}</span>
          </p>
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="Recent patient identifiers"
            description="Internal record IDs for support, case linkage, and integrity checks."
            className="mb-3"
          />
          <ul className="max-h-48 space-y-1 overflow-y-auto font-mono text-xs text-[#64748B]">
            {overview.recentPatients.slice(0, 12).map((p) => (
              <li
                key={p.patientId}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/[0.04] px-2 py-1"
              >
                <Link
                  href={`${base}/patients/${p.patientId}`}
                  className="text-cyan-300/90 hover:underline"
                >
                  {p.patientId}
                </Link>
                <span>
                  {p.displayName} · updated {formatPatientWhen(p.lastActivityAt)}
                </span>
              </li>
            ))}
          </ul>
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="Active journey case linkage"
            description="Foundation patient to SurgeryOS case mapping from overview loader."
            className="mb-3"
          />
          <ul className="max-h-48 space-y-1 overflow-y-auto font-mono text-xs text-[#64748B]">
            {overview.activeJourneys.slice(0, 12).map((j) => (
              <li
                key={`${j.patientId}-${j.caseId}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/[0.04] px-2 py-1"
              >
                <span className="text-[#94A3B8]">
                  patient {j.patientId} → case{" "}
                  <Link
                    href={`${base}/cases/${j.caseId}`}
                    className="text-cyan-300/90 hover:underline"
                  >
                    {j.caseId}
                  </Link>
                </span>
                <span>
                  {j.caseStatus} · {formatPatientWhen(j.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        </DashboardCard>

        <p className="flex items-center gap-2 text-xs text-[#64748B]">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Diagnostics do not change patient creation, twin logic, or directory search behaviour.
        </p>
      </div>
    </details>
  );
}
