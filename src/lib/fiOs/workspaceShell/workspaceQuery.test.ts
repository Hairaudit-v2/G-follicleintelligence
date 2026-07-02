import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatWorkspaceSearchParam, parseWorkspaceSearchParam } from "./workspaceQuery";

const PATIENT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const LEAD = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("workspaceQuery", () => {
  it("parses a single workspace ref", () => {
    assert.deepEqual(parseWorkspaceSearchParam(`patient:${PATIENT}`), [
      { kind: "patient", id: PATIENT },
    ]);
  });

  it("parses a comma-separated stack", () => {
    assert.deepEqual(parseWorkspaceSearchParam(`patient:${PATIENT},lead:${LEAD}`), [
      { kind: "patient", id: PATIENT },
      { kind: "lead", id: LEAD },
    ]);
  });

  it("rejects invalid kinds and non-uuid ids", () => {
    assert.deepEqual(parseWorkspaceSearchParam("patient:not-a-uuid"), []);
    assert.deepEqual(parseWorkspaceSearchParam("case:123"), []);
  });

  it("round-trips stack formatting", () => {
    const stack = [
      { kind: "patient" as const, id: PATIENT },
      { kind: "lead" as const, id: LEAD },
    ];
    assert.equal(formatWorkspaceSearchParam(stack), `patient:${PATIENT},lead:${LEAD}`);
    assert.deepEqual(parseWorkspaceSearchParam(formatWorkspaceSearchParam(stack)!), stack);
  });
});
