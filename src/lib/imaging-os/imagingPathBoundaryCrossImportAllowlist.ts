/**
 * FI-IMAGING-PATH-BOUNDARY-MAP-1 — documented sole cross-tree imaging import.
 * Format: `${importerRelativePath}|${importSpecifier}` as written in source.
 * Enforcement lives in `imagingPathBoundaryGuardCore` via `isPermittedCrossBoundaryImport`.
 * Target state: shrink to 0 by migrating legacy workspace files or replacing this bridge.
 */

export const IMAGING_PATH_BOUNDARY_CROSS_IMPORT_ALLOWLIST = [
  // Single intentional legacy bridge — imagingOsWorkspaceBridge → workspaceBridge only.
  "src/lib/imagingOs/imagingOsWorkspaceBridge.ts|@/src/lib/imaging-os/workspaceBridge",
] as const;

export type ImagingPathBoundaryCrossImportAllowlistEntry =
  (typeof IMAGING_PATH_BOUNDARY_CROSS_IMPORT_ALLOWLIST)[number];

export function crossImportAllowlistKey(file: string, specifier: string): string {
  return `${file.replace(/\\/g, "/")}|${specifier.trim()}`;
}
