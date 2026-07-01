"use client";

import { PatientSafeImagingExportCardView } from "@/src/components/fi-admin/imaging/PatientSafeImagingExportCard";
import type { PatientSafeImagingExportCardWithPreview } from "@/src/lib/imaging-os/patientSafeImagingExportMapperCore";

export function PatientImagingPortalClient({
  cards,
}: {
  cards: PatientSafeImagingExportCardWithPreview[];
}) {
  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
        <p className="text-sm text-slate-300">No clinical photography is available in your portal yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-100">Clinical photography</h1>
        <p className="text-sm text-slate-400">
          Redacted status summary only — no diagnosis or treatment recommendations.
        </p>
      </header>
      <div className="grid gap-3">
        {cards.map((card) => (
          <div key={card.image_id} className="space-y-2">
            {card.preview_signed_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.preview_signed_url}
                alt=""
                className="h-32 w-full max-w-sm rounded-lg object-cover ring-1 ring-white/10"
              />
            ) : null}
            <PatientSafeImagingExportCardView card={card} />
          </div>
        ))}
      </div>
    </div>
  );
}