import Link from "next/link";

import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { resolveProvisioningStatusBadge } from "@/src/lib/onboarding-os/tenantProvisioningCore";
import { loadPlatformDeploymentDashboard } from "@/src/lib/onboarding-os/deploymentIntelligence.server";
import { DEPLOYMENT_INTELLIGENCE_STATUS_BADGES } from "@/src/lib/onboarding-os/deploymentIntelligenceTypes";
import type { ProvisioningSessionStatus } from "@/src/lib/onboarding-os/tenantProvisioningTypes";

export const dynamic = "force-dynamic";

const BADGE_CLASSES: Record<string, string> = {
  neutral: "bg-slate-500/15 text-slate-300",
  info: "bg-cyan-500/15 text-cyan-300",
  success: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-amber-500/15 text-amber-300",
  danger: "bg-red-500/15 text-red-300",
};

const GO_LIVE_STATE_LABELS: Record<string, string> = {
  blocked: "Blocked",
  pending: "Pending",
  ready: "Ready",
  approved: "Approved",
};

export default async function PlatformDeploymentsPage() {
  const loaded = await loadPlatformDeploymentDashboard();
  if (!loaded.ok) {
    return (
      <p className="text-sm text-red-400">Could not load deployment dashboard: {loaded.error}</p>
    );
  }

  const rows = loaded.rows;

  return (
    <div className="space-y-8">
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>OnboardingOS · Phase E2</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Deployment Intelligence</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Active onboarding deployments scored across infrastructure, workflows, staff, operational
          testing, adoption confidence, and executive approval. Go-live approval remains a separate
          explicit platform action.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-200">Active deployments ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No active provisioning sessions.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#060d18]/80">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/[0.06] bg-white/[0.03] text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Clinic</th>
                  <th className="px-4 py-3 font-medium">Country</th>
                  <th className="px-4 py-3 font-medium">Provisioning</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Blockers</th>
                  <th className="px-4 py-3 font-medium">Adoption</th>
                  <th className="px-4 py-3 font-medium">Go-live</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-slate-300">
                {rows.map((row) => {
                  const provBadge = resolveProvisioningStatusBadge(
                    row.provisioningStatus as ProvisioningSessionStatus
                  );
                  const depBadge = DEPLOYMENT_INTELLIGENCE_STATUS_BADGES[row.deploymentStatus];
                  return (
                    <tr key={row.sessionId}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-100">{row.tenantName}</p>
                        <p className="font-mono text-xs text-slate-600">{row.tenantSlug}</p>
                      </td>
                      <td className="px-4 py-3 text-xs">{row.countryLabel}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_CLASSES[provBadge.tone] ?? BADGE_CLASSES.neutral}`}
                        >
                          {provBadge.label}
                        </span>
                        <p className="mt-1 text-xs text-slate-600">
                          {row.provisioningProgressPercent}%
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-cyan-300">
                        {row.deploymentScore}%
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_CLASSES[depBadge.tone] ?? BADGE_CLASSES.neutral}`}
                        >
                          {depBadge.label}
                        </span>
                      </td>
                      <td className="max-w-[200px] px-4 py-3 text-xs text-amber-300/90">
                        {row.criticalBlockers.length ? row.criticalBlockers[0] : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {row.adoptionConfidenceScore}%
                      </td>
                      <td className="px-4 py-3 text-xs capitalize">
                        {GO_LIVE_STATE_LABELS[row.goLiveApprovalState] ?? row.goLiveApprovalState}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/fi-admin/platform/onboarding/${row.sessionId}`}
                          className="font-medium text-cyan-400 hover:text-cyan-300"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
