# `src/lib/imagingOs` (legacy workspace)

Legacy FI admin guided-capture load/mutation layer and protocol slot vocabulary. Pending migration into `src/lib/imaging-os/`.

## Ownership

- `imagingOsLoad.server.ts`, `imagingOsGuidedCapture.server.ts`, `imagingOsMutations.server.ts` — workspace server wiring
- `imagingOsProtocolCatalogAdapter.server.ts` — thin legacy adapter over canonical protocol catalog resolver
- `imagingOsWorkspaceBridge.ts` — **sole** cross-tree import point into canonical `workspaceBridge`
- `imagingOsProtocol.ts` — VIE/guided-capture session progress helpers (re-exports slot vocabulary via workspace bridge)
- `imagingGuidedCaptureUpload.client.ts`, `imagingOsGuidedFields.ts` — client upload helpers

## Rules for new code

- Do **not** add new core constants, canonical types, or feature logic here.
- Do **not** import canonical `imaging-os/*` modules directly — use `imagingOsWorkspaceBridge` or `imagingOsProtocolCatalogAdapter.server.ts`.
- Import shared vocabulary from `@/src/lib/imaging-os/imagingLibraryVocabulary`, `@/src/lib/imaging-os/protocolSlotVocabulary`, or focused entry points in new app code outside this folder.

## Cross-tree boundary

New imports across `imagingOs` ↔ `imaging-os` are blocked unless allowlisted. See `../imaging-os/imagingPathBoundaryMap.ts`.