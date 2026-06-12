import Link from "next/link";

import { FiSection } from "@/src/components/fi-design/FiSection";
import { PatientTwinImagingGalleryClient } from "@/src/components/fi-admin/patientTwin/PatientTwinImagingGalleryClient";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

export function PatientTwinImagingCard({
  tenantId,
  patientId,
  twin,
}: {
  tenantId: string;
  patientId: string;
  twin: PatientTwinV1;
}) {
  const { imaging } = twin;
  const axes = Object.entries(imaging.by_library_axis).sort((a, b) => b[1] - a[1]);

  return (
    <FiSection
      surfaceVariant="darkGlass"
      headingId="patient-twin-imaging-heading"
      title="ImagingOS & AI gallery"
      description="Active clinical images by library axis; Hair Image Intelligence groups photos for Twin review. Opens ImagingOS for full capture workflows."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-2xl font-semibold text-white">{imaging.active_image_total}</p>
          <p className="text-xs text-[#94A3B8]">Active images on file</p>
          {imaging.latest_captured_at ? (
            <p className="mt-2 text-xs text-[#64748B]">
              Latest capture: {new Date(imaging.latest_captured_at).toLocaleString()}
            </p>
          ) : null}
        </div>
        <Link
          href={imaging.imaging_workspace_href}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/15"
        >
          Open ImagingOS
        </Link>
      </div>
      {axes.length === 0 ? (
        <p className="mt-3 text-sm text-[#94A3B8]">No active patient images yet — upload from ImagingOS or the patient profile.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {axes.map(([axis, count]) => (
            <li
              key={axis}
              className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm"
            >
              <span className="text-white/90">{axis.replace(/_/g, " ")}</span>
              <span className="text-xs text-[#94A3B8]">
                {count} image{count === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {imaging.gallery.items.length > 0 ? (
        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400/90">Most recent</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {imaging.gallery.items.slice(0, 8).map((img) => (
              <li key={img.id} className="h-16 w-16 overflow-hidden rounded-md ring-1 ring-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <PatientTwinImagingGalleryClient tenantId={tenantId} patientId={patientId} uiSections={imaging.gallery.ui_sections} />
    </FiSection>
  );
}
