import type { PatientImageProfileTile } from "@/src/lib/patientImages/patientImageTypes";
import { PatientImageCategoryBadge } from "./PatientImageCategoryBadge";

export function PatientImageTile({
  tile,
  selected,
  onSelect,
}: {
  tile: PatientImageProfileTile;
  selected: boolean;
  onSelect: () => void;
}) {
  const cap = tile.image.caption?.trim();
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex flex-col overflow-hidden rounded border bg-white text-left shadow-sm transition ring-offset-1 hover:border-gray-400 ${
        selected ? "border-blue-500 ring-2 ring-blue-400" : "border-gray-200"
      }`}
    >
      <div className="relative aspect-square w-full bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tile.signed.url}
          alt={cap || "Patient image"}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      <div className="space-y-1 p-2">
        <PatientImageCategoryBadge category={tile.image.image_category} />
        {cap ? <p className="line-clamp-2 text-xs text-gray-700">{cap}</p> : null}
      </div>
    </button>
  );
}
