import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { tryBuildOpenAiVisionGraftTrayEstimate } from "./graftTrayCountOpenAiProvider.server";
import { parseGraftTrayAiFeatureFlags } from "./graftTrayCountProviderCore";
import {
  findForbiddenProviderImportsInSource,
  IMAGING_OS_PROVIDER_ADAPTER_MODULES,
  isForbiddenProviderModuleSpecifier,
  isImagingOsProviderAdapterModule,
  scanImagingOsFoundationProviderImports,
} from "./imagingOsProviderImportGuardCore";

const REPO_ROOT = process.cwd();
const IMAGING_OS_DIR = path.join(REPO_ROOT, "src/lib/imaging-os");

describe("imagingOsProviderImportGuardCore", () => {
  it("flags provider SDK module specifiers", () => {
    assert.equal(isForbiddenProviderModuleSpecifier("openai"), true);
    assert.equal(isForbiddenProviderModuleSpecifier("openai/resources/chat"), true);
    assert.equal(isForbiddenProviderModuleSpecifier("@/src/lib/openAiHairImageClassifier"), true);
    assert.equal(
      isForbiddenProviderModuleSpecifier(
        "@/src/lib/hair-intelligence/imageClassification/classifyClinicalHairImageFallback"
      ),
      false
    );
  });

  it("does not flag provider vocabulary strings without import statements", () => {
    const violations = findForbiddenProviderImportsInSource(
      [
        `const provider = "openai_vision";`,
        `let usedOpenAi = false;`,
        `import { parseGraftTrayAiFeatureFlags } from "./graftTrayCountProviderCore";`,
      ].join("\n"),
      "src/lib/imaging-os/graftTrayCountProviderCore.ts"
    );
    assert.deepEqual(violations, []);
  });

  it("fails fixture scan for foundation module importing openai SDK", () => {
    const violations = findForbiddenProviderImportsInSource(
      `import OpenAI from "openai";\n`,
      "src/lib/imaging-os/classification.ts"
    );
    assert.equal(violations.length, 1);
    assert.equal(violations[0]?.specifier, "openai");
  });

  it("graft tray OpenAI adapter is registered as a provider adapter module", () => {
    assert.equal(isImagingOsProviderAdapterModule("graftTrayCountOpenAiProvider.server.ts"), true);
    assert.equal(isImagingOsProviderAdapterModule("graftTrayCountProviderCore.ts"), false);
  });

  it("foundation scan finds no forbidden provider imports outside adapter modules", () => {
    const violations = scanImagingOsFoundationProviderImports({
      imagingOsDir: IMAGING_OS_DIR,
      readFile: (absolutePath) => fs.readFileSync(absolutePath, "utf8"),
      listFiles: (dir) =>
        fs
          .readdirSync(dir)
          .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")),
    });
    assert.deepEqual(
      violations,
      [],
      violations.map((v) => `${v.file}:${v.line} imports ${v.specifier}`).join("\n")
    );
  });

  it("provider adapter modules are explicitly listed", () => {
    for (const moduleName of IMAGING_OS_PROVIDER_ADAPTER_MODULES) {
      assert.ok(fs.existsSync(path.join(IMAGING_OS_DIR, moduleName)), `${moduleName} missing`);
    }
  });
});

describe("graftTrayCountOpenAiProvider.server", () => {
  it("returns null for default stub feature flags", () => {
    const flags = parseGraftTrayAiFeatureFlags({});
    const outcome = tryBuildOpenAiVisionGraftTrayEstimate({
      flags,
      classifierMode: "live",
      imageId: "img-1",
      manualCount: 100,
    });
    assert.equal(outcome, null);
  });

  it("returns null when openai_vision is configured but classifier mode is stub", () => {
    const flags = parseGraftTrayAiFeatureFlags({
      FI_IMAGING_ENABLE_GRAFT_TRAY_AI_COUNT: "true",
      FI_IMAGING_GRAFT_TRAY_AI_PROVIDER: "openai_vision",
    });
    const outcome = tryBuildOpenAiVisionGraftTrayEstimate({
      flags,
      classifierMode: "stub",
      imageId: "img-1",
      manualCount: 100,
    });
    assert.equal(outcome, null);
  });
});