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
      className={`group relative flex flex-col overflow-hidden rounded border bg-[#0F1629]/80 backdrop-blur-md text-left shadow-lg shadow-black/40 transition ring-offset-1 hover:border-gray-400 ${
        selected ? "border-blue-500 ring-2 ring-blue-400" : "border-white/[0.08]"
      }`}
    >
      <div className="relative aspect-square w-full bg-white/[0.06]">
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
        {cap ? <p className="line-clamp-2 text-xs text-slate-300">{cap}</p> : null}
      </div>
    </button>
  );
}
