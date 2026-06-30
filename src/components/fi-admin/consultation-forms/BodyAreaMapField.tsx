"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

import { cn } from "@/lib/utils";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { fiOsLightFormSurfaceClassNames } from "@/src/components/fi-design/fiDesignTokens";
import {
  BODY_AREA_MAP_LABEL_OPTIONS,
  BODY_AREA_MAP_SEVERITY_OPTIONS,
  BODY_AREA_MAP_TAG_OPTIONS,
  BODY_AREA_MAP_VIEWS,
  BODY_AREA_MAP_VIEW_LABELS,
  type BodyAreaMapAnnotation,
  type BodyAreaMapSeverity,
  type BodyAreaMapValue,
  type BodyAreaMapViewId,
  aggregateBodyAreaMapByRegionLabel,
  normalizeBodyAreaMapValue,
  viewDisplayForBodyAreaMap,
} from "@/src/lib/consultationForms/bodyAreaMapModel";

function WireframeSvg({ view }: { view: BodyAreaMapViewId }) {
  const common = "fill-none stroke-current stroke-[1.25] text-slate-500";
  switch (view) {
    case "frontal_hairline":
      return (
        <g className={common}>
          <ellipse cx="50" cy="58" rx="28" ry="34" />
          <path d="M 22 52 Q 50 28 78 52" />
          <path d="M 30 48 Q 50 38 70 48" strokeDasharray="2 2" opacity="0.7" />
        </g>
      );
    case "top_scalp":
      return (
        <g className={common}>
          <ellipse cx="50" cy="50" rx="36" ry="28" />
          <ellipse cx="50" cy="50" rx="22" ry="16" opacity="0.6" />
          <path d="M 50 22 L 50 78" strokeDasharray="3 3" opacity="0.5" />
          <path d="M 14 50 L 86 50" strokeDasharray="3 3" opacity="0.5" />
        </g>
      );
    case "crown":
      return (
        <g className={common}>
          <circle cx="50" cy="50" r="32" />
          <path d="M 50 18 Q 78 50 50 82 Q 22 50 50 18" opacity="0.7" />
          <circle cx="50" cy="50" r="6" strokeDasharray="2 2" />
        </g>
      );
    case "donor_back":
      return (
        <g className={common}>
          <path d="M 50 18 Q 78 40 76 70 Q 50 88 24 70 Q 22 40 50 18" />
          <path d="M 38 32 Q 50 26 62 32" />
          <path d="M 34 55 L 66 55" strokeDasharray="2 2" opacity="0.6" />
        </g>
      );
    case "beard_face":
      return (
        <g className={common}>
          <ellipse cx="50" cy="48" rx="26" ry="32" />
          <path d="M 28 52 Q 50 78 72 52" />
          <path d="M 36 58 Q 50 72 64 58" opacity="0.7" />
        </g>
      );
    case "eyebrows":
      return (
        <g className={common}>
          <ellipse cx="50" cy="52" rx="30" ry="26" />
          <path d="M 22 44 Q 34 36 46 44" />
          <path d="M 54 44 Q 66 36 78 44" />
          <path d="M 24 48 L 46 48" strokeWidth="1.8" />
          <path d="M 54 48 L 76 48" strokeWidth="1.8" />
        </g>
      );
    default:
      return null;
  }
}

function useAllowedViews(allowed?: readonly BodyAreaMapViewId[]): BodyAreaMapViewId[] {
  return useMemo(() => {
    if (!allowed?.length) return [...BODY_AREA_MAP_VIEWS];
    const set = new Set(BODY_AREA_MAP_VIEWS);
    return allowed.filter((v): v is BodyAreaMapViewId => set.has(v));
  }, [allowed]);
}

