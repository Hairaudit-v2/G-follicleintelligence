import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { stacksEqual } from "@/src/components/fi-os/workspace/workspaceShellUrlWrite";
import type { WorkspaceRef } from "@/src/lib/fiOs/workspaceShell/types";

const PATIENT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const LEAD = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("workspaceShellUrlWrite stacksEqual", () => {
  it("compares workspace stacks by kind:id keys", () => {
    const a: WorkspaceRef[] = [
      { kind: "patient", id: PATIENT },
      { kind: "lead", id: LEAD },
    ];
    const b: WorkspaceRef[] = [...a];
    assert.equal(stacksEqual(a, b), true);
    assert.equal(stacksEqual(a, [{ kind: "patient", id: PATIENT }]), false);
  });
});
