"use client";

import type { CaseReadinessSection } from "@/src/lib/cases/caseReadinessTypes";
import { CaseSectionHealthBadge } from "./CaseSectionHealthBadge";

export function CaseReadinessChecklist({ sections }: { sections: CaseReadinessSection[] }) {
  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <div key={s.key} className="rounded border border-white/[0.06] bg-[#0F1629]/80 backdrop-blur-md p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-100">{s.title}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{s.summary}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <CaseSectionHealthBadge health={s.health} compact />
              <span className="text-[10px] text-gray-500">
                {s.requiredProgress.ok}/{s.requiredProgress.total} required checks
              </span>
            </div>
          </div>
          <ul className="mt-3 space-y-1 border-t border-gray-50 pt-2">
            {s.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-[11px] text-slate-300">
                <span className={c.ok ? "text-emerald-600" : c.optional ? "text-gray-400" : "text-rose-600"}>
                  {c.ok ? "✓" : c.optional ? "○" : "✗"}
                </span>
                <span className={c.optional ? "text-slate-400" : ""}>
                  {c.label}
                  {c.optional ? <span className="text-gray-400"> (optional)</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
