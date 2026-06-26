/**
 * Visual Intelligence Engine (VIE) — FI OS delivery tracker (VIE-1…VIE-10).
 * Update as phases ship; surfaced on platform progress and FI Admin dashboard.
 */

import type { PlatformProgressModule } from "@/lib/marketing/platformProgressPageContent";

export const VIE_PLATFORM_PHASES = [
  { id: "VIE-1", label: "Protocol Capture Foundation", status: "completed" as const },
  { id: "VIE-2", label: "Quality Retake Loop", status: "completed" as const },
  { id: "VIE-3", label: "Expanded Protocol Catalog", status: "completed" as const },
  { id: "VIE-4", label: "SurgeryOS Embedded Capture", status: "completed" as const },
  { id: "VIE-5", label: "Longitudinal Comparison Engine", status: "completed" as const },
  { id: "VIE-6", label: "Same Angle Alignment Engine", status: "pending" as const },
  { id: "VIE-7", label: "Outcome Intelligence Engine", status: "pending" as const },
  { id: "VIE-8", label: "Audit Evidence Pack Builder", status: "pending" as const },
  { id: "VIE-9", label: "AI Clinical Interpretation Engine", status: "pending" as const },
  { id: "VIE-10", label: "Global Benchmarking Engine", status: "pending" as const },
] as const;

export type ViePlatformPhase = (typeof VIE_PLATFORM_PHASES)[number];
export type ViePlatformPhaseStatus = ViePlatformPhase["status"];

export const VIE_PLATFORM_PROGRESS = {
  name: "Visual Intelligence Engine (VIE)",
  status: "Active Development" as const,
  progressPercent: 67,
  completedPhases: VIE_PLATFORM_PHASES.filter((p) => p.status === "completed").map((p) => `${p.id} ${p.label}`),
  pendingPhases: VIE_PLATFORM_PHASES.filter((p) => p.status === "pending").map((p) => `${p.id} ${p.label}`),
  platformStage: "VIE-5 · longitudinal comparison engine",
  platformDescription:
    "Protocol-driven clinical photography for ImagingOS and SurgeryOS — guided capture, quality accept/retake loop, expanded surgical protocols, embedded operative evidence capture, and metadata-driven before/after comparison with progression timelines. Same-angle alignment, outcome intelligence, audit evidence packs, AI clinical interpretation, and global benchmarking remain.",
} as const;

export type ViePlatformProgress = typeof VIE_PLATFORM_PROGRESS;

export const VIE_PLATFORM_CHANGELOG_IDS = {
  vie5: "2026-06-26-vie-5-longitudinal-comparison",
} as const;

export const VIE_PLATFORM_LATEST_RELEASE_DATE = "2026-06-26" as const;

/** Platform progress registry row — single source for name, %, status, stage, description. */
export function buildViePlatformProgressModule(): PlatformProgressModule {
  const p = VIE_PLATFORM_PROGRESS;
  return {
    id: "visual-intelligence-engine",
    name: p.name,
    completionPercent: p.progressPercent,
    stage: p.platformStage,
    description: p.platformDescription,
    status: p.status,
    learnMoreHref: "/platform/imaging-os",
  };
}

export function listViePhasesByStatus(status: ViePlatformPhaseStatus): ViePlatformPhase[] {
  return VIE_PLATFORM_PHASES.filter((p) => p.status === status);
}
