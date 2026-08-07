"use client";

import type { AllocationMapViewModel } from "@/src/lib/cases/surgeryProjection/allocationMapModel";
import {
  polygonToSvgPoints,
  resolveZonePolygon,
  zoneFillColor,
} from "@/src/lib/cases/surgeryProjection/allocationMapModel";

const VIEW_W = 480;
const VIEW_H = 560;

export function AllocationMapTab({ model }: { model: AllocationMapViewModel }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div className="relative overflow-hidden rounded border border-white/[0.08] bg-[#020617]">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-auto w-full max-w-xl"
          role="img"
          aria-label={model.patientSafeLabel}
        >
          <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#0b1220" />
          <ellipse
            cx={VIEW_W / 2}
            cy={VIEW_H * 0.52}
            rx={VIEW_W * 0.32}
            ry={VIEW_H * 0.38}
            fill="#1e293b"
            stroke="#334155"
          />
          {model.zones.map((zone, i) => {
            const poly = resolveZonePolygon(zone);
            const deferred = Boolean(zone.deferred);
            return (
              <g key={`${zone.key}-${i}`}>
                <polygon
                  points={polygonToSvgPoints(poly, VIEW_W, VIEW_H)}
                  fill={deferred ? "rgba(100,116,139,0.25)" : zoneFillColor(i)}
                  stroke={deferred ? "#94a3b8" : "#e2e8f0"}
                  strokeWidth={1.5}
                  strokeDasharray={deferred ? "4 3" : undefined}
                />
                <text
                  x={poly.reduce((s, p) => s + p.x, 0) / poly.length * VIEW_W}
                  y={poly.reduce((s, p) => s + p.y, 0) / poly.length * VIEW_H}
                  textAnchor="middle"
                  className="fill-slate-100"
                  style={{ fontSize: 11 }}
                >
                  {zone.label || zone.key}
                  {zone.grafts != null ? ` · ${zone.grafts}` : ""}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="absolute bottom-2 left-2 right-2 text-[10px] text-slate-400">
          {model.patientSafeLabel} · {model.planVersionLabel}
          {model.sourceImageRef
            ? " · bound to plan (geometry photo-overlay when image URL available)"
            : " · schematic scalp view until source photograph is bound"}
        </p>
      </div>

      <div className="space-y-3 text-xs text-slate-300">
        <div>
          <div className="text-slate-500">Total grafts (zones)</div>
          <div className="text-lg font-semibold text-slate-100">{model.totalGrafts || "—"}</div>
          {(model.estimatedGraftsMin != null || model.estimatedGraftsMax != null) && (
            <div className="text-slate-400">
              Plan range: {model.estimatedGraftsMin ?? "?"}–{model.estimatedGraftsMax ?? "?"}
            </div>
          )}
        </div>
        <div>
          <div className="text-slate-500">Plan status</div>
          <div>{model.planningStatus ?? "none"}</div>
        </div>
        {model.deferredZones.length > 0 ? (
          <div>
            <div className="text-slate-500">Deferred</div>
            <div>{model.deferredZones.join(", ")}</div>
          </div>
        ) : null}
        {model.warnings.length > 0 ? (
          <ul className="space-y-1 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-amber-100">
            {model.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : (
          <p className="text-emerald-300/90">Zone graft counts and densities present where set.</p>
        )}
        <p className="text-[10px] text-slate-500">
          Artifact type: graft_allocation_map — clinical planning only. Not an illustrative projected
          outcome.
        </p>
      </div>
    </div>
  );
}
