import type { PatientTimelineSourceType } from "@/src/lib/patients/timeline/patientTimelineTypes";
import { patientTimelineSourceLabel } from "@/src/lib/patients/timeline/patientTimelineLabels";
import { cn } from "@/lib/utils";

const SOURCE_STYLES: Record<PatientTimelineSourceType, string> = {
  patient: "bg-violet-500/15 text-violet-300",
  lead: "bg-cyan-500/15 text-cyan-200",
  crm_activity: "bg-amber-400/15 text-amber-200",
  booking: "bg-emerald-500/15 text-emerald-300",
  case: "bg-indigo-500/15 text-indigo-300",
  clinical: "bg-rose-500/15 text-rose-300",
  image: "bg-teal-100 text-teal-900",
  system: "bg-white/[0.06] text-slate-200",
};

export function PatientTimelineBadge({ sourceType }: { sourceType: PatientTimelineSourceType }) {
  const label = patientTimelineSourceLabel(sourceType);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        SOURCE_STYLES[sourceType] ?? "bg-white/[0.06] text-slate-200"
      )}
    >
      {label}
    </span>
  );
}
