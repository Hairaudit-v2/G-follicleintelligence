import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { IMAGING_OS_BARREL_IMPORT_ALLOWLIST } from "./imagingOsBarrelImportAllowlist";
import {
  findBarrelImportsInSource,
  isAllowlistedBarrelImportFile,
  isCatchAllImagingOsBarrelSpecifier,
  isFocusedImagingOsEntrySpecifier,
  scanImagingOsBarrelImports,
} from "./imagingOsBarrelGuardrailCore";

const REPO_ROOT = process.cwd();

describe("imagingOsBarrelGuardrailCore", () => {
  it("detects catch-all barrel specifiers", () => {
    assert.equal(isCatchAllImagingOsBarrelSpecifier("@/src/lib/imaging-os"), true);
    assert.equal(isCatchAllImagingOsBarrelSpecifier("@/src/lib/imaging-os/index"), true);
    assert.equal(isCatchAllImagingOsBarrelSpecifier("../src/lib/imaging-os"), true);
    assert.equal(isCatchAllImagingOsBarrelSpecifier("@/src/lib/imaging-os/pipeline"), false);
    assert.equal(
      isCatchAllImagingOsBarrelSpecifier("@/src/lib/imaging-os/adapters/hairauditImageAdapter"),
      false
    );
  });

  it("treats focused entry-point imports as safe", () => {
    assert.equal(isFocusedImagingOsEntrySpecifier("@/src/lib/imaging-os/ai"), true);
    assert.equal(isFocusedImagingOsEntrySpecifier("@/src/lib/imaging-os/capture"), true);
    assert.equal(isFocusedImagingOsEntrySpecifier("@/src/lib/imaging-os/review"), true);
    assert.equal(isFocusedImagingOsEntrySpecifier("@/src/lib/imaging-os/graft-tray"), true);
    assert.equal(isCatchAllImagingOsBarrelSpecifier("@/src/lib/imaging-os/ai"), false);
  });

  it("fails fixture scan for a new non-allowlisted catch-all import", () => {
    const violations = findBarrelImportsInSource(
      `import { runImagingOsStubPipeline } from "@/src/lib/imaging-os";\n`,
      "src/lib/example/NewFeature.ts"
    );
    assert.equal(violations.length, 1);
    assert.equal(violations[0]?.specifier, "@/src/lib/imaging-os");
    assert.equal(violations[0]?.file, "src/lib/example/NewFeature.ts");
  });

  it("passes fixture scan for focused entry-point imports", () => {
    const violations = findBarrelImportsInSource(
      [
        `import { IMAGING_AI_ANALYSIS_KINDS } from "@/src/lib/imaging-os/ai";`,
        `import { normalizeFiImageCaptureSource } from "@/src/lib/imaging-os/capture";`,
        `import { matchesImagingReviewQueueFilters } from "@/src/lib/imaging-os/review";`,
        `import { isGraftTrayCapture } from "@/src/lib/imaging-os/graft-tray";`,
        `import { IMAGING_OS_INGESTION_PIPELINE_VERSION } from "@/src/lib/imaging-os/pipeline";`,
      ].join("\n"),
      "src/lib/imaging-os/imagingApiSurface.test.ts"
    );
    assert.deepEqual(violations, []);
  });
});

describe("imagingOs barrel import allowlist", () => {
  it("only contains existing legacy phase test files", () => {
    for (const entry of IMAGING_OS_BARREL_IMPORT_ALLOWLIST) {
      assert.ok(entry.startsWith("tests/imagingOsPhaseIm"), entry);
      assert.ok(fs.existsSync(path.join(REPO_ROOT, entry)), `${entry} missing on disk`);
      assert.equal(isAllowlistedBarrelImportFile(entry), true);
    }
  });

  it("repo scan finds no violations outside the allowlist", () => {
    const violations = scanImagingOsBarrelImports(REPO_ROOT);
    assert.deepEqual(
      violations,
      [],
      violations.map((v) => `${v.file}:${v.line} imports ${v.specifier}`).join("\n")
    );
  });

  it("allowlisted legacy imports still scan clean under guardrail", () => {
    const sample = IMAGING_OS_BARREL_IMPORT_ALLOWLIST[0];
    if (!sample) {
      assert.equal(isAllowlistedBarrelImportFile("tests/imagingOsPhaseIm1.test.ts"), false);
      return;
    }
    const source = fs.readFileSync(path.join(REPO_ROOT, sample), "utf8");
    const violations = findBarrelImportsInSource(source, sample);
    assert.ok(
      violations.length > 0,
      "fixture allowlisted file should still contain barrel imports"
    );
    assert.equal(isAllowlistedBarrelImportFile(sample), true);
  });
});
