"use client";

import type { VieCaptureGuideKind } from "@/src/lib/vie/vieProtocolTypes";

const GUIDE_LABELS: Record<VieCaptureGuideKind, string> = {
  front_hairline: "Front — hairline centred",
  front: "Front — full hairline",
  front_close: "Front — close-up detail",
  left_side: "Left side profile",
  left_side_close: "Left side — close-up",
  right_side: "Right side profile",
  right_side_close: "Right side — close-up",
  top: "Top — overhead midscalp",
  top_close: "Top — close-up overhead",
  crown: "Crown / vertex",
  crown_close: "Crown — close-up whorl",
  donor: "Donor zone — occipital overview",
  donor_close: "Donor zone — close-up",
  left_temple: "Left temple — head turned right",
  right_temple: "Right temple — head turned left",
  top_down: "Top-down overhead",
  donor_zone: "Donor zone — occipital",
  recipient_zone: "Recipient zone",
  surgical_field: "Surgical field",
  graft_tray: "Graft tray documentation",
  healing_progress: "Healing progress",
  repair_zone: "Repair zone",
};

/** Simple silhouette framing guide for protocol capture UI (Phase 1 — no AI overlay). */
export function VieCaptureGuideOverlay({ guide }: { guide: VieCaptureGuideKind }) {
  return (
    <div
      className="relative mx-auto flex aspect-[3/4] w-full max-w-xs items-center justify-center rounded-xl border-2 border-dashed border-cyan-400/50 bg-slate-900/80"
      aria-hidden
    >
      <div className="absolute inset-4 rounded-lg border border-white/10" />
      <GuideSilhouette guide={guide} />
      <p className="absolute bottom-3 left-0 right-0 px-3 text-center text-[0.65rem] font-medium uppercase tracking-wide text-cyan-300/90">
        {GUIDE_LABELS[guide]}
      </p>
    </div>
  );
}

function isCloseUpGuide(guide: VieCaptureGuideKind): boolean {
  return guide.endsWith("_close") || guide === "graft_tray";
}

function isOverheadGuide(guide: VieCaptureGuideKind): boolean {
  return guide === "top" || guide === "top_close" || guide === "top_down" || guide === "crown" || guide === "crown_close";
}

function isDonorGuide(guide: VieCaptureGuideKind): boolean {
  return guide === "donor" || guide === "donor_close" || guide === "donor_zone";
}

function isSideGuide(guide: VieCaptureGuideKind): boolean {
  return guide === "left_side" || guide === "left_side_close" || guide === "left_temple";
}

function isRightSideGuide(guide: VieCaptureGuideKind): boolean {
  return guide === "right_side" || guide === "right_side_close" || guide === "right_temple";
}

function GuideSilhouette({ guide }: { guide: VieCaptureGuideKind }) {
  const headClass = "rounded-full border-2 border-white/30 bg-white/5";
  const scale = isCloseUpGuide(guide) ? "scale-125" : "";

  if (isOverheadGuide(guide)) {
    return (
      <div className={`h-24 w-24 rounded-full border-2 border-white/30 bg-white/5 ${scale}`} />
    );
  }
  if (isDonorGuide(guide)) {
    return <div className={`h-16 w-28 rounded-lg border-2 border-white/30 bg-white/5 ${scale}`} />;
  }
  if (guide === "graft_tray") {
    return <div className="grid h-14 w-24 grid-cols-3 gap-1">{Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="rounded-sm border border-white/20 bg-white/5" />
    ))}</div>;
  }
  if (guide === "recipient_zone" || guide === "repair_zone" || guide === "surgical_field") {
    return <div className="h-16 w-28 rounded-lg border-2 border-white/30 bg-white/5" />;
  }
  if (isSideGuide(guide)) {
    return (
      <div className={`flex items-center gap-1 ${scale}`}>
        <div className={`h-20 w-20 ${headClass}`} />
        <div className="h-8 w-2 rounded bg-cyan-400/40" />
      </div>
    );
  }
  if (isRightSideGuide(guide)) {
    return (
      <div className={`flex items-center gap-1 ${scale}`}>
        <div className="h-8 w-2 rounded bg-cyan-400/40" />
        <div className={`h-20 w-20 ${headClass}`} />
      </div>
    );
  }
  if (guide === "healing_progress") {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className={`h-16 w-16 ${headClass}`} />
        <div className="h-2 w-10 rounded bg-cyan-400/30" />
      </div>
    );
  }
  return <div className={`h-24 w-24 ${headClass} ${scale}`} />;
}
