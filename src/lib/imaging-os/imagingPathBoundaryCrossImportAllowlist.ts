/**
 * FI-IMAGING-PATH-BOUNDARY-MAP-1 — temporary allowlist for cross-tree imaging imports.
 * Format: `${importerRelativePath}|${importSpecifier}` as written in source.
 * Shrink over time; prefer migrating importers to canonical `imaging-os/*` paths.
 */

export const IMAGING_PATH_BOUNDARY_CROSS_IMPORT_ALLOWLIST = [
  // Legacy workspace → canonical protocol catalog resolver (guided capture load path).
  "src/lib/imagingOs/imagingOsGuidedCapture.server.ts|@/src/lib/imaging-os/protocolCatalogResolver.server",
  "src/lib/imagingOs/imagingOsLoad.server.ts|@/src/lib/imaging-os/protocolCatalogResolver.server",
  "src/lib/imagingOs/imagingOsLoad.server.ts|@/src/lib/imaging-os/protocolCatalogResolverCore",
  // Legacy constants shim re-exports canonical vocabulary during migration.
  "src/lib/imagingOs/imagingOsConstants.ts|@/src/lib/imaging-os/imagingLibraryVocabulary",
  // Canonical resolver still reads legacy protocol slot defs until catalog unification lands.
  "src/lib/imaging-os/canonicalCaptureResolver.server.ts|@/src/lib/imagingOs/imagingOsProtocol",
  "src/lib/imaging-os/protocolCatalogResolver.server.ts|@/src/lib/imagingOs/imagingOsProtocol",
  "src/lib/imaging-os/protocolCatalogResolverCore.ts|@/src/lib/imagingOs/imagingOsProtocol",
] as const;

export type ImagingPathBoundaryCrossImportAllowlistEntry =
  (typeof IMAGING_PATH_BOUNDARY_CROSS_IMPORT_ALLOWLIST)[number];

export function crossImportAllowlistKey(file: string, specifier: string): string {
  return `${file.replace(/\\/g, "/")}|${specifier.trim()}`;
}