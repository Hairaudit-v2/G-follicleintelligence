/**
 * FI-IMAGING-PATH-BOUNDARY-MAP-1 — ownership map for the split ImagingOS folder layout.
 *
 * ## `src/lib/imaging-os/` (canonical, hyphenated)
 * - Core contracts: categories, intake, pipeline, protocol, quality, progression, surgical, outcomes
 * - Focused entry points: `ai`, `capture`, `review`, `graft-tray`
 * - Adapters, graft-tray bridge, clinical review queue, visual summary, AI job workers
 * - Shared vocabulary: `imagingLibraryVocabulary`, `protocolSlotVocabulary`, `workspaceBridge`, `imagingAiAnalysisKinds`, `imagingCaptureSourceCore`
 * - Protocol catalog: `protocolCatalogResolver.server`, `protocolCatalogResolverCore`
 *
 * New constants, types, and feature logic belong here.
 *
 * ## `src/lib/imagingOs/` (legacy workspace, camelCase)
 * - Guided-capture UI/server load and mutation layer (`imagingOsLoad`, `imagingOsGuidedCapture`)
 * - Legacy protocol slot definitions (`imagingOsProtocol`) pending catalog unification
 * - Client upload helpers and workspace-specific wiring
 *
 * Do not add new core constants or canonical types here. Re-export from `imaging-os/*` only when
 * backward compatibility requires it during migration.
 *
 * ## Cross-tree imports
 * A small set of legacy ↔ canonical imports remain while protocol catalog and guided capture migrate.
 * New cross-boundary imports are blocked by `imagingPathBoundaryGuardCore` (allowlist during transition).
 */

export const IMAGING_OS_CANONICAL_ROOT = "src/lib/imaging-os" as const;
export const IMAGING_OS_LEGACY_WORKSPACE_ROOT = "src/lib/imagingOs" as const;

export const IMAGING_OS_CANONICAL_OWNERSHIP = {
  core: [
    "categories",
    "intake",
    "pipeline",
    "protocol",
    "quality",
    "progression",
    "surgical",
    "outcomes",
    "comparison",
    "measurement",
    "summary",
  ],
  focusedEntryPoints: ["ai", "capture", "review", "graft-tray"],
  features: [
    "graft-tray bridge",
    "clinical review queue",
    "visual summary",
    "AI analysis jobs",
    "canonical capture resolver",
  ],
} as const;

export const IMAGING_OS_LEGACY_WORKSPACE_OWNERSHIP = {
  responsibilities: [
    "guided-capture server orchestration",
    "FI admin imaging workspace load/mutations",
    "legacy protocol slot JSON vocabulary",
    "client upload field builders",
  ],
  migrationTarget: IMAGING_OS_CANONICAL_ROOT,
} as const;
