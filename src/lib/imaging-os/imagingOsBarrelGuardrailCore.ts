/**
 * FI-IMAGING-BARREL-GUARDRAIL-1 — detect catch-all ImagingOS barrel imports in app source.
 */

import fs from "node:fs";
import path from "node:path";

import {
  IMAGING_OS_BARREL_IMPORT_ALLOWLIST,
  type ImagingOsBarrelImportAllowlistEntry,
} from "./imagingOsBarrelImportAllowlist";

const SCAN_ROOTS = ["src", "tests", "lib", "app"] as const;
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
]);

const FOCUSED_ENTRY_PREFIXES = [
  "@/src/lib/imaging-os/ai",
  "@/src/lib/imaging-os/capture",
  "@/src/lib/imaging-os/review",
  "@/src/lib/imaging-os/graft-tray",
] as const;

export type ImagingOsBarrelImportViolation = {
  file: string;
  line: number;
  specifier: string;
};

function normalizePosixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export function isCatchAllImagingOsBarrelSpecifier(specifier: string): boolean {
  const normalized = normalizePosixPath(specifier.trim());
  if (FOCUSED_ENTRY_PREFIXES.some((prefix) => normalized === prefix)) {
    return false;
  }
  if (normalized === "@/src/lib/imaging-os" || normalized === "@/src/lib/imaging-os/index") {
    return true;
  }
  if (/^(?:\.\.\/)+src\/lib\/imaging-os$/.test(normalized)) return true;
  if (/^(?:\.\.\/)+src\/lib\/imaging-os\/index$/.test(normalized)) return true;
  return false;
}

export function isFocusedImagingOsEntrySpecifier(specifier: string): boolean {
  const normalized = normalizePosixPath(specifier.trim());
  return FOCUSED_ENTRY_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

const SINGLE_LINE_IMPORT_FROM =
  /^\s*(?:import|export)\s+(?:type\s+)?[\s\S]*?\sfrom\s+["']([^"']+)["']/;
const MULTILINE_IMPORT_FROM = /^\s*\}\s*from\s+["']([^"']+)["']/;

export function findBarrelImportsInSource(
  source: string,
  filePath = "inline-fixture.ts"
): ImagingOsBarrelImportViolation[] {
  const violations: ImagingOsBarrelImportViolation[] = [];
  const lines = source.split("\n");

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const match =
      line.match(SINGLE_LINE_IMPORT_FROM) ?? line.match(MULTILINE_IMPORT_FROM);
    if (!match) continue;
    const specifier = match[1];
    if (!isCatchAllImagingOsBarrelSpecifier(specifier)) continue;
    violations.push({
      file: normalizePosixPath(filePath),
      line: index + 1,
      specifier,
    });
  }

  return violations;
}

function shouldScanFile(relativePath: string): boolean {
  const posix = normalizePosixPath(relativePath);
  if (!posix.endsWith(".ts") && !posix.endsWith(".tsx")) return false;
  if (posix.endsWith("src/lib/imaging-os/index.ts")) return false;
  if (posix.endsWith("src/lib/imaging-os/imagingOsBarrelGuardrailCore.ts")) return false;
  if (posix.endsWith("src/lib/imaging-os/imagingOsBarrelGuardrail.test.ts")) return false;
  if (posix.endsWith("src/lib/imaging-os/imagingOsBarrelImportAllowlist.ts")) return false;
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

export function scanImagingOsBarrelImports(repoRoot: string): ImagingOsBarrelImportViolation[] {
  const allowlist = new Set<string>(IMAGING_OS_BARREL_IMPORT_ALLOWLIST);
  const violations: ImagingOsBarrelImportViolation[] = [];

  for (const relativeFile of walkScanRoots(repoRoot)) {
    const source = fs.readFileSync(path.join(repoRoot, relativeFile), "utf8");
    const fileViolations = findBarrelImportsInSource(source, relativeFile);
    for (const violation of fileViolations) {
      if (allowlist.has(relativeFile)) continue;
      violations.push(violation);
    }
  }

  return violations;
}

export function isAllowlistedBarrelImportFile(
  file: string
): file is ImagingOsBarrelImportAllowlistEntry {
  return (IMAGING_OS_BARREL_IMPORT_ALLOWLIST as readonly string[]).includes(
    normalizePosixPath(file)
  );
}