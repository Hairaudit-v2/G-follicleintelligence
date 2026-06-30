"use client";

import type { CaseReadinessHealth } from "@/src/lib/cases/caseReadinessTypes";
import { caseReadinessHealthLabel } from "@/src/lib/cases/caseReadinessLabels";

const STYLES: Record<CaseReadinessHealth, string> = {
  complete: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  in_progress: "bg-amber-400/15 text-amber-200 border-amber-400/20",
  needs_attention: "bg-rose-500/15 text-rose-300 border-rose-500/20",
  not_started: "bg-white/[0.06] text-slate-300 border-white/[0.08]",
};

export function CaseSectionHealthBadge({
  health,
  compact,
}: {
  health: CaseReadinessHealth;
  /** Smaller pill for dense rows. */
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${STYLES[health]} ${
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      }`}
    >
      {caseReadinessHealthLabel(health)}
    </span>
  );
}
