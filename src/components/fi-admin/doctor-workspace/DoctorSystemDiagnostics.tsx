import Link from "next/link";

import { DashboardCard, SectionHeader, StatCard } from "@/src/components/fi-admin/dashboard-ui";
import type { DoctorWorkspaceBundle } from "@/src/lib/doctorOs/doctorWorkspaceLoader.server";
import { doctorWorkspaceDiagnosticCounts } from "@/src/lib/fiAdmin/doctorWorkspacePresentation";
import type { FiPatientPrescriptionRow } from "@/src/lib/prescribing/fiPrescribingTypes";
import { PRESCRIPTION_STATUS_LABELS } from "@/src/lib/prescribing/fiPrescribingTypes";

export function DoctorSystemDiagnostics({
  bundle,
  recentPrescriptions,
  showDiagnosticsExpanded = false,
}: {
  bundle: DoctorWorkspaceBundle;
  recentPrescriptions: readonly FiPatientPrescriptionRow[];
  showDiagnosticsExpanded?: boolean;
}) {
  const base = `/fi-admin/${bundle.tenantId}`;
  const counts = doctorWorkspaceDiagnosticCounts(bundle);

  return (
    <details
      className="rounded-2xl border border-white/[0.08] bg-[#0c1220]/60 backdrop-blur-sm"
      open={showDiagnosticsExpanded}
    >
      <summary className="cursor-pointer list-none px-5 py-4 sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">Operators</p>
            <h2 className="mt-1 text-lg font-semibold text-[#F8FAFC]">System diagnostics</h2>
            <p className="mt-1 max-w-3xl text-sm text-[#94A3B8]">
              For platform operators only. These checks support medical workflow integrity and do not affect day-to-day
              physician workflow.
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-emerald-400/80">
            {showDiagnosticsExpanded ? "Collapse" : "Expand"}
          </span>
        </div>
      </summary>

      <div className="space-y-6 border-t border-white/[0.06] px-5 py-5 sm:px-6 sm:py-6">
        <DashboardCard className="p-4 sm:p-5">
          <SectionHeader
            kicker="Loader"
            title="Doctor workspace counts"
            description="Raw queue lengths from the doctor workspace loader."
            className="mb-4"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Object.entries(counts).map(([key, count]) => (
              <StatCard key={key} label={key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")} value={count} />
            ))}
          </div>
        </DashboardCard>

        <DashboardCard className="p-4 sm:p-5">
          <SectionHeader
            kicker="Prescriptions"
            title="Recent prescription object data"
            description="Latest prescription records loaded for the workspace (status and identifiers)."
            className="mb-4"
          />
          {recentPrescriptions.length === 0 ? (
            <p className="text-sm text-[#64748B]">No recent prescriptions loaded.</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-xs">
              {recentPrescriptions.slice(0, 30).map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 font-mono text-[#94A3B8]"
                >
                  <span className="text-[#64748B]">{r.id.slice(0, 8)}…</span> · patient {r.patient_id.slice(0, 8)}… ·{" "}
                  {PRESCRIPTION_STATUS_LABELS[r.status]} · doctor {r.doctor_id.slice(0, 8)}…
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        <DashboardCard className="p-4 sm:p-5">
          <SectionHeader
            kicker="Draft state"
            title="In-progress prescription drafts"
            description="Draft prescriptions split by repeat-rule confirmation state."
            className="mb-4"
          />
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Drafts in progress" value={bundle.draftPrescriptionsInProgress.length} />
            <StatCard label="Ready to sign" value={bundle.prescriptionsAwaitingSignature.length} />
            <StatCard label="Pharmacy queue" value={bundle.pharmacyQueue.length} />
          </dl>
          <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto font-mono text-xs text-[#64748B]">
            {bundle.draftPrescriptionsInProgress.map((r) => (
              <li key={r.id}>
                {r.id.slice(0, 8)}… · {r.patientId.slice(0, 8)}… · in progress
              </li>
            ))}
            {bundle.prescriptionsAwaitingSignature.map((r) => (
              <li key={r.id}>
                {r.id.slice(0, 8)}… · {r.patientId.slice(0, 8)}… · awaiting signature
              </li>
            ))}
          </ul>
        </DashboardCard>

        <DashboardCard className="p-4 sm:p-5">
          <SectionHeader
            kicker="Sync"
            title="Tenant and loader metadata"
            description="Backend sync context for operator troubleshooting."
            className="mb-4"
          />
          <dl className="space-y-2 font-mono text-xs text-[#94A3B8]">
            <div>
              <dt className="text-[#64748B]">tenantId</dt>
              <dd className="break-all">{bundle.tenantId}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">includeCrmTasks</dt>
              <dd>{String(bundle.includeCrmTasks)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-[#64748B]">
            <Link href={`${base}/doctor`} className="text-emerald-400/80 hover:underline">
              Doctor Workspace
            </Link>
            {" · "}
            <Link href={`${base}/prescriptions`} className="text-emerald-400/80 hover:underline">
              Prescriptions
            </Link>
          </p>
        </DashboardCard>
      </div>
    </details>
  );
}
