# `src/lib/imaging-os` (canonical)

Canonical ImagingOS core, features, adapters, and shared vocabulary.

## Prefer for new code

- Focused entry points: `ai`, `capture`, `review`, `graft-tray`
- Direct modules: `pipeline`, `protocol`, `graftTrayCaptureContext`, etc.
- Shared constants/types: `imagingLibraryVocabulary`, `imagingAiAnalysisKinds`

## Do not import from here

Avoid new imports from the deprecated catch-all barrel (`index.ts`). Use focused entry points instead.

## Cross-tree boundary

`src/lib/imagingOs/` is the legacy guided-capture workspace layer. Cross-imports between these folders are guarded by `imagingPathBoundaryGuardCore.ts` — see `imagingPathBoundaryMap.ts`.