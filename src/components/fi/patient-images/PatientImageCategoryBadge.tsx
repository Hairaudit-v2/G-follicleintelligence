import { PATIENT_IMAGE_CATEGORY_LABELS } from "@/src/lib/patientImages/patientImageLabels";
import type { PatientImageCategory } from "@/src/lib/patientImages/patientImageTypes";

export function PatientImageCategoryBadge({ category }: { category: PatientImageCategory }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-800 ring-1 ring-inset ring-slate-400/30">
      {PATIENT_IMAGE_CATEGORY_LABELS[category]}
    </span>
  );
}
