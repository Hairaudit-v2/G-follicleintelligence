"use client";

import { cn } from "@/lib/utils";
import type {
  ConsultationRepairAnnotationTag,
  ConsultationScalpZoneId,
} from "@/src/lib/consultationForms/visualAssessment/consultationVisualAssessmentModel";

/** Egg-shaped head silhouette, top-down. Narrow at the front (forehead/nose), wider over the crown/occiput. */
const HEAD_PATH =
  "M200 62 C268 64 330 122 336 236 C341 330 284 410 200 414 C116 410 59 330 64 236 C70 122 132 64 200 62 Z";

/** Draw order: back / broad regions first so the lateral + crown zones stay clickable on top. */
const ZONE_DRAW_ORDER: ConsultationScalpZoneId[] = [
  "donor_safe_zone",
  "occipital",
  "temporal_left",
  "temporal_right",
  "mid_scalp",
  "crown",
  "frontal",
];

/**
 * Zone regions (top-down, FRONT = top where the nose is). Every region is clipped to the head
 * silhouette (`#scalpHead`), so simple polygons read as anatomical zones that follow the scalp edge.
 */
const ZONE_PATHS: Record<ConsultationScalpZoneId, string> = {
  frontal: "M132 70 L268 70 L272 150 L128 150 Z",
  temporal_left: "M58 108 L128 150 L138 268 L58 268 Z",
  temporal_right: "M342 108 L272 150 L262 268 L342 268 Z",
  mid_scalp: "M130 152 L270 152 L260 246 L140 246 Z",
  crown: "M150 248 L250 248 L262 312 L138 312 Z",
  occipital: "M104 314 L296 314 L280 374 L120 374 Z",
  donor_safe_zone: "M120 376 L280 376 L246 414 L154 414 Z",
};

const ZONE_LABELS: Record<ConsultationScalpZoneId, string> = {
  frontal: "Frontal",
  crown: "Crown",
  temporal_left: "L temp",
  temporal_right: "R temp",
  mid_scalp: "Mid",
  occipital: "Occipital",
  donor_safe_zone: "Donor",
};

/** Label anchor per zone (centre of the region). */
const ZONE_LABEL_POS: Record<ConsultationScalpZoneId, { x: number; y: number }> = {
  frontal: { x: 200, y: 116 },
  temporal_left: { x: 97, y: 200 },
  temporal_right: { x: 303, y: 200 },
  mid_scalp: { x: 200, y: 202 },
  crown: { x: 200, y: 284 },
  occipital: { x: 200, y: 348 },
  donor_safe_zone: { x: 200, y: 398 },
};

type ScalpZonesMode = "multi" | "repair";

export function ScalpZonesTopViewSvg({
  mode,
  selectedZones,
  onToggleZone,
  repairAnnotations,
  activeRepairTag,
  disabled,
}: {
  mode: ScalpZonesMode;
  selectedZones: ConsultationScalpZoneId[];
  onToggleZone: (zone: ConsultationScalpZoneId) => void;
  repairAnnotations: Partial<Record<ConsultationScalpZoneId, ConsultationRepairAnnotationTag[]>>;
  activeRepairTag: ConsultationRepairAnnotationTag | null;
  disabled: boolean;
}) {
  const selectedSet = new Set(selectedZones);

  function zoneActive(zone: ConsultationScalpZoneId): boolean {
    return mode === "multi" ? selectedSet.has(zone) : Boolean(repairAnnotations[zone]?.length);
  }

  function zoneFill(zone: ConsultationScalpZoneId): string {
    if (mode === "multi") {
      return selectedSet.has(zone) ? "rgba(14,165,233,0.38)" : "rgba(148,163,184,0.10)";
    }
    const tags = repairAnnotations[zone];
    const has = tags && tags.length > 0;
    return has ? "rgba(244,63,94,0.30)" : "rgba(148,163,184,0.10)";
  }

  function zoneStroke(zone: ConsultationScalpZoneId): string {
    if (mode === "multi") return selectedSet.has(zone) ? "rgb(2,132,199)" : "rgb(100,116,139)";
    const tags = repairAnnotations[zone];
    if (activeRepairTag && tags?.includes(activeRepairTag)) return "rgb(225,29,72)";
    return tags?.length ? "rgb(244,63,94)" : "rgb(100,116,139)";
  }

  return (
    <svg
      viewBox="0 0 400 470"
      className="h-auto w-full max-w-md touch-manipulation select-none"
      role="img"
      aria-label="Scalp zones — top-down view, front of head at the top"
    >
      <title>Scalp zones (top-down)</title>
      <defs>
        <clipPath id="scalpHead">
          <path d={HEAD_PATH} />
        </clipPath>
      </defs>

      {/* orientation */}
      <text x="200" y="26" textAnchor="middle" className="fill-slate-500 text-[12px] font-semibold">
        Front
      </text>
      {/* nose marker = front of head */}
      <path d="M188 54 L212 54 L200 36 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />

      {/* scalp silhouette */}
      <path d={HEAD_PATH} fill="#eef2f7" stroke="#94a3b8" strokeWidth="2" />

      {/* clickable zones (clipped to the scalp edge) */}
      <g clipPath="url(#scalpHead)">
        {ZONE_DRAW_ORDER.map((zone) => (
          <path
            key={zone}
            d={ZONE_PATHS[zone]}
            fill={zoneFill(zone)}
            stroke={zoneStroke(zone)}
            strokeWidth={1.5}
            className={cn(
              "transition-colors",
              disabled
                ? "pointer-events-none opacity-60"
                : "cursor-pointer hover:opacity-90 focus:outline-none"
            )}
            tabIndex={disabled ? -1 : 0}
            role="button"
            aria-pressed={zoneActive(zone)}
            aria-label={ZONE_LABELS[zone]}
            onClick={() => {
              if (!disabled) onToggleZone(zone);
            }}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggleZone(zone);
              }
            }}
          />
        ))}
      </g>

      {/* head outline on top for a crisp silhouette */}
      <path d={HEAD_PATH} fill="none" stroke="#64748b" strokeWidth="2" />

      {/* zone labels (non-interactive) */}
      <g className="pointer-events-none">
        {ZONE_DRAW_ORDER.map((zone) => {
          const p = ZONE_LABEL_POS[zone];
          return (
            <text
              key={zone}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              className={cn(
                "text-[11px] font-medium",
                zoneActive(zone) ? "fill-slate-900" : "fill-slate-500"
              )}
            >
              {ZONE_LABELS[zone]}
            </text>
          );
        })}
      </g>

      <text
        x="200"
        y="450"
        textAnchor="middle"
        className="fill-slate-500 text-[12px] font-semibold"
      >
        Back / nape
      </text>
    </svg>
  );
}

export function repairTagLabel(tag: ConsultationRepairAnnotationTag): string {
  switch (tag) {
    case "failed_growth":
      return "Failed growth";
    case "overharvested":
      return "Overharvested";
    case "scarring":
      return "Scarring";
    case "poor_density":
      return "Poor density";
    case "redesign_required":
      return "Redesign";
    default:
      return tag;
  }
}
