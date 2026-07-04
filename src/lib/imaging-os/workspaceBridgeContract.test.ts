import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  CANONICAL_WORKSPACE_BRIDGE_SPECIFIER,
  LEGACY_WORKSPACE_BRIDGE_FILE,
  WORKSPACE_BRIDGE_ALLOWED_EXPORTS,
  WORKSPACE_BRIDGE_TYPE_EXPORTS,
  WORKSPACE_BRIDGE_VALUE_EXPORTS,
} from "./workspaceBridgeContract";
import {
  extractNamedReExportsFromSource,
  flattenExportSurface,
  hasBroadReExport,
} from "./workspaceBridgeContractCore";

const REPO_ROOT = process.cwd();
const CANONICAL_BRIDGE_PATH = path.join(REPO_ROOT, "src/lib/imaging-os/workspaceBridge.ts");
const LEGACY_BRIDGE_PATH = path.join(REPO_ROOT, "src/lib/imagingOs/imagingOsWorkspaceBridge.ts");

describe("workspaceBridgeContract", () => {
  it("canonical workspaceBridge exports only contract-approved symbols", () => {
    const source = fs.readFileSync(CANONICAL_BRIDGE_PATH, "utf8");
    assert.equal(hasBroadReExport(source), false, "workspaceBridge must not use export *");

    const surface = extractNamedReExportsFromSource(source);
    assert.deepEqual(surface.values, [...WORKSPACE_BRIDGE_VALUE_EXPORTS].sort());
    assert.deepEqual(surface.types, [...WORKSPACE_BRIDGE_TYPE_EXPORTS].sort());
    assert.deepEqual(flattenExportSurface(surface), [...WORKSPACE_BRIDGE_ALLOWED_EXPORTS].sort());
  });

  it("legacy imagingOsWorkspaceBridge mirrors canonical named exports without export *", () => {
    const source = fs.readFileSync(LEGACY_BRIDGE_PATH, "utf8");
    assert.equal(hasBroadReExport(source), false, "legacy bridge must not use export *");

    const canonicalSource = fs.readFileSync(CANONICAL_BRIDGE_PATH, "utf8");
    const canonicalSurface = extractNamedReExportsFromSource(canonicalSource);
    const legacySurface = extractNamedReExportsFromSource(source);

    assert.deepEqual(legacySurface.values, canonicalSurface.values);
    assert.deepEqual(legacySurface.types, canonicalSurface.types);
  });

  it("documents the sole intentional cross-tree bridge endpoints", () => {
    assert.equal(LEGACY_WORKSPACE_BRIDGE_FILE, "src/lib/imagingOs/imagingOsWorkspaceBridge.ts");
    assert.equal(
      CANONICAL_WORKSPACE_BRIDGE_SPECIFIER,
      "@/src/lib/imaging-os/workspaceBridge"
    );
  });
});