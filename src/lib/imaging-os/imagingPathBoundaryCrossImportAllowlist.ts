/**
 * FI-IMAGING-PATH-BOUNDARY-MAP-1 — temporary allowlist for cross-tree imaging imports.
 * Format: `${importerRelativePath}|${importSpecifier}` as written in source.
 * Shrink over time; prefer migrating importers to canonical `imaging-os/*` paths.
 */

export const IMAGING_PATH_BOUNDARY_CROSS_IMPORT_ALLOWLIST = [
  // Sole legacy workspace bridge — all imagingOs in-tree consumers import via this file.
  "src/lib/imagingOs/imagingOsWorkspaceBridge.ts|@/src/lib/imaging-os/workspaceBridge",
] as const;

export type ImagingPathBoundaryCrossImportAllowlistEntry =
  (typeof IMAGING_PATH_BOUNDARY_CROSS_IMPORT_ALLOWLIST)[number];

export function crossImportAllowlistKey(file: string, specifier: string): string {
  return `${file.replace(/\\/g, "/")}|${specifier.trim()}`;
}