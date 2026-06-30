import type { PatientStatusValue } from "@/src/lib/patients/patientPolicy";
import { patientStatusLabel } from "@/src/lib/patients/patientLabels";

const STYLES: Record<PatientStatusValue, string> = {
  active: "bg-emerald-500/10 text-emerald-300 ring-emerald-600/20",
  inactive: "bg-white/[0.06] text-slate-200 ring-slate-600/20",
  archived: "bg-amber-400/10 text-amber-200 ring-amber-600/20",
  deceased: "bg-zinc-500/15 text-zinc-200 ring-zinc-600/20",
  duplicate: "bg-violet-500/10 text-violet-300 ring-violet-600/20",
};

export function PatientStatusBadge({ status }: { status: PatientStatusValue }) {
  const cls = STYLES[status] ?? STYLES.active;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {patientStatusLabel(status)}
    </span>
  );
}
