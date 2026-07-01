"use client";

import { PatientSafeImagingExportCardView } from "@/src/components/fi-admin/imaging/PatientSafeImagingExportCard";
import { PatientPortalImageUpload } from "@/src/components/patient-portal/PatientPortalImageUpload";
import type { PatientSafeImagingExportCardWithPreview } from "@/src/lib/imaging-os/patientSafeImagingExportMapperCore";

export function PatientImagingPortalClient({
  tenantId,
  cards,
  canUpload,
}: {
  tenantId: string;
  cards: PatientSafeImagingExportCardWithPreview[];
  canUpload: boolean;
}) {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-100">Clinical photography</h1>
        <p className="text-sm text-slate-400">
          Upload follow-up progress photos or view redacted summaries shared by your clinic.
        </p>
      </header>

      {canUpload ? <PatientPortalImageUpload tenantId={tenantId} /> : null}

      {cards.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
          <p className="text-sm text-slate-300">
            No clinical photography summaries are available in your portal yet.
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
}