"use client";

import { useMemo, useState } from "react";
import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import { PatientImageArchiveButton } from "./PatientImageArchiveButton";
import { PatientImageEditPanel } from "./PatientImageEditPanel";
import { PatientImageGrid } from "./PatientImageGrid";
import { PatientImageUploadForm } from "./PatientImageUploadForm";
import { PatientImageCategoryBadge } from "./PatientImageCategoryBadge";

export function PatientImagesCard({ tenantId, data }: { tenantId: string; data: PatientProfileFoundationData }) {
  const patientId = data.foundationPatientId;
  const bundle = data.patientImages;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedTile = useMemo(
    () => bundle.activeWithSignedUrls.find((t) => t.image.id === selectedId) ?? null,
    [bundle.activeWithSignedUrls, selectedId]
  );

  return (
    <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
      <h2 className="text-sm font-semibold text-slate-100">Patient images</h2>
      <p className="mt-1 text-xs text-gray-500">
        Private visual record for this patient. Images are stored privately and viewed through secure signed URLs.
      </p>
      <p className="mt-2 text-xs text-slate-400">
        {bundle.counts.total} total · {bundle.counts.active} active · {bundle.counts.archived} archived
        {bundle.counts.active > bundle.activeWithSignedUrls.length ? (
          <span className="text-amber-700"> · showing latest {bundle.activeWithSignedUrls.length} active thumbnails</span>
        ) : null}
      </p>

      <div className="mt-4">
        <PatientImageUploadForm tenantId={tenantId} patientId={patientId} data={data} />
      </div>

      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Active images</h3>
        <div className="mt-2">
          <PatientImageGrid tiles={bundle.activeWithSignedUrls} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </div>

      {selectedTile ? (
        <div className="mt-4 space-y-2">
          <PatientImageEditPanel tenantId={tenantId} patientId={patientId} tile={selectedTile} onClose={() => setSelectedId(null)} />
          <PatientImageArchiveButton
            tenantId={tenantId}
            patientId={patientId}
            imageId={selectedTile.image.id}
            onDone={() => setSelectedId(null)}
          />
        </div>
      ) : null}

      <details className="mt-6 rounded border border-white/[0.06] bg-white/[0.03] p-3">
        <summary className="cursor-pointer text-xs font-medium text-slate-200">Archived images ({bundle.archived.length})</summary>
        <ul className="mt-2 space-y-2 text-xs text-slate-300">
          {bundle.archived.length === 0 ? <li className="text-gray-500">No archived images.</li> : null}
          {bundle.archived.map((img) => (
            <li key={img.id} className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-2 last:border-0">
              <PatientImageCategoryBadge category={img.image_category} />
              <span className="font-mono text-[10px] text-gray-500">{img.id.slice(0, 8)}…</span>
              {img.caption ? <span className="text-slate-200">{img.caption}</span> : null}
              {img.archived_at ? (
                <span className="text-gray-500">archived {img.archived_at.slice(0, 16).replace("T", " ")}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </details>

      <p className="mt-4 text-[11px] text-gray-500">
        Patient-native activity logging for image events is deferred; the server returns <code className="rounded bg-white/[0.06] px-0.5">changed_keys</code>{" "}
        for future audit streams. CRM activity is not written from this card.
      </p>
    </section>
  );
}
