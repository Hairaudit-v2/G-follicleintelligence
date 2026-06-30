"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import {
  createImagingProtocolSessionAction,
  enqueueImagingAiJobAction,
  saveImagingAnnotationSetAction,
  saveImagingScalpMapAction,
} from "@/lib/actions/fi-imaging-actions";
import { ImagingGuidedCaptureWizard } from "@/src/components/fi-admin/imaging/ImagingGuidedCaptureWizard";
import { VieComparisonSuggestionsPanel } from "@/src/components/fi-admin/imaging/VieComparisonSuggestionsPanel";
import {
  IMAGING_AI_ANALYSIS_KINDS,
  IMAGING_COMPARE_PRESETS,
  IMAGING_LIBRARY_AXES,
} from "@/src/lib/imagingOs/imagingOsConstants";
import type { ImagingOsPatientPayload } from "@/src/lib/imagingOs/imagingOsLoad.server";
import type { PatientImageProfileTile } from "@/src/lib/patientImages/patientImageTypes";
import {
  parseImagingCaptureIntent,
  parseImagingWorkspaceTab,
  parsePatientPhotoQuickActionSource,
} from "@/src/lib/patientImages/patientImagingCaptureRoutes";

type TabId = "timeline" | "gallery" | "compare" | "protocols" | "scalp" | "annotate" | "capture";

function sortKeyMs(tile: PatientImageProfileTile): number {
  const t = tile.image.taken_at ?? tile.image.created_at;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : 0;
}

