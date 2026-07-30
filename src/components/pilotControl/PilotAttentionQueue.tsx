"use client";

import Link from "next/link";

import { SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { PilotBlockerBadge } from "@/src/components/pilotControl/PilotBlockerBadge";
import type { PilotBlockerListItem } from "@/src/lib/pilotControl/api/pilotControlApiTypes";
import {
  formatAgeSeconds,
  severitySortRank,
} from "@/src/lib/pilotControl/ui/pilotControlFormatters";
import {
  canShowPauseRecommendation,
  shouldSuppressPatientSafeSummary,
} from "@/src/lib/pilotControl/ui/pilotControlUiAccess";
import type { PilotControlRoleKey } from "@/src/lib/pilotControl/pilotControlContracts";

export function sortAttentionQueue(items: PilotBlockerListItem[]): PilotBlockerListItem[] {
  return [...items].sort((a, b) => {
    const sr = severitySortRank(a.severity) - severitySortRank(b.severity);
    if (sr !== 0) return sr;
    return (b.ageSeconds ?? 0) - (a.ageSeconds ?? 0);
  });
}

export function PilotAttentionQueue({
  blockers,
  role,
  onSelectPatient,
}: {
  blockers: PilotBlockerListItem[];
  role: PilotControlRoleKey;
  onSelectPatient?: (patientId: string) => void;
}) {
  const showPause = canShowPauseRecommendation(role);
  const ordered = sortAttentionQueue(blockers);

  return (
    <section className="space-y-3" aria-labelledby="pilot-attention-heading">
      <SectionHeader
        id="pilot-attention-heading"
        title="Immediate attention queue"
        description="Critical and high blockers first, then oldest within severity. Read-only — no dismiss or resolve controls."
      />
      {ordered.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] bg-[#0F1629]/50 px-4 py-6 text-sm text-slate-400">
          No active blockers requiring immediate attention.
        </p>
      ) : (
        <ul className="space-y-2">
          {ordered.map((b) => {
            const showSafe =
              b.patientSafeSummary && !shouldSuppressPatientSafeSummary(b.category);
            const pause = showPause && Boolean(b.escalation.requiresPilotPause);
            return (
              <li
                key={b.id}
                className="rounded-xl border border-white/[0.08] bg-[#141C33]/55 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <PilotBlockerBadge severity={b.severity} pause={pause} />
                      <button
                        type="button"
                        className="text-left text-sm font-medium text-[#F8FAFC] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                        onClick={() => onSelectPatient?.(b.patientId)}
                      >
                        Patient {b.patientId.slice(0, 8)}…
                      </button>
                    </div>
                    <p className="text-sm text-slate-100">{b.title}</p>
                    {showSafe ? (
                      <p className="text-xs text-slate-400">{b.patientSafeSummary}</p>
                    ) : null}
                    <p className="text-xs text-slate-300">
                      Owner: {b.ownership.ownerType}
                      {b.ownership.ownerRole ? ` (${b.ownership.ownerRole})` : ""}
                      {" · "}
                      Open: {formatAgeSeconds(b.ageSeconds)}
                      {" · "}
                      Escalation: {b.escalation.level}
                    </p>
                    <p className="text-xs text-cyan-100/90">
                      Next: {b.recommendedNextAction}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Source: {b.sourceModule}
                      {b.sourceLink?.href ? (
                        <>
                          {" · "}
                          <Link
                            href={b.sourceLink.href}
                            className="text-cyan-300 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                          >
                            {b.sourceLink.label}
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
