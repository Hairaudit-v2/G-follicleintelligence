import type { PatientImageProfileTile } from "@/src/lib/patientImages/patientImageTypes";
import { PatientImageTile } from "./PatientImageTile";

export function PatientImageGrid({
  tiles,
  selectedId,
  onSelect,
}: {
  tiles: PatientImageProfileTile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (tiles.length === 0) {
    return <p className="text-sm text-gray-500">No active images yet.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {tiles.map((t) => (
        <PatientImageTile
          key={t.image.id}
          tile={t}
          selected={selectedId === t.image.id}
          onSelect={() => onSelect(t.image.id)}
        />
      ))}
    </div>
  );
}
