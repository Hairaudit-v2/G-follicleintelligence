"use client";

import { cn } from "@/lib/utils";
import type { ConsultationRepairAnnotationTag, ConsultationScalpZoneId } from "@/src/lib/consultationForms/visualAssessment/consultationVisualAssessmentModel";
/** Draw order: back / broad regions first so lateral zones stay clickable. */
const ZONE_DRAW_ORDER: ConsultationScalpZoneId[] = [
  "donor_safe_zone",
  "occipital",
  "mid_scalp",
  "crown",
  "frontal",
  "temporal_left",
  "temporal_right",
];

/** SVG path-ish regions (top-down schematic). */
const ZONE_PATHS: Record<ConsultationScalpZoneId, string> = {
  occipital: "M 120 52 L 280 52 L 300 120 L 200 155 L 100 120 Z",
  mid_scalp: "M 130 115 L 270 115 L 255 195 L 145 195 Z",
  crown: "M 165 125 L 235 125 L 228 178 L 172 178 Z",
  frontal: "M 140 200 L 260 200 L 248 268 L 152 268 Z",
  temporal_left: "M 60 130 L 145 125 L 155 230 L 85 255 Z",
  temporal_right: "M 340 130 L 255 125 L 245 230 L 315 255 Z",
  donor_safe_zone: "M 70 300 L 330 300 L 340 380 L 60 380 Z",
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

  function zoneFill(zone: ConsultationScalpZoneId): string {
    if (mode === "multi") {
      return selectedSet.has(zone) ? "rgba(14,165,233,0.35)" : "rgba(148,163,184,0.12)";
    }
    const tags = repairAnnotations[zone];
    const has = tags && tags.length > 0;
    return has ? "rgba(244,63,94,0.28)" : "rgba(148,163,184,0.1)";
  }

  function zoneStroke(zone: ConsultationScalpZoneId): string {
    if (mode === "multi") return selectedSet.has(zone) ? "rgb(2,132,199)" : "rgb(100,116,139)";
    const tags = repairAnnotations[zone];
    if (activeRepairTag && tags?.includes(activeRepairTag)) return "rgb(225,29,72)";
    return tags?.length ? "rgb(244,63,94)" : "rgb(148,163,184)";
  }

  return (
    <svg
      viewBox="0 0 400 420"
      className="h-auto w-full max-w-md select-none"
      role="img"
      aria-label="Scalp zones — top-down schematic"
    >
      <title>Scalp zones</title>
      <ellipse cx="200" cy="210" rx="150" ry="185" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
      {ZONE_DRAW_ORDER.map((zone) => (
        <path
          key={zone}
          d={ZONE_PATHS[zone]}
          fill={zoneFill(zone)}
          stroke={zoneStroke(zone)}
          strokeWidth={2}
          className={cn(
            "transition-colors",
            disabled ? "pointer-events-none opacity-60" : "cursor-pointer hover:opacity-90 focus:outline-none"
          )}
          tabIndex={disabled ? -1 : 0}
          role="button"
          aria-pressed={mode === "multi" ? selectedSet.has(zone) : Boolean(repairAnnotations[zone]?.length)}
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
      <text x="200" y="32" textAnchor="middle" className="fill-slate-600 text-[11px] font-semibold">
        Top view (schematic)
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
