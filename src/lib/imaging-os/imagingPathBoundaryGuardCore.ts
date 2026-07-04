/**
 * FI-IMAGING-PATH-BOUNDARY-MAP-1 — detect cross-imports between imaging-os and imagingOs trees.
 */

import fs from "node:fs";
import path from "node:path";

import type { ImagingPathBoundaryCrossImportAllowlistEntry } from "./imagingPathBoundaryCrossImportAllowlist";
import {
  IMAGING_OS_CANONICAL_ROOT,
  IMAGING_OS_LEGACY_WORKSPACE_ROOT,
} from "./imagingPathBoundaryMap";
import {
  CANONICAL_WORKSPACE_BRIDGE_SPECIFIER,
  LEGACY_WORKSPACE_BRIDGE_FILE,
} from "./workspaceBridgeContract";

const SCAN_ROOTS = ["src", "tests", "lib", "app"] as const;
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage"]);

const SINGLE_LINE_IMPORT_FROM =
  /^\s*(?:import|export)\s+(?:type\s+)?[\s\S]*?\sfrom\s+["']([^"']+)["']/;
const MULTILINE_IMPORT_FROM = /^\s*\}\s*from\s+["']([^"']+)["']/;

export type ImagingPathBoundary = "canonical" | "legacy";

export type ImagingPathCrossImportViolation = {
  file: string;
  line: number;
  specifier: string;
  fromBoundary: ImagingPathBoundary;
  toBoundary: ImagingPathBoundary;
};

export type ImagingPathCrossImportObservation = ImagingPathCrossImportViolation & {
  allowlisted: boolean;
};

function normalizePosixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export function boundaryForFilePath(filePath: string): ImagingPathBoundary | null {
  const posix = normalizePosixPath(filePath);
  if (posix.includes(`${IMAGING_OS_CANONICAL_ROOT}/`)) return "canonical";
  if (posix.includes(`${IMAGING_OS_LEGACY_WORKSPACE_ROOT}/`)) return "legacy";
  return null;
}

export function boundaryForImportSpecifier(specifier: string): ImagingPathBoundary | null {
  const normalized = normalizePosixPath(specifier.trim());
  if (
    normalized.includes(`${IMAGING_OS_CANONICAL_ROOT}/`) ||
    normalized === `@/${IMAGING_OS_CANONICAL_ROOT}` ||
    normalized.startsWith(`@/${IMAGING_OS_CANONICAL_ROOT}/`)
  ) {
    return "canonical";
  }
  if (
    normalized.includes(`${IMAGING_OS_LEGACY_WORKSPACE_ROOT}/`) ||
    normalized.startsWith(`@/${IMAGING_OS_LEGACY_WORKSPACE_ROOT}/`)
  ) {
    return "legacy";
  }
  if (/^(?:\.\.\/)+imaging-os\//.test(normalized) || /^\.\/imaging-os\//.test(normalized)) {
    return "canonical";
  }
  if (/^(?:\.\.\/)+imagingOs\//.test(normalized) || /^\.\/imagingOs\//.test(normalized)) {
    return "legacy";
  }
  return null;
}

export function isCrossBoundaryImagingImport(
  importerFile: string,
  specifier: string
): ImagingPathCrossImportViolation | null {
  const fromBoundary = boundaryForFilePath(importerFile);
  const toBoundary = boundaryForImportSpecifier(specifier);
  if (!fromBoundary || !toBoundary || fromBoundary === toBoundary) return null;
  return {
    file: normalizePosixPath(importerFile),
    line: 0,
    specifier: specifier.trim(),
    fromBoundary,
    toBoundary,
  };
}

export function isPreferredCanonicalImagingImport(specifier: string): boolean {
  const boundary = boundaryForImportSpecifier(specifier);
  return boundary === "canonical";
}

/** Legacy → canonical cross-imports are permitted only via the sole workspace bridge file. */
export function isPermittedLegacyToCanonicalCrossImport(
  file: string,
  specifier: string
): boolean {
  const posixFile = normalizePosixPath(file);
  const normalizedSpecifier = normalizePosixPath(specifier.trim());
  return (
    posixFile === LEGACY_WORKSPACE_BRIDGE_FILE &&
    normalizedSpecifier === CANONICAL_WORKSPACE_BRIDGE_SPECIFIER
  );
}