export function BodyAreaMapField({
  label,
  description,
  required,
  value,
  onChange,
  disabled,
  allowedViews: allowedViewsProp,
}: {
  label: string;
  description?: string | null;
  required?: boolean;
  value: unknown;
  onChange: (next: BodyAreaMapValue) => void;
  disabled: boolean;
  allowedViews?: readonly BodyAreaMapViewId[];
}) {
  const allowedViews = useAllowedViews(allowedViewsProp);
  const normalized = useMemo(
    () => normalizeBodyAreaMapValue(value, allowedViews),
    [value, allowedViews]
  );

  const [activeView, setActiveView] = useState<BodyAreaMapViewId>(() => {
    const n = normalizeBodyAreaMapValue(value, allowedViews);
    const v = n.view;
    return allowedViews.includes(v) ? v : (allowedViews[0] ?? "frontal_hairline");
  });

  useEffect(() => {
    if (allowedViews.includes(normalized.view)) setActiveView(normalized.view);
  }, [normalized.view, allowedViews]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const countsByView = useMemo(() => {
    const m = new Map<BodyAreaMapViewId, number>();
    for (const v of allowedViews) m.set(v, 0);
    for (const a of normalized.annotations) {
      m.set(a.view, (m.get(a.view) ?? 0) + 1);
    }
    return m;
  }, [normalized.annotations, allowedViews]);

  const markersForActive = useMemo(
    () => normalized.annotations.filter((a) => a.view === activeView),
    [normalized.annotations, activeView]
  );

  const selected = useMemo(
    () => normalized.annotations.find((a) => a.id === selectedId) ?? null,
    [normalized.annotations, selectedId]
  );

  const commit = useCallback(
    (next: BodyAreaMapValue) => {
      onChange(next);
    },
    [onChange]
  );

  const setView = useCallback(
    (v: BodyAreaMapViewId) => {
      setActiveView(v);
      setSelectedId(null);
      commit({ ...normalized, view: v });
    },
    [commit, normalized]
  );

  const addMarker = useCallback(
    (xPct: number, yPct: number) => {
      if (disabled) return;
      const id = (() => {
        try {
          const c = globalThis.crypto;
          if (c?.randomUUID) return c.randomUUID();
        } catch {
          /* ignore */
        }
        return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      })();
      const nextAnn: BodyAreaMapAnnotation = {
        id,
        view: activeView,
        x: xPct,
        y: yPct,
        label: BODY_AREA_MAP_LABEL_OPTIONS[0]?.value ?? "hairline_recession",
        severity: "not_assessed",
        tags: [],
        notes: "",
        createdAt: new Date().toISOString(),
      };
      commit({
        view: activeView,
        annotations: [...normalized.annotations, nextAnn],
      });
      setSelectedId(id);
    },
    [activeView, commit, disabled, normalized.annotations]
  );

  const onSvgPointerDown = useCallback(
    (e: PointerEvent<SVGSVGElement>) => {
      if (disabled) return;
      const el = svgRef.current;
      if (!el) return;
      const t = e.target as Element | null;
      if (t?.closest?.("[data-annotation-marker]")) return;

      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;
      addMarker(Math.min(100, Math.max(0, xPct)), Math.min(100, Math.max(0, yPct)));
    },
    [addMarker, disabled]
  );

  const updateSelected = useCallback(
    (patch: Partial<BodyAreaMapAnnotation>) => {
      if (!selectedId) return;
      commit({
        ...normalized,
        annotations: normalized.annotations.map((a) =>
          a.id === selectedId ? { ...a, ...patch } : a
        ),
      });
    },
    [commit, normalized, selectedId]
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    const next = normalized.annotations.filter((a) => a.id !== selectedId);
    commit({ ...normalized, annotations: next });
    setSelectedId(null);
  }, [commit, normalized, selectedId]);

  return (
    <div className="space-y-3">
      <div>
        <div className={fiOsLightFormSurfaceClassNames.labelInline}>
          {label}
          {required ? (
            <span className={fiOsLightFormSurfaceClassNames.requiredMark}> *</span>
          ) : null}
        </div>
        {description?.trim() ? (
          <p className={cn("mt-0.5", fiOsLightFormSurfaceClassNames.helper)}>{description}</p>
        ) : null}
      </div>

      <div role="tablist" aria-label="Wireframe view" className="flex flex-wrap gap-2">
        {allowedViews.map((v) => {
          const count = countsByView.get(v) ?? 0;
          const active = v === activeView;
          return (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(v)}
              className={cn(
                "min-h-[44px] min-w-[44px] touch-manipulation rounded-lg border px-3 py-2 text-left text-sm font-medium transition",
                active
                  ? "border-sky-500 bg-cyan-500/10 text-cyan-200"
                  : "border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md text-slate-200 hover:border-slate-700"
              )}
            >
              <span className="block leading-tight">{BODY_AREA_MAP_VIEW_LABELS[v]}</span>
              <span
                className={cn(
                  "mt-0.5 block text-xs font-normal",
                  fiOsLightFormSurfaceClassNames.meta
                )}
              >
                {count} marker{count === 1 ? "" : "s"}
              </span>
            </button>
          );
        })}
      </div>

      <FiCard className="overflow-hidden border border-white/[0.08] bg-white/[0.03] p-3">
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          className={cn(
            "aspect-square w-full max-w-md select-none rounded-lg bg-[#0F1629]/80 backdrop-blur-md",
            disabled ? "cursor-not-allowed opacity-70" : "cursor-crosshair"
          )}
          onPointerDown={onSvgPointerDown}
          role="img"
          aria-label={`Wireframe: ${viewDisplayForBodyAreaMap(activeView)}. Tap to add a marker.`}
        >
          <rect width="100" height="100" className="fill-white" />
          <WireframeSvg view={activeView} />
          {markersForActive.map((a) => {
            const sel = a.id === selectedId;
            return (
              <g
                key={a.id}
                data-annotation-marker
                transform={`translate(${a.x},${a.y})`}
                className="cursor-pointer"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelectedId(a.id);
                }}
              >
                <circle r="8" className="fill-transparent" />
                <circle
                  r={sel ? 4.2 : 3.2}
                  className={cn(
                    sel
                      ? "fill-sky-600 stroke-white stroke-1"
                      : "fill-amber-500 stroke-white stroke-1",
                    "drop-shadow-sm"
                  )}
                />
              </g>
            );
          })}
        </svg>
        {!disabled ? (
          <p className={cn("mt-2 text-center", fiOsLightFormSurfaceClassNames.meta)}>
            Tap the diagram to add a marker. Tap a marker to edit.
          </p>
        ) : null}
      </FiCard>

      {selected && !disabled ? (
        <FiCard className="space-y-3 border border-white/[0.08] p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-100">Edit marker</h4>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="min-h-[44px] rounded-lg px-3 text-sm text-slate-400 hover:bg-white/[0.06]"
            >
              Close
            </button>
          </div>
          <div className="space-y-1">
            <label className={fiOsLightFormSurfaceClassNames.compactLabel}>Label</label>
            <select
              className={cn("min-h-[44px]", fiOsLightFormSurfaceClassNames.controlInset)}
              value={selected.label}
              onChange={(e) => updateSelected({ label: e.target.value })}
            >
              {BODY_AREA_MAP_LABEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={fiOsLightFormSurfaceClassNames.compactLabel}>Severity</label>
            <select
              className={cn("min-h-[44px]", fiOsLightFormSurfaceClassNames.controlInset)}
              value={selected.severity}
              onChange={(e) => updateSelected({ severity: e.target.value as BodyAreaMapSeverity })}
            >
              {BODY_AREA_MAP_SEVERITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="space-y-2">
            <legend className={fiOsLightFormSurfaceClassNames.legendCompact}>Tags</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {BODY_AREA_MAP_TAG_OPTIONS.map((o) => {
                const on = selected.tags.includes(o.value);
                return (
                  <label
                    key={o.value}
                    className={cn(
                      fiOsLightFormSurfaceClassNames.choiceRow,
                      "min-h-[44px] rounded-lg border border-white/[0.08] px-2 py-1"
                    )}
                  >
                    <input
                      type="checkbox"
                      className={fiOsLightFormSurfaceClassNames.choiceCheckbox}
                      checked={on}
                      onChange={() => {
                        const next = new Set(selected.tags);
                        if (on) next.delete(o.value);
                        else next.add(o.value);
                        updateSelected({ tags: Array.from(next) });
                      }}
                    />
                    {o.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="space-y-1">
            <label className={fiOsLightFormSurfaceClassNames.compactLabel}>Notes</label>
            <textarea
              className={cn("min-h-[88px]", fiOsLightFormSurfaceClassNames.controlInset)}
              value={selected.notes}
              onChange={(e) => updateSelected({ notes: e.target.value })}
            />
          </div>
          <button
            type="button"
            onClick={deleteSelected}
            className="min-h-[44px] w-full rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/15"
          >
            Delete marker
          </button>
        </FiCard>
      ) : null}
    </div>
  );
}

/** Read-only summary of markers for submitted / locked forms. */
export function BodyAreaMapAnnotationsSummary({
  fieldLabel,
  value,
  allowedViews,
}: {
  fieldLabel: string;
  value: unknown;
  allowedViews?: readonly BodyAreaMapViewId[];
}) {
  const allowed = useAllowedViews(allowedViews);
  const { annotations } = normalizeBodyAreaMapValue(value, allowed);
  const byRegion = useMemo(() => aggregateBodyAreaMapByRegionLabel(annotations), [annotations]);
  if (annotations.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
        {fieldLabel.trim() ? (
          <>
            <span className="font-medium text-slate-200">{fieldLabel}:</span>{" "}
          </>
        ) : null}
        No markers recorded.
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
      {fieldLabel.trim() ? (
        <p className="text-sm font-semibold text-slate-100">{fieldLabel}</p>
      ) : null}
      <ul className="space-y-2">
        {byRegion.map((row) => (
          <li
            key={row.labelValue}
            className="rounded-md border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-3 py-2 text-sm text-slate-200"
          >
            <div className="font-medium text-slate-100">{row.labelDisplay}</div>
            <div className="mt-0.5 text-xs text-slate-400">
              {row.views.map((v) => viewDisplayForBodyAreaMap(v)).join(" · ")}
              {row.markerCount > 1 ? (
                <span className="text-slate-500"> · {row.markerCount} markers merged</span>
              ) : null}
            </div>
            <div className="mt-0.5 text-xs text-slate-400">
              Severity:{" "}
              <span className="font-medium capitalize">{row.severity.replace(/_/g, " ")}</span>
            </div>
            {row.combinedNotes.trim() ? (
              <div className="mt-1 text-xs text-slate-300">Notes: {row.combinedNotes.trim()}</div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
