"use client";

import { useMemo, useState } from "react";
import type {
  PatientImageProfileTile,
  PatientImagesProfileBundle,
} from "@/src/lib/patientImages/patientImageTypes";
import { PatientImageCategoryBadge } from "@/src/components/fi/patient-images/PatientImageCategoryBadge";
import { crmLeadCardClass } from "@/src/components/fi/crm/shared/crmSharedStyles";

/** Before / after comparison viewer — side-by-side panes plus draggable slider overlay. */
export function PatientProgressCompare({ bundle }: { bundle: PatientImagesProfileBundle }) {
  const beforeTiles = useMemo(
    () => bundle.activeWithSignedUrls.filter((t) => t.image.image_category === "before"),
    [bundle]
  );
  const afterTiles = useMemo(
    () => bundle.activeWithSignedUrls.filter((t) => t.image.image_category === "after"),
    [bundle]
  );

  const [beforeId, setBeforeId] = useState(beforeTiles[0]?.image.id ?? "");
  const [afterId, setAfterId] = useState(afterTiles[0]?.image.id ?? "");
  const [slider, setSlider] = useState(50);

  const beforeTile = beforeTiles.find((t) => t.image.id === beforeId) ?? beforeTiles[0] ?? null;
  const afterTile = afterTiles.find((t) => t.image.id === afterId) ?? afterTiles[0] ?? null;

  if (beforeTiles.length === 0 && afterTiles.length === 0) {
    return (
      <section className={crmLeadCardClass}>
        <h2 className="text-sm font-semibold text-slate-100">Before / after compare</h2>
        <p className="mt-2 text-sm text-slate-400">
          Tag images as <strong>before</strong> and <strong>after</strong> to use the comparison
          viewer.
        </p>
      </section>
    );
  }

  return (
    <section className={crmLeadCardClass}>
      <h2 className="text-sm font-semibold text-slate-100">Before / after compare</h2>
      <p className="mt-1 text-xs text-slate-400">
        Side-by-side or drag the slider to compare progress photos.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-300">
          Before
          <select
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
            value={beforeId}
            onChange={(e) => setBeforeId(e.target.value)}
          >
            {beforeTiles.length === 0 ? <option value="">No before images</option> : null}
            {beforeTiles.map((t) => (
              <option key={t.image.id} value={t.image.id}>
                {t.image.caption?.trim() || t.image.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          After
          <select
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
            value={afterId}
            onChange={(e) => setAfterId(e.target.value)}
          >
            {afterTiles.length === 0 ? <option value="">No after images</option> : null}
            {afterTiles.map((t) => (
              <option key={t.image.id} value={t.image.id}>
                {t.image.caption?.trim() || t.image.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {beforeTile && afterTile ? (
        <>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ComparePane label="Before" tile={beforeTile} />
            <ComparePane label="After" tile={afterTile} />
          </div>

          <div className="relative mt-4 aspect-[4/3] max-w-xl overflow-hidden rounded border border-white/[0.08] bg-white/[0.06]">
            {beforeTile.signed?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={beforeTile.signed.url}
                alt="Before"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}
            {afterTile.signed?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={afterTile.signed.url}
                alt="After"
                className="absolute inset-0 h-full w-full object-cover"
                style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }}
              />
            ) : null}
            <div
              className="pointer-events-none absolute inset-y-0 w-0.5 bg-[#0F1629]/80 backdrop-blur-md shadow"
              style={{ left: `${slider}%` }}
              aria-hidden
            />
          </div>
          <label className="mt-2 flex max-w-xl items-center gap-2 text-xs text-slate-400">
            Slider
            <input
              type="range"
              min={0}
              max={100}
              value={slider}
              onChange={(e) => setSlider(Number(e.target.value))}
              className="flex-1"
            />
          </label>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-400">
          Select both a before and an after image to compare.
        </p>
      )}
    </section>
  );
}

function ComparePane({ label, tile }: { label: string; tile: PatientImageProfileTile }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-2 aspect-[4/3] overflow-hidden rounded border border-white/[0.08] bg-white/[0.03]">
        {tile.signed?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tile.signed.url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            No preview
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
        <PatientImageCategoryBadge category={tile.image.image_category as "before"} />
        {tile.image.caption ? <span>{tile.image.caption}</span> : null}
      </div>
    </div>
  );
}
