"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { updatePatientImageDetailsAction } from "@/lib/actions/fi-patient-actions";
import { PATIENT_IMAGE_CATEGORIES } from "@/src/lib/patientImages/patientImagePolicy";
import type { PatientImageProfileTile } from "@/src/lib/patientImages/patientImageTypes";

function parseJsonObject(raw: string, label: string): Record<string, unknown> {
  const t = raw.trim();
  if (!t) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(t);
  } catch {
    throw new Error(`${label}: invalid JSON.`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PatientImageEditPanel({
  tenantId,
  patientId,
  tile,
  onClose,
}: {
  tenantId: string;
  patientId: string;
  tile: PatientImageProfileTile;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const initial = useMemo(
    () => ({
      image_category: tile.image.image_category,
      caption: tile.image.caption ?? "",
      taken_at: toDatetimeLocalValue(tile.image.taken_at),
      metadata: JSON.stringify(tile.image.metadata ?? {}, null, 2),
    }),
    [tile]
  );

  const [category, setCategory] = useState(initial.image_category);
  const [caption, setCaption] = useState(initial.caption);
  const [takenAt, setTakenAt] = useState(initial.taken_at);
  const [metadataStr, setMetadataStr] = useState(initial.metadata);

  useEffect(() => {
    setCategory(initial.image_category);
    setCaption(initial.caption);
    setTakenAt(initial.taken_at);
    setMetadataStr(initial.metadata);
  }, [initial]);

  const save = useCallback(() => {
    setMsg(null);
    startTransition(async () => {
      try {
        const metadata = parseJsonObject(metadataStr, "Metadata");
        const takenIso = takenAt.trim() ? new Date(takenAt).toISOString() : null;
        const res = await updatePatientImageDetailsAction(tenantId, patientId, tile.image.id, {
          image_category: category,
          caption: caption.trim() ? caption : null,
          taken_at: takenIso,
          metadata,
        });
        if (!res.ok) {
          setMsg(res.error);
          return;
        }
        setMsg("Saved.");
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }, [caption, category, metadataStr, patientId, router, takenAt, tenantId, tile.image.id]);

  return (
    <div className="rounded border border-blue-100 bg-blue-50/60 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-blue-950">Edit image</p>
        <button type="button" className="text-xs text-blue-800 hover:underline" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="block text-xs text-gray-800">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            {PATIENT_IMAGE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-800">
          Taken at
          <input
            type="datetime-local"
            value={takenAt}
            onChange={(e) => setTakenAt(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs text-gray-800 sm:col-span-2">
          Caption
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs text-gray-800 sm:col-span-2">
          Metadata (JSON object)
          <textarea
            rows={5}
            spellCheck={false}
            value={metadataStr}
            onChange={(e) => setMetadataStr(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 font-mono text-xs"
          />
        </label>
      </div>
      {msg ? <p className="mt-2 text-xs text-gray-800">{msg}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:bg-gray-400"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