/** Canonical imaging-os modules must not import from legacy imagingOs/*. */
export function isForbiddenCanonicalToLegacyCrossImport(
  violation: ImagingPathCrossImportViolation
): boolean {
  return violation.fromBoundary === "canonical" && violation.toBoundary === "legacy";
}

export function isPermittedCrossBoundaryImport(
  violation: ImagingPathCrossImportViolation
): boolean {
  if (isForbiddenCanonicalToLegacyCrossImport(violation)) return false;
  if (violation.fromBoundary === "legacy" && violation.toBoundary === "canonical") {
    return isPermittedLegacyToCanonicalCrossImport(violation.file, violation.specifier);
  }
  return false;
}

export function findCrossBoundaryImportsInSource(
  source: string,
  filePath = "inline-fixture.ts"
): ImagingPathCrossImportViolation[] {
  const violations: ImagingPathCrossImportViolation[] = [];
  const lines = source.split("\n");

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const match = line.match(SINGLE_LINE_IMPORT_FROM) ?? line.match(MULTILINE_IMPORT_FROM);
    if (!match) continue;
    const specifier = match[1];
    const cross = isCrossBoundaryImagingImport(filePath, specifier);
    if (!cross) continue;
    violations.push({ ...cross, line: index + 1 });
  }

  return violations;
}

function shouldScanFile(relativePath: string): boolean {
  const posix = normalizePosixPath(relativePath);
  if (!posix.endsWith(".ts") && !posix.endsWith(".tsx")) return false;
  if (posix.endsWith("src/lib/imaging-os/imagingPathBoundaryGuardCore.ts")) return false;
  if (posix.endsWith("src/lib/imaging-os/imagingPathBoundaryGuard.test.ts")) return false;
  if (posix.endsWith("src/lib/imaging-os/imagingPathBoundaryCrossImportAllowlist.ts")) return false;
  if (posix.endsWith("src/lib/imaging-os/imagingPathBoundaryMap.ts")) return false;
  if (posix.endsWith("src/lib/imaging-os/workspaceBridgeContract.ts")) return false;
  if (posix.endsWith("src/lib/imaging-os/workspaceBridgeContractCore.ts")) return false;
  if (posix.endsWith("src/lib/imaging-os/workspaceBridgeContract.test.ts")) return false;
  return true;
}

function walkScanRoots(repoRoot: string): string[] {
  const files: string[] = [];

  const walk = (absoluteDir: string) => {
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const absolutePath = path.join(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      const relative = normalizePosixPath(path.relative(repoRoot, absolutePath));
      if (shouldScanFile(relative)) files.push(relative);
    }
  };

  for (const root of SCAN_ROOTS) {
    const absoluteRoot = path.join(repoRoot, root);
    if (!fs.existsSync(absoluteRoot)) continue;
    walk(absoluteRoot);
  }

  return files.sort();
}

export function scanImagingPathCrossImports(repoRoot: string): ImagingPathCrossImportObservation[] {
  const observations: ImagingPathCrossImportObservation[] = [];

  for (const relativeFile of walkScanRoots(repoRoot)) {
    const source = fs.readFileSync(path.join(repoRoot, relativeFile), "utf8");
    for (const violation of findCrossBoundaryImportsInSource(source, relativeFile)) {
      observations.push({
        ...violation,
        allowlisted: isPermittedCrossBoundaryImport(violation),
      });
    }
  }

  return observations;
}

export function scanImagingPathCrossImportViolations(
  repoRoot: string
): ImagingPathCrossImportViolation[] {
  return scanImagingPathCrossImports(repoRoot).filter((entry) => !entry.allowlisted);
}

export function findUnauthorizedLegacyToCanonicalCrossImports(
  repoRoot: string
): ImagingPathCrossImportViolation[] {
  return scanImagingPathCrossImports(repoRoot).filter(
    (entry) =>
      entry.fromBoundary === "legacy" &&
      entry.toBoundary === "canonical" &&
      !isPermittedLegacyToCanonicalCrossImport(entry.file, entry.specifier)
  );
}

export function isAllowlistedCrossBoundaryImport(
  file: string,
  specifier: string
): file is ImagingPathBoundaryCrossImportAllowlistEntry {
  const violation: ImagingPathCrossImportViolation = {
    file: normalizePosixPath(file),
    line: 0,
    specifier: specifier.trim(),
    fromBoundary: "legacy",
    toBoundary: "canonical",
  };
  return isPermittedCrossBoundaryImport(violation);
}