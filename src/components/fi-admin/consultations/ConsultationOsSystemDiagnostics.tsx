import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { DashboardCard, SectionHeader, StatCard } from "@/src/components/fi-admin/dashboard-ui";
import type { ConsultationDashboardPayload } from "@/src/lib/fiAdmin/consultationDashboardTypes";
import {
  consultationDiagnosticCounts,
  formatConsultationDateTime,
} from "@/src/lib/fiAdmin/consultationPresentation";

export function ConsultationOsSystemDiagnostics({
  tenantId,
  payload,
  showDiagnosticsExpanded = false,
  sessionLabel,
}: {
  tenantId: string;
  payload: ConsultationDashboardPayload;
  showDiagnosticsExpanded?: boolean;
  sessionLabel?: string;
}) {
  const counts = consultationDiagnosticCounts(payload);
  const { conversion } = payload;
  const columnCounts = Object.entries(conversion.columns).map(([key, cards]) => ({
    key,
    count: cards.length,
  }));

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
              For platform operators only. These checks support consultation integrity and do not
              affect day-to-day clinical planning.
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-violet-300/80">
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
            title="Consultation record volume"
            description="Loaded consultation rows for this tenant (service-role index fetch)."
            className="mb-3"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Rows loaded" value={counts.totalLoaded} />
            <StatCard label="Patient linked" value={counts.withPatientLink} />
            <StatCard label="Lead linked" value={counts.withLeadLink} />
            <StatCard label="Booking linked" value={counts.withBookingLink} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(counts.byStatus).map(([status, n]) => (
              <div
                key={status}
                className="rounded-lg border border-white/[0.06] px-3 py-2 text-sm text-[#94A3B8]"
              >
                <span className="font-medium text-[#CBD5E1]">{status}</span>
                <span className="ml-2 tabular-nums text-[#F8FAFC]">{n}</span>
              </div>
            ))}
          </div>
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="Conversion board window"
            description="Date window and column distribution from consultation conversion loader."
            className="mb-3"
          />
          <dl className="grid gap-2 text-sm text-[#94A3B8] sm:grid-cols-2">
            <div>
              <dt className="text-[#64748B]">Timezone</dt>
              <dd className="text-[#E2E8F0]">{conversion.window.calendarTimezone}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Today (local)</dt>
              <dd className="text-[#E2E8F0]">{conversion.window.todayYmd}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Window start</dt>
              <dd className="text-[#E2E8F0]">{conversion.window.ymdPast90}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Window end</dt>
              <dd className="text-[#E2E8F0]">{conversion.window.ymdFuture30}</dd>
            </div>
          </dl>
          <ul className="mt-4 space-y-1.5 text-sm">
            {columnCounts.map(({ key, count }) => (
              <li
                key={key}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] px-3 py-2"
              >
                <span className="font-mono text-xs text-[#94A3B8]">{key}</span>
                <span className="tabular-nums text-[#F8FAFC]">{count}</span>
              </li>
            ))}
          </ul>
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="Recent consultation identifiers"
            description="Internal record IDs for support and integrity checks."
            className="mb-3"
          />
          <ul className="max-h-48 space-y-1 overflow-y-auto font-mono text-xs text-[#64748B]">
            {payload.consultations.slice(0, 12).map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/[0.04] px-2 py-1"
              >
                <Link
                  href={`/fi-admin/${tenantId}/consultations/${r.id}`}
                  className="text-violet-300/90 hover:underline"
                >
                  {r.id}
                </Link>
                <span>
                  {r.status} · updated {formatConsultationDateTime(r.updated_at)}
                </span>
              </li>
            ))}
          </ul>
        </DashboardCard>

        <p className="flex items-center gap-2 text-xs text-[#64748B]">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Diagnostics do not change consultation templates, autosave, or pathway form behaviour.
        </p>
      </div>
    </details>
  );
}
