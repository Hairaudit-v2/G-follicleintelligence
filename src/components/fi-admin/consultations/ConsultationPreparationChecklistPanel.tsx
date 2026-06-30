import Link from "next/link";

import { FiSection } from "@/src/components/fi-design/FiSection";
import type { PatientTwinConsultationChecklistRow } from "@/src/lib/patientTwin/patientTwinTypes";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{children}</p>;
}

/**
 * Read-only pre-consultation panel: latest HIE Stage 10 checklist snapshot for the linked patient.
 */
export function ConsultationPreparationChecklistPanel({
  checklist,
  patientTwinHref,
}: {
  checklist: PatientTwinConsultationChecklistRow | null;
  patientTwinHref: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40 dark:border-slate-700 dark:bg-slate-900">
      <FiSection
        title="Pre-consultation checklist (HIE)"
        description="Latest surgeon consultation checklist from Patient Twin intelligence. Read-only on this page; generate or edit on Patient Twin."
        headingId="consultation-os-hie-checklist-heading"
      >
        <p className="mb-3 rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200 dark:border-amber-500/35 dark:bg-amber-950/40 dark:text-amber-50/95">
          Checklist intelligence supports clinician preparation and does not replace medical judgement. It does not recommend surgery, graft
          counts, hairlines, or outcomes.
        </p>
        {!checklist ? (
          <p className="text-sm text-slate-400 dark:text-slate-300">
            No consultation checklist has been generated for this patient yet. Open{" "}
            <Link href={patientTwinHref} className="font-medium text-cyan-300 underline hover:text-cyan-200 dark:text-sky-400">
              Patient Twin
            </Link>{" "}
            to run the checklist engine.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-300 dark:bg-slate-800 dark:text-slate-200">
                Priority: {checklist.priority_level}
              </span>
              <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs font-semibold text-slate-300 dark:bg-slate-800 dark:text-slate-200">
                Review: {checklist.review_status}
              </span>
              {checklist.delay_recommended ? (
                <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-300 dark:bg-rose-950/60 dark:text-rose-100">
                  Delay discussion flagged
                </span>
              ) : null}
            </div>
            {checklist.consultation_summary?.trim() ? (
              <div>
                <FieldLabel>Summary</FieldLabel>
                <p className="mt-1 text-slate-200 dark:text-slate-200">{checklist.consultation_summary}</p>
              </div>
            ) : null}
            {checklist.checklist_items.length > 0 ? (
              <div>
                <FieldLabel>Topics</FieldLabel>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-300 dark:text-slate-300">
                  {checklist.checklist_items.slice(0, 12).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                {checklist.checklist_items.length > 12 ? (
                  <p className="mt-1 text-xs text-slate-500">+{checklist.checklist_items.length - 12} more on Patient Twin…</p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No checklist items on the latest row (may be a fallback run).</p>
            )}
            <p className="text-xs text-slate-500">
              Updated {checklist.created_at.slice(0, 10)} ·{" "}
              <Link href={patientTwinHref} className="font-medium text-cyan-300 underline dark:text-sky-400">
                Open Patient Twin
              </Link>
            </p>
          </div>
        )}
      </FiSection>
    </div>
  );
}
