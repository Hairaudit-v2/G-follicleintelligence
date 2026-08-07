import type { OverviewWorkforceSection } from "@/src/lib/patientTwin/patientTwinOverviewTypes";
import { OVERVIEW_SECTION_HEADINGS } from "@/src/lib/patientTwin/patientTwinOverviewCopy";
import { OVERVIEW_SECTION_IDS } from "@/src/lib/patientTwin/patientTwinOverviewTypes";
import { OverviewAvailabilityBadge } from "./OverviewAvailabilityBadge";

export function PatientTwinWorkforceStrip({
  workforce,
}: {
  workforce: OverviewWorkforceSection;
}) {
  return (
    <section
      id={OVERVIEW_SECTION_IDS.workforce}
      className="scroll-mt-4 rounded-xl border border-white/[0.08] bg-[#0b1220]/90 p-4"
      aria-labelledby="overview-workforce-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="overview-workforce-heading"
          className="text-sm font-semibold tracking-tight text-slate-100"
        >
          {OVERVIEW_SECTION_HEADINGS.workforce}
        </h2>
        <OverviewAvailabilityBadge availability={workforce.availability} />
      </div>

      {workforce.procedureDate ? (
        <p className="mt-2 text-xs text-slate-400">
          Procedure date{" "}
          <time dateTime={workforce.procedureDate}>{workforce.procedureDate}</time>
        </p>
      ) : null}

      {workforce.members.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          {workforce.availability === "not_applicable"
            ? "Team roster is not applicable until a procedure is on the record."
            : "Procedure team is not recorded."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {workforce.members.map((m, idx) => (
            <li
              key={`${m.role}-${m.displayName}-${idx}`}
              className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-slate-100">{m.displayName}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">{m.role}</p>
              </div>
              {m.competencyNote ? (
                <p className="mt-1 text-xs text-slate-400">
                  {m.competencyValidOnProcedureDate === true ? (
                    <span className="text-emerald-300">Valid on procedure date · </span>
                  ) : m.competencyValidOnProcedureDate === false ? (
                    <span className="text-amber-200">Not confirmed · </span>
                  ) : (
                    <span className="text-slate-500">Validity unknown · </span>
                  )}
                  {m.competencyNote}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
