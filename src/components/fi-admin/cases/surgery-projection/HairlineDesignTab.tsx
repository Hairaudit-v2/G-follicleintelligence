"use client";

import { useMemo, useState } from "react";
import type { CaseSurgeryPlanRow } from "@/src/lib/cases/surgeryPlanningLoaders";
import type { CaseImageListItem } from "@/src/lib/cases/caseLoaders";
import type { HairlineDesignRow } from "@/src/lib/cases/surgeryProjection/hairlineDomain";
import { buildHairlinePolylineFromControls } from "@/src/lib/cases/surgeryProjection/hairlineDomain";
import {
  fiApproveHairlineAction,
  fiCreateHairlineDesignAction,
  fiRejectHairlineAction,
  fiSubmitHairlineAction,
  fiUpdateHairlineGeometryAction,
} from "@/lib/actions/fi-hairline-design-actions";

const VIEW_W = 480;
const VIEW_H = 560;

function createChecksumPlaceholder(ref: string): string {
  // Client-safe placeholder until bytes are hashed server-side on create.
  let h = 0;
  for (let i = 0; i < ref.length; i++) h = (h * 31 + ref.charCodeAt(i)) >>> 0;
  return `pending-${h.toString(16).padStart(8, "0")}`;
}

export function HairlineDesignTab({
  tenantId,
  caseId,
  plan,
  design,
  designs,
  images,
  actorUserId,
  pending,
  startTransition,
}: {
  tenantId: string;
  caseId: string;
  plan: CaseSurgeryPlanRow | null;
  design: HairlineDesignRow | null;
  designs: HairlineDesignRow[];
  images: CaseImageListItem[];
  actorUserId: string | null;
  pending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const geometry = design?.geometry;
  const polyline = useMemo(() => {
    if (geometry?.polylineNorm?.length) return geometry.polylineNorm;
    return buildHairlinePolylineFromControls({
      centralHeightNorm: 0.28,
      leftRecessionNorm: 0.22,
      rightRecessionNorm: 0.22,
      symmetryBias: 0,
      temporalTransitionLeft: 0.35,
      temporalTransitionRight: 0.35,
      macroIrregularity: 0.25,
      anteriorTransitionDepth: 0.12,
    });
  }, [geometry]);

  const points = polyline.map((p) => `${p.x * VIEW_W},${p.y * VIEW_H}`).join(" ");

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      setMessage(null);
      const result = await action();
      setMessage(result.ok ? "Saved." : result.error ?? "Failed");
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="relative overflow-hidden rounded border border-white/[0.08] bg-[#020617]">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-auto w-full max-w-xl" role="img">
          <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#0b1220" />
          <ellipse
            cx={VIEW_W / 2}
            cy={VIEW_H * 0.55}
            rx={VIEW_W * 0.3}
            ry={VIEW_H * 0.36}
            fill="#1e293b"
            stroke="#475569"
          />
          <polyline
            points={points}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {polyline.map((p, i) => (
            <circle
              key={i}
              cx={p.x * VIEW_W}
              cy={p.y * VIEW_H}
              r={3}
              fill="#e0f2fe"
            />
          ))}
        </svg>
        <p className="absolute bottom-2 left-2 text-[10px] text-slate-400">
          Proposed hairline design — line rendered on photograph frame
          {design ? ` · v${design.designVersion} · ${design.status}` : " · no version yet"}
        </p>
      </div>

      <div className="space-y-3 text-xs">
        {!plan ? (
          <p className="text-amber-200">Create and save a surgical plan before hairline design.</p>
        ) : null}

        {!design ? (
          <button
            type="button"
            disabled={!plan || pending || images.length === 0}
            onClick={() => {
              if (!plan) return;
              const image = images[0];
              if (!image) {
                setMessage("Link a patient source photograph first.");
                return;
              }
              run(async () => {
                const r = await fiCreateHairlineDesignAction({
                  tenantId,
                  caseId,
                  surgicalPlanId: plan.id,
                  sourceImageRef: image.storage_path,
                  sourceImageChecksum: createChecksumPlaceholder(image.storage_path),
                  sourceImageId: image.id,
                  authorUserId: actorUserId,
                });
                return r.ok ? { ok: true } : { ok: false, error: r.error };
              });
            }}
            className="rounded border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sky-100 disabled:opacity-40"
          >
            Create photo-bound hairline v1
          </button>
        ) : null}

        {design && (design.status === "draft" || design.status === "awaiting_review") ? (
          <div className="space-y-2">
            {(
              [
                ["centralHeightNorm", "Central height"],
                ["leftRecessionNorm", "Left recession"],
                ["rightRecessionNorm", "Right recession"],
                ["symmetryBias", "Symmetry bias (−1…1)"],
                ["temporalTransitionLeft", "Temporal transition L"],
                ["temporalTransitionRight", "Temporal transition R"],
                ["macroIrregularity", "Macro-irregularity"],
                ["anteriorTransitionDepth", "Anterior transition depth"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-slate-400">
                {label}
                <input
                  type="range"
                  min={key === "symmetryBias" ? -1 : 0}
                  max={1}
                  step={0.01}
                  defaultValue={design.geometry[key]}
                  onMouseUp={(e) => {
                    const value = Number((e.target as HTMLInputElement).value);
                    run(async () =>
                      fiUpdateHairlineGeometryAction({
                        tenantId,
                        caseId,
                        designId: design.id,
                        patch: { [key]: value },
                        actorUserId,
                      })
                    );
                  }}
                  className="mt-1 w-full"
                />
              </label>
            ))}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(async () =>
                    fiSubmitHairlineAction({
                      tenantId,
                      caseId,
                      designId: design.id,
                      actorUserId,
                    })
                  )
                }
                className="rounded border border-slate-600 px-2 py-1 text-slate-200"
              >
                Submit for review
              </button>
              <button
                type="button"
                disabled={pending || !actorUserId}
                onClick={() =>
                  run(async () =>
                    fiApproveHairlineAction({
                      tenantId,
                      caseId,
                      designId: design.id,
                      actorUserId: actorUserId!,
                    })
                  )
                }
                className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-100"
              >
                Approve (shows line on photo)
              </button>
              <button
                type="button"
                disabled={pending || !actorUserId}
                onClick={() =>
                  run(async () =>
                    fiRejectHairlineAction({
                      tenantId,
                      caseId,
                      designId: design.id,
                      actorUserId: actorUserId!,
                      reason: "Requires redesign",
                    })
                  )
                }
                className="rounded border border-rose-500/40 px-2 py-1 text-rose-100"
              >
                Reject design
              </button>
            </div>
          </div>
        ) : null}

        {design?.status === "approved" ? (
          <p className="text-emerald-300">
            Approved hairline v{design.designVersion} — generation prerequisite met. Rejecting a
            projection later will not revoke this hairline or the surgical plan.
          </p>
        ) : null}

        {designs.length > 1 ? (
          <div className="text-slate-500">
            Versions:{" "}
            {designs
              .map((d) => `v${d.designVersion}(${d.status})`)
              .join(" · ")}
          </div>
        ) : null}

        {images.length === 0 ? (
          <p className="text-amber-200">No linked patient images — cannot bind a photograph yet.</p>
        ) : null}
        {message ? <p className="text-slate-300">{message}</p> : null}
      </div>
    </div>
  );
}
