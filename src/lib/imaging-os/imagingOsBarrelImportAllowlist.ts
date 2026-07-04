/**
 * FI-IMAGING-BARREL-GUARDRAIL-1 — temporary allowlist for legacy catch-all barrel imports.
 * Each entry should migrate to focused entry points (`ai`, `capture`, `review`, `graft-tray`)
 * or direct module imports. Shrink this list over time; do not add new entries casually.
 */

export const IMAGING_OS_BARREL_IMPORT_ALLOWLIST = [
  // Legacy phase contract tests — migrate to direct adapter/pipeline imports per phase.
  "tests/imagingOsPhaseIm1.test.ts",
  "tests/imagingOsPhaseIm2.test.ts",
  "tests/imagingOsPhaseIm3.test.ts",
  "tests/imagingOsPhaseIm4.test.ts",
  "tests/imagingOsPhaseIm5.test.ts",
  "tests/imagingOsPhaseIm6.test.ts",
  "tests/imagingOsPhaseIm7.test.ts",
  "tests/imagingOsPhaseIm8.test.ts",
  "tests/imagingOsPhaseIm9.test.ts",
  "tests/imagingOsPhaseIm10.test.ts",
  "tests/imagingOsPhaseIm11.test.ts",
  "tests/imagingOsPhaseIm12.test.ts",
] as const;

export type ImagingOsBarrelImportAllowlistEntry =
  (typeof IMAGING_OS_BARREL_IMPORT_ALLOWLIST)[number];