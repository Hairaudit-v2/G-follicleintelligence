"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PatientImageCategoryBadge } from "@/src/components/fi/patient-images/PatientImageCategoryBadge";
import { PatientImageGrid } from "@/src/components/fi/patient-images/PatientImageGrid";
import { PatientImageTile } from "@/src/components/fi/patient-images/PatientImageTile";
import type { PatientImageCategory, PatientImagesProfileBundle } from "@/src/lib/patientImages/patientImageTypes";
import { crmLeadCardClass } from "../shared";

const GALLERY_GROUPS: { id: string; label: string; categories: PatientImageCategory[] }[] = [
  { id: "before", label: "Before", categories: ["before"] },
  { id: "after", label: "After", categories: ["after"] },
  { id: "progress", label: "Progress", categories: ["progress", "post_op"] },
  { id: "clinical", label: "Clinical captures", categories: ["consult", "scalp", "donor", "hairline", "trichoscopy"] },
];

export function LeadPhotoGalleryPanel({
  tenantId,
  patientId,
  bundle,
}: {
  tenantId: string;
  patientId: string | null;
  bundle: PatientImagesProfileBundle | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tilesByGroup = useMemo(() => {
    const active = bundle?.activeWithSignedUrls ?? [];
    return GALLERY_GROUPS.map((g) => ({
      ...g,
      tiles: active.filter((t) => g.categories.includes(t.image.image_category)),
    }));
  }, [bundle]);

  if (!patientId) {
    return (
      <section className={crmLeadCardClass}>
        <h2 className="text-sm font-semibold text-slate-100">Before / after gallery</h2>
        <p className="mt-2 text-sm text-slate-400">Link a patient via conversion to attach tagged clinical photos.</p>
      </section>
    );
  }

  const selectedTile = bundle?.activeWithSignedUrls.find((t) => t.image.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <section className={crmLeadCardClass}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Before / after gallery</h2>
            <p className="mt-1 text-xs text-gray-500">
              Images are tagged by category on the patient record. Upload and edit on the patient profile.
            </p>
          </div>
          <Link href={`/fi-admin/${tenantId}/patients/${patientId}`} className="text-xs text-blue-600 hover:underline">
            Manage on patient →
          </Link>
        </div>
        {bundle ? (
          <p className="mt-2 text-xs text-slate-400">
            {bundle.counts.active} active · {bundle.counts.archived} archived
          </p>
        ) : null}
      </section>

      {tilesByGroup.map((group) => (
        <section key={group.id} className={crmLeadCardClass}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{group.label}</h3>
          <div className="mt-3">
            {group.tiles.length === 0 ? (
              <p className="text-sm text-gray-500">No {group.label.toLowerCase()} images tagged yet.</p>
            ) : (
              <PatientImageGrid tiles={group.tiles} selectedId={selectedId} onSelect={setSelectedId} />
            )}
          </div>
        </section>
      ))}

      {selectedTile ? (
        <section className={crmLeadCardClass}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Selected image</h3>
          <div className="mt-2 max-w-xs">
            <PatientImageTile tile={selectedTile} selected onSelect={() => setSelectedId(null)} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <PatientImageCategoryBadge category={selectedTile.image.image_category} />
            {selectedTile.image.caption ? <span>{selectedTile.image.caption}</span> : null}
            {selectedTile.image.taken_at ? <span className="text-gray-500">taken {selectedTile.image.taken_at}</span> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
