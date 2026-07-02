import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  D4_WORKSPACE_KINDS,
  WORKSPACE_SHELL_KINDS,
  isD4WorkspaceKind,
  isWorkspaceShellKind,
  parseWorkspaceRef,
} from "./types";

describe("workspace shell types", () => {
  it("includes D4 kinds in WORKSPACE_SHELL_KINDS", () => {
    for (const kind of D4_WORKSPACE_KINDS) {
      assert.ok((WORKSPACE_SHELL_KINDS as readonly string[]).includes(kind));
    }
  });

  it("parseWorkspaceRef accepts all shell kinds", () => {
    const id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    for (const kind of WORKSPACE_SHELL_KINDS) {
      const ref = parseWorkspaceRef(`${kind}:${id}`);
      assert.deepEqual(ref, { kind, id });
    }
  });

  it("parseWorkspaceRef rejects reserved future kinds", () => {
    assert.equal(parseWorkspaceRef("booking:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), null);
    assert.equal(parseWorkspaceRef("prescription:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), null);
  });

  it("isWorkspaceShellKind and isD4WorkspaceKind", () => {
    assert.equal(isWorkspaceShellKind("payment"), true);
    assert.equal(isD4WorkspaceKind("payment"), true);
    assert.equal(isD4WorkspaceKind("patient"), false);
    assert.equal(isWorkspaceShellKind("booking"), false);
  });
});
