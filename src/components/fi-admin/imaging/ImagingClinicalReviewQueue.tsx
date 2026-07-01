"use client";

import Link from "next/link";
import type { ImagingClinicalReviewQueueItem } from "@/src/lib/imaging-os/imagingClinicalReviewQueue.server";

const REASON_LABELS: Record<string, string> = {
  low_classification_confidence: "Low classification confidence",
  poor_quality_metadata: "Quality needs review",
  missing_scalp_region: "Missing scalp region",
  missing_donor_scalp_region: "Missing donor scalp region",
  missing_recipient_scalp_region: "Missing recipient scalp region",
  failed_live_analysis: "Live analysis failed",
  possible_duplicate: "Possible duplicate",
  donor_assessment_needs_review: "Donor assessment needs review",
  recipient_assessment_needs_review: "Recipient assessment needs review",
  admin_fallback_missing_region: "Admin fallback — region missing",
  openai_not_configured: "AI provider unavailable",
};

function formatReason(reason: string): string {
  return REASON_LABELS[reason] ?? reason.replace(/_/g, " ");
}

type Props = {
  tenantId: string;
  items: ImagingClinicalReviewQueueItem[];
};

export function ImagingClinicalReviewQueue({ tenantId, items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-[#0F1629]/60 p-8 text-center">
        <p className="text-sm text-slate-400">No images currently require staff review.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#0F1629]/60">
      <table className="min-w-full divide-y divide-white/[0.06] text-sm">
        <thead className="bg-white/[0.03] text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-4 py-3">Preview</th>
            <th className="px-4 py-3">Patient</th>
            <th className="px-4 py-3">View</th>
            <th className="px-4 py-3">Quality</th>
            <th className="px-4 py-3">Confidence</th>
            <th className="px-4 py-3">Review reasons</th>
            <th className="px-4 py-3">Captured</th>
            <th className="px-4 py-3">Links</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04] text-slate-200">
          {items.map((item) => {
            const imagingHref = `/fi-admin/${tenantId}/patients/${item.patientId}/imaging`;
            const profileHref = `/fi-admin/${tenantId}/patients/${item.patientId}`;
            return (
              <tr key={item.imageId} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  {item.previewSignedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.previewSignedUrl}
                      alt=""
                      className="h-14 w-14 rounded object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded bg-white/5 text-[10px] text-slate-500">
                      No preview
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{item.patientLabel ?? "Patient"}</div>
                  <div className="text-xs text-slate-500">{item.patientId.slice(0, 8)}…</div>
                </td>
                <td className="px-4 py-3">
                  <div>{item.viewType ?? "—"}</div>
                  <div className="text-xs text-slate-500">{item.captureSource ?? "unknown"}</div>
                </td>
                <td className="px-4 py-3 capitalize">{item.qualityStatus ?? "—"}</td>
                <td className="px-4 py-3">
                  {item.classificationConfidence != null
                    ? `${Math.round(item.classificationConfidence * 100)}%`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <ul className="space-y-0.5 text-xs text-amber-200/90">
                    {item.reviewReasons.map((r) => (
                      <li key={r}>{formatReason(r)}</li>
                    ))}
                  </ul>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {new Date(item.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1 text-xs">
                    <Link href={imagingHref} className="text-sky-400 hover:text-sky-300">
                      Imaging workspace
                    </Link>
                    <Link href={profileHref} className="text-slate-400 hover:text-slate-300">
                      Patient profile
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-white/[0.06] px-4 py-3 text-xs text-slate-500">
        Read-only queue for Phase 3. Mark reviewed / retake actions planned for a follow-up phase.
      </p>
    </div>
  );
}