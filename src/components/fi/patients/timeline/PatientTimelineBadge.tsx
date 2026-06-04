import type { PatientTimelineSourceType } from "@/src/lib/patients/timeline/patientTimelineTypes";
import { patientTimelineSourceLabel } from "@/src/lib/patients/timeline/patientTimelineLabels";
import { cn } from "@/lib/utils";

const SOURCE_STYLES: Record<PatientTimelineSourceType, string> = {
  patient: "bg-violet-100 text-violet-900",
  lead: "bg-sky-100 text-sky-900",
  crm_activity: "bg-amber-100 text-amber-950",
  booking: "bg-emerald-100 text-emerald-900",
  case: "bg-indigo-100 text-indigo-900",
  clinical: "bg-rose-100 text-rose-900",
  image: "bg-teal-100 text-teal-900",
  system: "bg-gray-100 text-gray-800",
};

export function PatientTimelineBadge({ sourceType }: { sourceType: PatientTimelineSourceType }) {
  const label = patientTimelineSourceLabel(sourceType);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        SOURCE_STYLES[sourceType] ?? "bg-gray-100 text-gray-800"
      )}
    >
      {label}
    </span>
  );
}
