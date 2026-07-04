# `src/lib/imagingOs` (legacy workspace)

Legacy FI admin guided-capture load/mutation layer and protocol slot vocabulary. Pending migration into `src/lib/imaging-os/`.

## Ownership

- `imagingOsLoad.server.ts`, `imagingOsGuidedCapture.server.ts`, `imagingOsMutations.server.ts` — workspace server wiring
- `imagingOsProtocol.ts` — legacy protocol slot definitions (used by canonical catalog resolver during transition)
- `imagingGuidedCaptureUpload.client.ts`, `imagingOsGuidedFields.ts` — client upload helpers

## Rules for new code

- Do **not** add new core constants, canonical types, or feature logic here.
- Import shared vocabulary from `@/src/lib/imaging-os/imagingLibraryVocabulary`, `@/src/lib/imaging-os/ai`, or `@/src/lib/imaging-os/capture`.
- `imagingOsConstants.ts` is a temporary shim — migrate callers to canonical modules.

## Cross-tree boundary

New imports across `imagingOs` ↔ `imaging-os` are blocked unless allowlisted. See `../imaging-os/imagingPathBoundaryMap.ts`.