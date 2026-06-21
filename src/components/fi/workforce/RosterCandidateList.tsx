import type { RosterAssignableCandidate } from "@/src/lib/workforce-os/workforceRosterCandidates";

export type RosterCandidateListProps = {
  candidates: RosterAssignableCandidate[];
  selectedStaffId?: string | null;
  onSelect?: (staffId: string) => void;
  disabled?: boolean;
};

function sectionTitle(section: RosterAssignableCandidate["section"]): string {
  switch (section) {
    case "eligible":
      return "Eligible staff";
    case "warning":
      return "Eligible with warnings";
    case "blocked":
      return "Unavailable / blocked";
  }
}

function sectionTone(section: RosterAssignableCandidate["section"]): string {
  switch (section) {
    case "eligible":
      return "text-emerald-300";
    case "warning":
      return "text-amber-300";
    case "blocked":
      return "text-rose-300";
  }
}

export function RosterCandidateList({
  candidates,
  selectedStaffId,
  onSelect,
  disabled,
}: RosterCandidateListProps) {
  if (!candidates.length) {
    return <p className="text-sm text-slate-500">No staff candidates found for this role.</p>;
  }

  const sections: RosterAssignableCandidate["section"][] = ["eligible", "warning", "blocked"];

  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const rows = candidates.filter((c) => c.section === section);
        if (!rows.length) return null;
        return (
          <div key={section}>
            <h4 className={`text-xs font-semibold uppercase tracking-wider ${sectionTone(section)}`}>
              {sectionTitle(section)}
            </h4>
            <ul className="mt-2 space-y-2">
              {rows.map((candidate) => {
                const selected = selectedStaffId === candidate.staffId;
                return (
                  <li key={candidate.staffId}>
                    <button
                      type="button"
                      disabled={disabled || section === "blocked"}
                      onClick={() => onSelect?.(candidate.staffId)}
                      className={[
                        "w-full rounded-lg border px-3 py-2.5 text-left text-sm transition",
                        selected
                          ? "border-cyan-400/50 bg-cyan-500/10"
                          : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14]",
                        disabled || section === "blocked" ? "cursor-not-allowed opacity-60" : "",
                      ].join(" ")}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-100">{candidate.name}</span>
                        <span className="font-mono text-xs text-slate-400">{candidate.readinessScore}</span>
                      </div>
                      <p className="mt-0.5 text-xs capitalize text-slate-500">
                        {candidate.role?.replace(/_/g, " ") ?? "Role unset"} · {candidate.readinessBand.replace(/_/g, " ")}
                      </p>
                      {candidate.warnings.length ? (
                        <p className="mt-1 text-xs text-amber-200">{candidate.warnings.join("; ")}</p>
                      ) : null}
                      {candidate.reasons.length && section === "blocked" ? (
                        <p className="mt-1 text-xs text-rose-200">{candidate.reasons.join("; ")}</p>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
