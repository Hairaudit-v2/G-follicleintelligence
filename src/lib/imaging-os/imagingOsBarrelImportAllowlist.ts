/**
 * FI-IMAGING-BARREL-GUARDRAIL-1 — temporary allowlist for legacy catch-all barrel imports.
 * Each entry should migrate to focused entry points (`ai`, `capture`, `review`, `graft-tray`)
 * or direct module imports. Shrink this list over time; do not add new entries casually.
 */

export const IMAGING_OS_BARREL_IMPORT_ALLOWLIST: readonly string[] = [
  // All legacy phase contract tests migrated in FI-IMAGING-BARREL-MIGRATION-1.
];

export type ImagingOsBarrelImportAllowlistEntry = string;