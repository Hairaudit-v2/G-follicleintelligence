"use client";

import type { CaseReadinessHealth } from "@/src/lib/cases/caseReadinessTypes";
import { caseReadinessHealthLabel } from "@/src/lib/cases/caseReadinessLabels";

const STYLES: Record<CaseReadinessHealth, string> = {
  complete: "bg-emerald-100 text-emerald-900 border-emerald-200",
  in_progress: "bg-amber-100 text-amber-900 border-amber-200",
  needs_attention: "bg-rose-100 text-rose-900 border-rose-200",
  not_started: "bg-gray-100 text-gray-700 border-gray-200",
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
