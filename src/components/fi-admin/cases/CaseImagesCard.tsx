import Link from "next/link";
import type { CaseImageListItem } from "@/src/lib/cases/caseLoaders";
import {
  CASE_DETAIL_SECTION_IDS,
  caseDetailSectionHeadingId,
} from "@/src/lib/cases/caseDetailNavConstants";

export function CaseImagesCard({
  tenantId,
  patientId,
  images,
}: {
  tenantId: string;
  patientId: string | null;
  images: CaseImageListItem[];
}) {
  return (
    <div className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id={caseDetailSectionHeadingId(CASE_DETAIL_SECTION_IDS.images)}
          className="text-sm font-semibold text-slate-100"
        >
          Linked patient images
        </h2>
        {patientId ? (
          <Link
            href={`/fi-admin/${tenantId}/patients/${patientId}`}
            className="text-xs text-blue-300 hover:underline"
          >
            Patient images
          </Link>
        ) : null}
      </div>
      {images.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">
          No patient images are tagged with this clinical patient.
        </p>
      ) : (
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
          {images.map((im) => (
            <li
              key={im.id}
              className="rounded border border-white/[0.06] bg-white/[0.03] px-2 py-1.5"
            >
              <div className="font-medium text-slate-100">
                {im.image_category}
                <span className="ml-2 text-xs font-normal text-gray-500">{im.image_status}</span>
              </div>
              {im.caption ? <div className="text-xs text-slate-400">{im.caption}</div> : null}
              <div className="mt-0.5 font-mono text-[10px] text-gray-400">
                {im.storage_path.slice(-64)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
