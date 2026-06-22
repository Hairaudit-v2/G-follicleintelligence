"use client";

import Link from "next/link";

import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import type { DeploymentIntelligenceSnapshot } from "@/src/lib/onboarding-os/deploymentIntelligenceTypes";
import {
  DEPLOYMENT_INTELLIGENCE_DOMAIN_LABELS,
  DEPLOYMENT_INTELLIGENCE_STATUS_BADGES,
} from "@/src/lib/onboarding-os/deploymentIntelligenceTypes";

const BADGE_CLASSES: Record<string, string> = {
  neutral: "bg-slate-500/15 text-slate-300",
  info: "bg-cyan-500/15 text-cyan-300",
  success: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-amber-500/15 text-amber-300",
  danger: "bg-red-500/15 text-red-300",
};

type Props = {
  snapshot: DeploymentIntelligenceSnapshot;
  mode: "platform" | "tenant";
};

export function DeploymentIntelligencePanel({ snapshot, mode }: Props) {
  const statusBadge = DEPLOYMENT_INTELLIGENCE_STATUS_BADGES[snapshot.deploymentStatus];
  const isReadOnly = mode === "tenant";
  const blockers = snapshot.recommendations.filter((r) => r.severity === "blocker");

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={fiOsChromeClasses.sectionEyebrow}>OnboardingOS · Phase E2</p>
          <h3 className="text-sm font-semibold text-slate-200">Deployment Intelligence Command Centre</h3>
          <p className="mt-1 text-xs text-slate-500">
            {isReadOnly
              ? "Weighted deployment score across infrastructure, workflows, staff, operations, adoption, and executive approval."
              : "Holistic deployment scoring — Go-Live Readiness remains the explicit production approval gate."}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_CLASSES[statusBadge.tone] ?? BADGE_CLASSES.neutral}`}
        >
          {statusBadge.label}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Deployment Score" value={`${snapshot.deploymentScore}%`} accent />
        <MetricCard label="Adoption Confidence" value={`${snapshot.adoptionConfidenceScore}%`} />
        <MetricCard label="Executive Approval" value={`${snapshot.executiveApprovalScore}%`} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Weighted progress</span>
          <span>{snapshot.deploymentScore}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-emerald-500 transition-all"
            style={{ width: `${snapshot.deploymentScore}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-600">
          Provisioning {snapshot.provisioningProgressPercent}%
          {snapshot.countryLabel !== "—" ? ` · ${snapshot.countryLabel}` : ""}
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {snapshot.scoreBreakdown.domainScores.map((domain) => (
          <div key={domain.domain} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-300">{DEPLOYMENT_INTELLIGENCE_DOMAIN_LABELS[domain.domain]}</p>
              <span className="text-xs font-mono text-slate-500">{domain.weight}%</span>
            </div>
            <p className="mt-1 text-lg font-semibold text-slate-100">{domain.scorePercent}%</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{domain.summary}</p>
            {domain.blockers.length > 0 ? (
              <p className="mt-1 text-[11px] text-amber-400">{domain.blockers[0]}</p>
            ) : null}
          </div>
        ))}
      </div>

      {!isReadOnly ? (
        <div className="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-200">
          Go-Live Readiness:{" "}
          <span className="font-medium capitalize">{snapshot.goLiveReadiness.status.replace(/_/g, " ")}</span>
          {snapshot.goLiveReadiness.reviews.goLiveApproved ? " · Approved" : " · Approval required for production"}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
          {blockers.length > 0
            ? `${blockers.length} item(s) remain before production readiness. Platform admin approval is required for go-live.`
            : snapshot.deploymentScore >= 96
              ? "Deployment meets production threshold — awaiting platform go-live approval."
              : "Continue setup and staff onboarding to raise your deployment score."}
        </div>
      )}

      {snapshot.recommendations.length > 0 ? (
        <div className="mt-5 border-t border-white/[0.06] pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommendations</h4>
          <ul className="mt-3 space-y-2">
            {snapshot.recommendations.slice(0, isReadOnly ? 5 : 8).map((rec) => (
              <li
                key={rec.code}
                className={`rounded-lg px-3 py-2 text-xs ${
                  rec.severity === "blocker"
                    ? "border border-red-500/20 bg-red-950/20 text-red-200"
                    : rec.severity === "warning"
                      ? "border border-amber-500/20 bg-amber-950/20 text-amber-200"
                      : "border border-white/[0.06] bg-white/[0.03] text-slate-300"
                }`}
              >
                <span className="font-medium">{rec.title}</span>
                <span className="mt-0.5 block opacity-90">{rec.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!isReadOnly && mode === "platform" ? (
        <p className="mt-4 text-xs text-slate-600">
          Use the{" "}
          <Link href={`/fi-admin/platform/onboarding/${snapshot.sessionId}`} className="text-cyan-400 hover:text-cyan-300">
            Go-Live Readiness panel
          </Link>{" "}
          below for checklist reviews and explicit production approval.
        </p>
      ) : null}
    </section>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${accent ? "bg-cyan-500/10" : "bg-white/[0.03]"}`}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-1 text-xl font-semibold ${accent ? "text-cyan-300" : "text-slate-100"}`}>{value}</dd>
    </div>
  );
}
