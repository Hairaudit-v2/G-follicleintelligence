import Link from "next/link";
import type { CaseImageListItem } from "@/src/lib/cases/caseLoaders";

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
    <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Linked patient images</h2>
        {patientId ? (
          <Link href={`/fi-admin/${tenantId}/patients/${patientId}`} className="text-xs text-blue-600 hover:underline">
            Patient images
          </Link>
        ) : null}
      </div>
      {images.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No patient images are tagged with this case.</p>
      ) : (
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
          {images.map((im) => (
            <li key={im.id} className="rounded border border-gray-100 bg-gray-50/80 px-2 py-1.5">
              <div className="font-medium text-gray-900">
                {im.image_category}
                <span className="ml-2 text-xs font-normal text-gray-500">{im.image_status}</span>
              </div>
              {im.caption ? <div className="text-xs text-gray-600">{im.caption}</div> : null}
              <div className="mt-0.5 font-mono text-[10px] text-gray-400">{im.storage_path.slice(-64)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
