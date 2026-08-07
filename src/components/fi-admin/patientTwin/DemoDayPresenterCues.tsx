import { OVERVIEW_SECTION_IDS } from "@/src/lib/patientTwin/patientTwinOverviewTypes";
import { OVERVIEW_SECTION_HEADINGS } from "@/src/lib/patientTwin/patientTwinOverviewCopy";

const CUES: Array<{ sectionId: string; beat: string; cue: string }> = [
  {
    sectionId: OVERVIEW_SECTION_IDS.summary,
    beat: "1 · Summary",
    cue: "Introduce the patient lifecycle and clinic context — keep names staff-facing.",
  },
  {
    sectionId: OVERVIEW_SECTION_IDS.baseline,
    beat: "2 · Baseline",
    cue: "History, photos and risk signals only. Say “not recorded” when empty.",
  },
  {
    sectionId: OVERVIEW_SECTION_IDS.surgicalPlan,
    beat: "3 · Plan",
    cue: "Approved hairline, zones and planned graft total — then deep-link to case.",
  },
  {
    sectionId: OVERVIEW_SECTION_IDS.procedure,
    beat: "4 · Procedure",
    cue: "Reconcile implanted grafts to the approved plan; note technique and team size.",
  },
  {
    sectionId: OVERVIEW_SECTION_IDS.outcomes,
    beat: "5 · Outcomes",
    cue: "Label 3- and 6-month rows as demonstration projections — never as completed follow-ups.",
  },
  {
    sectionId: OVERVIEW_SECTION_IDS.workforce,
    beat: "6 · Team",
    cue: "Competency validity on the procedure date where the record supports it.",
  },
  {
    sectionId: OVERVIEW_SECTION_IDS.economics,
    beat: `7 · ${OVERVIEW_SECTION_HEADINGS.economics}`,
    cue: "Quote, deposit, balance and paid totals in AUD — open Payments for detail.",
  },
  {
    sectionId: OVERVIEW_SECTION_IDS.governance,
    beat: "8 · Governance",
    cue: "Consent, approvals and provenance — only list source systems that contributed.",
  },
];

/**
 * Stub presenter cue rail for `?presentation=1` / `?demo=overview`.
 * Read-only; no write paths.
 */
export function DemoDayPresenterCues() {
  return (
    <aside
      className="rounded-xl border border-cyan-500/25 bg-cyan-950/30 p-4"
      aria-labelledby="demo-day-presenter-cues-heading"
    >
      <h2
        id="demo-day-presenter-cues-heading"
        className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/90"
      >
        Presenter cues
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        Screen-share guide. Speech may say “patient intelligence overview”; chrome stays Health
        record.
      </p>
      <ol className="mt-3 space-y-2">
        {CUES.map((c) => (
          <li key={c.sectionId} className="text-sm">
            <a
              href={`#${c.sectionId}`}
              className="font-medium text-cyan-200 hover:underline"
            >
              {c.beat}
            </a>
            <p className="text-xs text-slate-400">{c.cue}</p>
          </li>
        ))}
      </ol>
    </aside>
  );
}
