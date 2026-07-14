import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { IMAGING_PATH_BOUNDARY_CROSS_IMPORT_ALLOWLIST } from "./imagingPathBoundaryCrossImportAllowlist";
import {
  boundaryForFilePath,
  boundaryForImportSpecifier,
  findCrossBoundaryImportsInSource,
  findUnauthorizedLegacyToCanonicalCrossImports,
  isPermittedLegacyToCanonicalCrossImport,
  isPreferredCanonicalImagingImport,
  scanImagingPathCrossImportViolations,
  scanImagingPathCrossImports,
} from "./imagingPathBoundaryGuardCore";
import {
  CANONICAL_WORKSPACE_BRIDGE_SPECIFIER,
  LEGACY_WORKSPACE_BRIDGE_FILE,
} from "./workspaceBridgeContract";
import {
  IMAGING_OS_CANONICAL_ROOT,
  IMAGING_OS_LEGACY_WORKSPACE_ROOT,
} from "./imagingPathBoundaryMap";

const REPO_ROOT = process.cwd();

describe("imagingPathBoundaryGuardCore", () => {
  it("classifies canonical and legacy tree paths", () => {
    assert.equal(boundaryForFilePath("src/lib/imaging-os/pipeline.ts"), "canonical");
    assert.equal(boundaryForFilePath("src/lib/imagingOs/imagingOsLoad.server.ts"), "legacy");
    assert.equal(boundaryForFilePath("src/lib/patientImages/patientImageTypes.ts"), null);
  });

  it("detects cross-boundary imports in fixture source", () => {
    const violations = findCrossBoundaryImportsInSource(
      `import { PROGRESS_META_KEY } from "@/src/lib/imagingOs/imagingOsProtocol";\n`,
      "src/lib/imaging-os/canonicalCaptureResolver.server.ts"
    );
    assert.equal(violations.length, 1);
    assert.equal(violations[0]?.fromBoundary, "canonical");
    assert.equal(violations[0]?.toBoundary, "legacy");
  });

  it("fails fixture scan for a new non-allowlisted cross-boundary import", () => {
    const violations = findCrossBoundaryImportsInSource(
      `import { runImagingOsStubPipeline } from "@/src/lib/imaging-os/stubPipeline";\n`,
      "src/lib/imagingOs/imagingOsMutations.server.ts"
    );
    assert.equal(violations.length, 1);
    assert.equal(violations[0]?.specifier, "@/src/lib/imaging-os/stubPipeline");
  });

  it("passes fixture scan for preferred canonical-only imports", () => {
    const violations = findCrossBoundaryImportsInSource(
      [
        `import { IMAGING_AI_ANALYSIS_KINDS } from "@/src/lib/imaging-os/ai";`,
        `import { normalizeFiImageCaptureSource } from "@/src/lib/imaging-os/capture";`,
        `import type { ImagingLibraryAxis } from "@/src/lib/imaging-os/imagingLibraryVocabulary";`,
      ].join("\n"),
      "src/lib/patientImages/patientImageTypes.ts"
    );
    assert.deepEqual(violations, []);
    assert.equal(
      isPreferredCanonicalImagingImport("@/src/lib/imaging-os/imagingLibraryVocabulary"),
      true
    );
    assert.equal(boundaryForImportSpecifier("@/src/lib/imagingOs/imagingOsProtocol"), "legacy");
  });

  it("repo scan finds no violations outside the allowlist", () => {
    const violations = scanImagingPathCrossImportViolations(REPO_ROOT);
    assert.deepEqual(
      violations,
      [],
      violations
        .map((v) => `${v.file}:${v.line} ${v.fromBoundary}→${v.toBoundary} imports ${v.specifier}`)
        .join("\n")
    );
  });

  it("reports existing allowlisted cross-imports for migration tracking", () => {
    const observations = scanImagingPathCrossImports(REPO_ROOT).filter((o) => o.allowlisted);
    const keys = new Set(observations.map((o) => `${o.file}|${o.specifier}`));
    for (const entry of IMAGING_PATH_BOUNDARY_CROSS_IMPORT_ALLOWLIST) {
      assert.ok(keys.has(entry), `allowlisted cross-import missing on disk: ${entry}`);
    }
    assert.ok(observations.length >= IMAGING_PATH_BOUNDARY_CROSS_IMPORT_ALLOWLIST.length);
  });

  it("boundary map documents both tree roots", () => {
    assert.equal(IMAGING_OS_CANONICAL_ROOT, "src/lib/imaging-os");
    assert.equal(IMAGING_OS_LEGACY_WORKSPACE_ROOT, "src/lib/imagingOs");
  });

  it("allowlist reduced to sole legacy workspace bridge", () => {
    assert.equal(IMAGING_PATH_BOUNDARY_CROSS_IMPORT_ALLOWLIST.length, 1);
    assert.equal(
      IMAGING_PATH_BOUNDARY_CROSS_IMPORT_ALLOWLIST[0],
      "src/lib/imagingOs/imagingOsWorkspaceBridge.ts|@/src/lib/imaging-os/workspaceBridge"
    );
  });

  it("canonical modules do not import legacy imagingOsProtocol", () => {
    const violations = scanImagingPathCrossImportViolations(REPO_ROOT).filter(
      (v) =>
        v.fromBoundary === "canonical" &&
        v.specifier.includes("src/lib/imagingOs/imagingOsProtocol")
    );
    assert.deepEqual(violations, []);
  });

  it("permits only the sole legacy workspace bridge for imaging-os imports", () => {
    assert.equal(
      isPermittedLegacyToCanonicalCrossImport(
        LEGACY_WORKSPACE_BRIDGE_FILE,
        CANONICAL_WORKSPACE_BRIDGE_SPECIFIER
      ),
      true
    );
    assert.equal(
      isPermittedLegacyToCanonicalCrossImport(
        "src/lib/imagingOs/imagingOsMutations.server.ts",
        "@/src/lib/imaging-os/workspaceBridge"
      ),
      false
    );
    assert.equal(
      isPermittedLegacyToCanonicalCrossImport(
        LEGACY_WORKSPACE_BRIDGE_FILE,
        "@/src/lib/imaging-os/protocolSlotVocabulary"
      ),
      false
    );
  });

  it("repo scan has no unauthorized legacy-to-canonical cross-imports", () => {
    const unauthorized = findUnauthorizedLegacyToCanonicalCrossImports(REPO_ROOT);
    assert.deepEqual(
      unauthorized,
      [],
      unauthorized
        .map((v) => `${v.file}:${v.line} legacy→canonical imports ${v.specifier}`)
        .join("\n")
    );
  });

  it("repo scan has no canonical-to-legacy cross-imports", () => {
    const violations = scanImagingPathCrossImportViolations(REPO_ROOT).filter(
      (v) => v.fromBoundary === "canonical" && v.toBoundary === "legacy"
    );
    assert.deepEqual(violations, []);
  });
});
