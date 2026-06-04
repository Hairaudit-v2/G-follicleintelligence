import type { PatientStatusValue } from "@/src/lib/patients/patientPolicy";
import { patientStatusLabel } from "@/src/lib/patients/patientLabels";

const STYLES: Record<PatientStatusValue, string> = {
  active: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  inactive: "bg-slate-100 text-slate-800 ring-slate-600/20",
  archived: "bg-amber-50 text-amber-900 ring-amber-600/20",
  deceased: "bg-zinc-200 text-zinc-800 ring-zinc-600/20",
  duplicate: "bg-violet-50 text-violet-900 ring-violet-600/20",
};

export function PatientStatusBadge({ status }: { status: PatientStatusValue }) {
  const cls = STYLES[status] ?? STYLES.active;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {patientStatusLabel(status)}
    </span>
  );
}
