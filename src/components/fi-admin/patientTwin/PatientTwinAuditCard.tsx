import Link from "next/link";

import { FiSection } from "@/src/components/fi-design/FiSection";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

function statusPills(entries: Record<string, number>): { key: string; n: number }[] {
  return Object.entries(entries)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => ({ key, n }))
    .sort((a, b) => b.n - a.n);
}

export type PatientTwinAuditCardProps = {
  tenantId: string;
  twin: PatientTwinV1;
};

export function PatientTwinAuditCard({ tenantId, twin }: PatientTwinAuditCardProps) {
  const a = twin.audits;
  const reportPills = statusPills(a.reports_by_status);
  const runPills = statusPills(a.model_runs_by_status);
  const emptyRollup =
    a.reports_total === 0 && a.audits_total === 0 && a.model_runs_total === 0 && a.scorecards_total === 0;

  return (
    <FiSection
      surfaceVariant="darkGlass"
      headingId="patient-twin-audit-heading"
      title="Audit & reports"
      description="Patient-level rollup across all linked cases (read-only)."
    >
      {emptyRollup ? (
        <p className="text-sm text-[#94A3B8]">No reports, audits, model runs, or scorecards on linked cases.</p>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Reports", value: a.reports_total },
              { label: "Audits", value: a.audits_total },
              { label: "Model runs", value: a.model_runs_total },
              { label: "Scorecards", value: a.scorecards_total },
            ].map((x) => (
              <div key={x.label} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-center">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[#64748B]">{x.label}</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-white">{x.value}</p>
              </div>
            ))}
          </div>

          {reportPills.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Reports by status</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {reportPills.map(({ key, n }) => (
                  <li
                    key={key}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-[#E2E8F0]"
                  >
                    <span className="text-[#94A3B8]">{key}</span> <span className="font-semibold">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {runPills.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Model runs by status</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {runPills.map(({ key, n }) => (
                  <li
                    key={key}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-[#E2E8F0]"
                  >
                    <span className="text-[#94A3B8]">{key}</span> <span className="font-semibold">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Outcomes</p>
            <p className="mt-1 text-xs text-[#94A3B8]">Outcome indicators are not computed in Twin V1 (placeholder).</p>
          </div>

          {a.latest_released_report ? (
            <div className="text-xs text-[#94A3B8]">
              <span className="text-[#64748B]">Latest released report </span>
              <Link
                href={`/fi-admin/${tenantId}/cases/${a.latest_released_report.case_id}`}
                className="font-medium text-cyan-200/90 hover:text-cyan-100 hover:underline"
              >
                v{a.latest_released_report.version} · case {a.latest_released_report.case_id.slice(0, 8)}…
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </FiSection>
  );
}
