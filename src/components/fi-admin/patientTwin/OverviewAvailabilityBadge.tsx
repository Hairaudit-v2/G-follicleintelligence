import type { OverviewAvailability } from "@/src/lib/patientTwin/patientTwinOverviewTypes";
import { availabilityLabel } from "@/src/lib/patientTwin/patientTwinOverviewCopy";

const TONE: Record<OverviewAvailability, string> = {
  recorded: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  not_recorded: "border-white/10 bg-white/5 text-slate-400",
  not_available: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  not_applicable: "border-white/10 bg-transparent text-slate-500",
  planned_future: "border-sky-500/40 bg-sky-500/10 text-sky-100",
};

/** Non-colour-only status: text label always present alongside tone. */
export function OverviewAvailabilityBadge({
  availability,
}: {
  availability: OverviewAvailability;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${TONE[availability]}`}
    >
      {availabilityLabel(availability)}
    </span>
  );
}
