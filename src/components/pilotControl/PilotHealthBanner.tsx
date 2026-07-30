"use client";

import { FiStatusBadge } from "@/src/components/fi-design/FiStatusBadge";
import type {
  PilotControlHealthResponse,
  PilotControlOverview,
} from "@/src/lib/pilotControl/api/pilotControlApiTypes";
import {
  coerceDisplayedHealthVerdict,
  formatExpansionRecommendation,
  healthBannerCopy,
  healthVerdictTone,
} from "@/src/lib/pilotControl/ui/pilotControlFormatters";
import { canShowPauseRecommendation } from "@/src/lib/pilotControl/ui/pilotControlUiAccess";
import type { PilotControlRoleKey } from "@/src/lib/pilotControl/pilotControlContracts";

export function PilotHealthBanner({
  overview,
  health,
  role,
}: {
  overview: PilotControlOverview;
  health: PilotControlHealthResponse | null;
  role: PilotControlRoleKey;
}) {
  const { verdict, forceInsufficientEvidence } = coerceDisplayedHealthVerdict({
    verdict: health?.verdict ?? overview.health.verdict,
    expansionRecommendation:
      health?.expansionRecommendation ?? overview.health.expansionRecommendation,
    totalApproved: overview.cohort.totalApproved,
    realPatientInvitesEnabled: overview.programme.realPatientInvitesEnabled,
  });
  const expansion =
    health?.expansionRecommendation ?? overview.health.expansionRecommendation;
  const copy = healthBannerCopy({
    verdict,
    expansionRecommendation: expansion,
    forceInsufficientEvidence,
    health,
  });
  const tone = healthVerdictTone(forceInsufficientEvidence ? "AMBER" : verdict);
  const showPause = canShowPauseRecommendation(role);
  const critical = overview.blockers.openBySeverity.critical;
  const high = overview.blockers.openBySeverity.high;
  const stopConditions = health?.stopConditions ?? [];

  const border =
    tone === "success"
      ? "border-emerald-500/35 bg-emerald-950/30"
      : tone === "danger"
        ? "border-rose-500/40 bg-rose-950/35"
        : "border-amber-500/35 bg-amber-950/30";

  return (
    <section
      className={`rounded-xl border px-4 py-4 sm:px-5 ${border}`}
      role={tone === "danger" ? "alert" : "status"}
      aria-live={tone === "danger" ? "assertive" : "polite"}
    >
      <div className="flex flex-wrap items-start gap-3">
        <FiStatusBadge tone={tone}>
          <span aria-hidden>
            {tone === "success" ? "● " : tone === "danger" ? "▲ " : "◆ "}
          </span>
          {forceInsufficientEvidence ? "AMBER" : verdict}
        </FiStatusBadge>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-sm font-semibold text-[#F8FAFC]">{copy.title}</h2>
          <p className="text-xs leading-relaxed text-slate-200/90">{copy.body}</p>
          <p className="text-xs text-slate-300">
            Expansion: {formatExpansionRecommendation(expansion)}
            {" · "}
            Critical blockers: {critical}
            {" · "}
            High blockers: {high}
          </p>
          {showPause && overview.pauseRecommendation?.requiresPilotPause ? (
            <p className="text-xs font-medium text-rose-200">
              Pilot pause recommended ({overview.pauseRecommendation.blockersRequiringPilotPause}{" "}
              pause-linked blockers).
            </p>
          ) : null}
          {stopConditions.length > 0 && showPause ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-rose-100/90">
              {stopConditions.map((s) => (
                <li key={s.code}>
                  [{s.severity.toUpperCase()}] {s.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
