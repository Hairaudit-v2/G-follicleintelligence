/**
 * FI-IMAGING-PATH-BOUNDARY-MAP-1 — temporary allowlist for cross-tree imaging imports.
 * Format: `${importerRelativePath}|${importSpecifier}` as written in source.
 * Shrink over time; prefer migrating importers to canonical `imaging-os/*` paths.
 */

export const IMAGING_PATH_BOUNDARY_CROSS_IMPORT_ALLOWLIST = [
  // Legacy workspace loaders call canonical protocol catalog resolver until guided capture migrates.
  "src/lib/imagingOs/imagingOsGuidedCapture.server.ts|@/src/lib/imaging-os/protocolCatalogResolver.server",
  "src/lib/imagingOs/imagingOsLoad.server.ts|@/src/lib/imaging-os/protocolCatalogResolver.server",
  "src/lib/imagingOs/imagingOsLoad.server.ts|@/src/lib/imaging-os/protocolCatalogResolverCore",
  // Legacy workspace shims re-export canonical vocabulary for in-tree callers during migration.
  "src/lib/imagingOs/imagingOsProtocol.ts|@/src/lib/imaging-os/protocolSlotVocabulary",
  "src/lib/imagingOs/imagingOsLibraryVocabulary.ts|@/src/lib/imaging-os/imagingLibraryVocabulary",
] as const;

export type ImagingPathBoundaryCrossImportAllowlistEntry =
  (typeof IMAGING_PATH_BOUNDARY_CROSS_IMPORT_ALLOWLIST)[number];

export function crossImportAllowlistKey(file: string, specifier: string): string {
  return `${file.replace(/\\/g, "/")}|${specifier.trim()}`;
}