export function ImagingOsWorkspace({
  tenantId,
  patientId,
  initial,
}: {
  tenantId: string;
  patientId: string;
  initial: ImagingOsPatientPayload;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTab = parseImagingWorkspaceTab(searchParams.get("tab"));
  const captureIntent = parseImagingCaptureIntent(searchParams.get("intent"));
  const captureSource = parsePatientPhotoQuickActionSource(searchParams.get("source"));
  const [tab, setTab] = useState<TabId>(() =>
    urlTab === "capture" ? "capture" : urlTab === "compare" ? "compare" : "gallery"
  );
  const [axisFilter, setAxisFilter] = useState<string>("");
  const [adminKey, setAdminKey] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (urlTab === "capture") setTab("capture");
    if (urlTab === "compare") setTab("compare");
  }, [urlTab]);

  const [compareLeft, setCompareLeft] = useState("");
  const [compareRight, setCompareRight] = useState("");
  const [compareLayout, setCompareLayout] = useState<"side" | "overlay">("side");
  const [overlayPct, setOverlayPct] = useState(50);

  const [scalpJson, setScalpJson] = useState(() =>
    JSON.stringify(initial.scalpMaps[0]?.state_json ?? defaultScalpState(), null, 2)
  );
  const [scalpMapId, setScalpMapId] = useState<string | null>(initial.scalpMaps[0]?.id ?? null);

  const [annotateImageId, setAnnotateImageId] = useState(
    initial.bundle.activeWithSignedUrls[0]?.image.id ?? ""
  );
  const [annotateJson, setAnnotateJson] = useState(() => {
    const first = initial.bundle.activeWithSignedUrls[0]?.image.id;
    const ann = first ? initial.annotationsByImageId[first] : undefined;
    return JSON.stringify(ann?.payload ?? { elements: [] }, null, 2);
  });

  const tiles = useMemo(() => {
    const list = [...initial.bundle.activeWithSignedUrls];
    list.sort((a, b) => sortKeyMs(b) - sortKeyMs(a));
    if (!axisFilter) return list;
    return list.filter((t) => t.image.imaging_library_axis === axisFilter);
  }, [initial.bundle.activeWithSignedUrls, axisFilter]);

  useEffect(() => {
    if (tiles.length >= 2 && !compareLeft && !compareRight) {
      setCompareLeft(tiles[0]!.image.id);
      setCompareRight(tiles[1]!.image.id);
    }
  }, [tiles, compareLeft, compareRight]);

  const timelineTiles = useMemo(() => {
    const list = [...initial.bundle.activeWithSignedUrls];
    list.sort((a, b) => {
      const aMeta = a.image.metadata?.fi_image_timeline;
      const bMeta = b.image.metadata?.fi_image_timeline;
      const aOrder =
        aMeta &&
        typeof aMeta === "object" &&
        !Array.isArray(aMeta) &&
        typeof (aMeta as { sort_order?: unknown }).sort_order === "number"
          ? Number((aMeta as { sort_order: number }).sort_order)
          : null;
      const bOrder =
        bMeta &&
        typeof bMeta === "object" &&
        !Array.isArray(bMeta) &&
        typeof (bMeta as { sort_order?: unknown }).sort_order === "number"
          ? Number((bMeta as { sort_order: number }).sort_order)
          : null;
      if (aOrder != null && bOrder != null && aOrder !== bOrder) return aOrder - bOrder;
      return sortKeyMs(a) - sortKeyMs(b);
    });
    return list;
  }, [initial.bundle.activeWithSignedUrls]);

  const withAdmin = useCallback(
    <T extends Record<string, unknown>>(body: T): T & { adminKey?: string } => {
      const k = adminKey.trim();
      return k ? { ...body, adminKey: k } : body;
    },
    [adminKey]
  );

  const leftTile = tiles.find((t) => t.image.id === compareLeft) ?? tiles[0] ?? null;
  const rightTile = tiles.find((t) => t.image.id === compareRight) ?? tiles[1] ?? tiles[0] ?? null;

  const tilesById = useMemo(
    () => new Map(initial.bundle.activeWithSignedUrls.map((t) => [t.image.id, t])),
    [initial.bundle.activeWithSignedUrls]
  );

  const onSaveScalp = useCallback(() => {
    setMsg(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(scalpJson);
    } catch {
      setMsg("Scalp map JSON is invalid.");
      return;
    }
    startTransition(async () => {
      const res = await saveImagingScalpMapAction(
        tenantId,
        patientId,
        withAdmin({ mapId: scalpMapId, title: "Scalp map", stateJson: parsed })
      );
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      setScalpMapId(res.mapId);
      setMsg("Scalp map saved.");
      router.refresh();
    });
  }, [patientId, router, scalpJson, scalpMapId, tenantId, withAdmin]);

  const onSaveAnnotation = useCallback(() => {
    setMsg(null);
    if (!annotateImageId.trim()) {
      setMsg("Select an image to annotate.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(annotateJson);
    } catch {
      setMsg("Annotation JSON is invalid.");
      return;
    }
    startTransition(async () => {
      const res = await saveImagingAnnotationSetAction(
        tenantId,
        patientId,
        annotateImageId.trim(),
        withAdmin({ payload: parsed })
      );
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      setMsg("Annotation layer saved.");
      router.refresh();
    });
  }, [annotateImageId, annotateJson, patientId, router, tenantId, withAdmin]);

  const onCreateSession = useCallback(
    (templateSlug: string) => {
      setMsg(null);
      startTransition(async () => {
        const res = await createImagingProtocolSessionAction(
          tenantId,
          patientId,
          withAdmin({ templateSlug })
        );
        if (!res.ok) {
          setMsg(res.error);
          return;
        }
        setMsg("Protocol session created.");
        router.refresh();
      });
    },
    [patientId, router, tenantId, withAdmin]
  );

  const onEnqueueAi = useCallback(
    (imageId: string, analysisKind: (typeof IMAGING_AI_ANALYSIS_KINDS)[number]) => {
      setMsg(null);
      startTransition(async () => {
        const res = await enqueueImagingAiJobAction(
          tenantId,
          patientId,
          withAdmin({ patientImageId: imageId, analysisKind })
        );
        if (!res.ok) {
          setMsg(res.error);
          return;
        }
        setMsg(`Queued AI job ${res.jobId.slice(0, 8)}…`);
        router.refresh();
      });
    },
    [patientId, router, tenantId, withAdmin]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-white/[0.08] pb-3">
        {(
          [
            ["gallery", "Gallery"],
            ["timeline", "Timeline"],
            ["compare", "Compare"],
            ["protocols", "Protocols"],
            ["scalp", "Scalp map"],
            ["annotate", "Annotations"],
            ["capture", "Capture"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              tab === id
                ? "bg-gray-900 text-white"
                : "border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 text-slate-200 hover:bg-white/[0.03]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="block text-xs text-slate-400">
        Optional admin key (CRM write gate)
        <input
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          className="mt-1 block w-full max-w-md rounded border border-slate-700 px-2 py-1 font-mono text-xs"
          autoComplete="off"
        />
      </label>

      {msg ? <p className="text-sm text-slate-300">{msg}</p> : null}
      {pending ? <p className="text-xs text-gray-500">Working…</p> : null}

      {tab === "gallery" ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-300">Library axis</span>
            <select
              value={axisFilter}
              onChange={(e) => setAxisFilter(e.target.value)}
              className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-sm"
            >
              <option value="">All</option>
              {IMAGING_LIBRARY_AXES.map((a) => (
                <option key={a} value={a}>
                  {a.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {tiles.map((t) => (
              <figure
                key={t.image.id}
                className="overflow-hidden rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-lg shadow-black/40"
              >
                <div className="relative aspect-square bg-white/[0.06]">
                  <Image
                    src={t.signed.url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="200px"
                    unoptimized
                  />
                </div>
                <figcaption className="space-y-1 p-2 text-xs text-slate-300">
                  <p className="font-mono text-[10px] text-gray-500">{t.image.id.slice(0, 8)}…</p>
                  <p>
                    <span className="font-medium">{t.image.imaging_library_axis}</span>
                    {t.image.anatomical_region ? <span> · {t.image.anatomical_region}</span> : null}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {IMAGING_AI_ANALYSIS_KINDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-300 hover:bg-white/[0.08]"
                        onClick={() => onEnqueueAi(t.image.id, k)}
                      >
                        AI:{k.slice(0, 4)}
                      </button>
                    ))}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "timeline" ? (
        <ol className="relative space-y-4 border-l border-white/[0.08] pl-6">
          {timelineTiles.map((t) => {
            const timelineMeta = t.image.metadata?.fi_image_timeline;
            const label =
              timelineMeta &&
              typeof timelineMeta === "object" &&
              !Array.isArray(timelineMeta) &&
              typeof (timelineMeta as { label?: unknown }).label === "string"
                ? String((timelineMeta as { label: string }).label)
                : null;
            const imageType =
              timelineMeta &&
              typeof timelineMeta === "object" &&
              !Array.isArray(timelineMeta) &&
              typeof (timelineMeta as { image_type?: unknown }).image_type === "string"
                ? String((timelineMeta as { image_type: string }).image_type).replace(/_/g, " ")
                : null;
            return (
              <li key={t.image.id} className="text-sm">
                <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-gray-900" />
                <p className="font-medium text-slate-100">
                  {label ?? new Date(t.image.taken_at ?? t.image.created_at).toLocaleString()}
                </p>
                <p className="text-xs text-slate-400">
                  {imageType ? `${imageType} · ` : ""}
                  {t.image.imaging_library_axis}
                  {t.image.visit_type ? ` · ${t.image.visit_type}` : ""}
                  {t.image.follow_up_interval ? ` · ${t.image.follow_up_interval}` : ""}
                </p>
                <div className="relative mt-2 h-40 max-w-xs overflow-hidden rounded border border-white/[0.06] bg-white/[0.03]">
                  <Image
                    src={t.signed.url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="200px"
                    unoptimized
                  />
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}

      {tab === "compare" ? (
        <section className="space-y-8">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Suggested comparison pairs</h2>
            <p className="mt-1 text-xs text-slate-400">
              Auto-matched from accepted VIE protocol captures — metadata heuristics and same-angle
              alignment scoring (AI vision pending).
            </p>
            <div className="mt-4">
              <VieComparisonSuggestionsPanel
                tenantId={tenantId}
                patientId={patientId}
                pairs={initial.comparisonPairs}
                tilesById={tilesById}
                adminKey={adminKey}
                onReviewUpdated={() => router.refresh()}
              />
            </div>
          </div>

          <div className="border-t border-white/[0.08] pt-6">
            <h2 className="text-sm font-semibold text-slate-100">Manual compare</h2>
            <p className="mt-1 text-xs text-slate-400">
              {IMAGING_COMPARE_PRESETS.map((p) => p.label).join(" · ")} — pick any two active
              images.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-slate-300">
                Left / baseline
                <select
                  className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
                  value={compareLeft || leftTile?.image.id || ""}
                  onChange={(e) => setCompareLeft(e.target.value)}
                >
                  {tiles.map((t) => (
                    <option key={t.image.id} value={t.image.id}>
                      {t.image.imaging_library_axis} · {t.image.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-300">
                Right / current
                <select
                  className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
                  value={compareRight || rightTile?.image.id || ""}
                  onChange={(e) => setCompareRight(e.target.value)}
                >
                  {tiles.map((t) => (
                    <option key={t.image.id} value={t.image.id}>
                      {t.image.imaging_library_axis} · {t.image.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className={`rounded px-3 py-1 text-xs font-medium ${compareLayout === "side" ? "bg-gray-900 text-white" : "border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500"}`}
                onClick={() => setCompareLayout("side")}
              >
                Side-by-side
              </button>
              <button
                type="button"
                className={`rounded px-3 py-1 text-xs font-medium ${compareLayout === "overlay" ? "bg-gray-900 text-white" : "border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500"}`}
                onClick={() => setCompareLayout("overlay")}
              >
                Overlay
              </button>
            </div>
            {leftTile && rightTile && leftTile.image.id !== rightTile.image.id ? (
              compareLayout === "side" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="relative aspect-square overflow-hidden rounded border border-white/[0.08] bg-white/[0.06]">
                    <Image
                      src={leftTile.signed.url}
                      alt="Left"
                      fill
                      className="object-contain"
                      sizes="(max-width:768px) 100vw, 50vw"
                      unoptimized
                    />
                  </div>
                  <div className="relative aspect-square overflow-hidden rounded border border-white/[0.08] bg-white/[0.06]">
                    <Image
                      src={rightTile.signed.url}
                      alt="Right"
                      fill
                      className="object-contain"
                      sizes="(max-width:768px) 100vw, 50vw"
                      unoptimized
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={overlayPct}
                    onChange={(e) => setOverlayPct(Number(e.target.value))}
                    className="w-full max-w-md"
                  />
                  <div className="relative mx-auto aspect-square w-full max-w-lg overflow-hidden rounded border border-white/[0.08] bg-gray-900">
                    <Image
                      src={leftTile.signed.url}
                      alt=""
                      fill
                      className="object-contain"
                      sizes="600px"
                      unoptimized
                    />
                    <div
                      className="absolute inset-0"
                      style={{ clipPath: `inset(0 ${100 - overlayPct}% 0 0)` }}
                    >
                      <Image
                        src={rightTile.signed.url}
                        alt=""
                        fill
                        className="object-contain"
                        sizes="600px"
                        unoptimized
                      />
                    </div>
                  </div>
                </div>
              )
            ) : (
              <p className="text-sm text-slate-400">Select two different images to compare.</p>
            )}
          </div>
        </section>
      ) : null}

      {tab === "protocols" ? (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">Standard photography protocols</h2>
          <ul className="space-y-3">
            {initial.protocolTemplates.map((tpl) => {
              const session = initial.protocolSessions.find((s) => s.template_slug === tpl.slug);
              return (
                <li
                  key={tpl.slug}
                  className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-3 text-sm shadow-lg shadow-black/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-100">{tpl.name}</p>
                      <p className="text-xs text-slate-400">{tpl.description}</p>
                      <p className="mt-2 text-xs text-slate-300">
                        Required slots: {tpl.slots.filter((s) => s.required !== false).length} ·
                        Completion: {session ? `${session.completion_percent}%` : "— (no session)"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-800"
                      onClick={() => onCreateSession(tpl.slug)}
                    >
                      Start session
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {tab === "scalp" ? (
        <section className="space-y-3">
          <p className="text-xs text-slate-400">
            Wireframe reference (read-only). Persisted highlights/paths/notes live in JSON —
            interactive canvas can replace this layer later.
          </p>
          <ScalpWireframe className="max-w-md text-slate-200" />
          <label className="block text-xs font-medium text-slate-300">
            Map state (JSON)
            <textarea
              value={scalpJson}
              onChange={(e) => setScalpJson(e.target.value)}
              rows={12}
              spellCheck={false}
              className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 font-mono text-xs"
            />
          </label>
          <button
            type="button"
            onClick={onSaveScalp}
            disabled={pending}
            className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:bg-gray-400"
          >
            Save scalp map
          </button>
        </section>
      ) : null}

      {tab === "annotate" ? (
        <section className="space-y-3">
          <p className="text-xs text-slate-400">
            Vector annotation layer (arrows, circles, free draw, measurement, text). Stored in
            `fi_imaging_annotation_sets`, not on the original file.
          </p>
          <label className="block text-xs font-medium text-slate-300">
            Image
            <select
              value={annotateImageId}
              onChange={(e) => {
                const id = e.target.value;
                setAnnotateImageId(id);
                const ann = initial.annotationsByImageId[id];
                setAnnotateJson(JSON.stringify(ann?.payload ?? { elements: [] }, null, 2));
              }}
              className="mt-1 block w-full max-w-lg rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
            >
              {initial.bundle.activeWithSignedUrls.map((t) => (
                <option key={t.image.id} value={t.image.id}>
                  {t.image.id.slice(0, 8)}… ({t.image.imaging_library_axis})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-300">
            Payload JSON
            <textarea
              value={annotateJson}
              onChange={(e) => setAnnotateJson(e.target.value)}
              rows={14}
              spellCheck={false}
              className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 font-mono text-xs"
            />
          </label>
          <button
            type="button"
            onClick={onSaveAnnotation}
            disabled={pending}
            className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:bg-gray-400"
          >
            Save annotations
          </button>
        </section>
      ) : null}

      {tab === "capture" ? (
        <ImagingGuidedCaptureWizard
          tenantId={tenantId}
          patientId={patientId}
          adminKey={adminKey}
          initial={initial}
          captureIntent={captureIntent}
          captureSource={captureSource}
        />
      ) : null}
    </div>
  );
}

function defaultScalpState(): Record<string, unknown> {
  return {
    wireframeVersion: "v1",
    highlightedRegions: [] as string[],
    paths: [] as unknown[],
    notes: [] as unknown[],
  };
}

function ScalpWireframe({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 260" className={className} aria-label="Scalp wireframe outline">
      <title>Scalp wireframe</title>
      <ellipse
        cx="100"
        cy="120"
        rx="78"
        ry="98"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M 40 110 Q 100 40 160 110" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <line
        x1="100"
        y1="22"
        x2="100"
        y2="218"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeDasharray="4 3"
        opacity="0.5"
      />
      <line
        x1="30"
        y1="120"
        x2="170"
        y2="120"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeDasharray="4 3"
        opacity="0.5"
      />
      <text x="100" y="248" textAnchor="middle" className="fill-current text-[8px]">
        Regions: hairline · frontal · midscalp · crown · donor · temples
      </text>
    </svg>
  );
}
