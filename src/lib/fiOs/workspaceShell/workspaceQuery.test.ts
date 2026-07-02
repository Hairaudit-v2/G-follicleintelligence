import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatWorkspaceSearchParam, parseWorkspaceSearchParam } from "./workspaceQuery";

const PATIENT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const LEAD = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PAYMENT = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const PATHOLOGY = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const SURGERY = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const CONSULT = "11111111-2222-3333-4444-555555555555";
const STAFF = "66666666-7777-8888-9999-aaaaaaaaaaaa";

describe("workspaceQuery", () => {
  it("parses a single workspace ref", () => {
    assert.deepEqual(parseWorkspaceSearchParam(`patient:${PATIENT}`), [
      { kind: "patient", id: PATIENT },
    ]);
  });

  it("parses D4 workspace kinds", () => {
    assert.deepEqual(parseWorkspaceSearchParam(`payment:${PAYMENT}`), [
      { kind: "payment", id: PAYMENT },
    ]);
    assert.deepEqual(parseWorkspaceSearchParam(`pathology_result:${PATHOLOGY}`), [
      { kind: "pathology_result", id: PATHOLOGY },
    ]);
    assert.deepEqual(parseWorkspaceSearchParam(`surgery_case:${SURGERY}`), [
      { kind: "surgery_case", id: SURGERY },
    ]);
    assert.deepEqual(parseWorkspaceSearchParam(`consultation:${CONSULT}`), [
      { kind: "consultation", id: CONSULT },
    ]);
    assert.deepEqual(parseWorkspaceSearchParam(`staff:${STAFF}`), [{ kind: "staff", id: STAFF }]);
  });

  it("parses a comma-separated stack including D4 kinds", () => {
    assert.deepEqual(
      parseWorkspaceSearchParam(`patient:${PATIENT},consultation:${CONSULT},staff:${STAFF}`),
      [
        { kind: "patient", id: PATIENT },
        { kind: "consultation", id: CONSULT },
        { kind: "staff", id: STAFF },
      ]
    );
  });

  it("rejects invalid kinds and non-uuid ids", () => {
    assert.deepEqual(parseWorkspaceSearchParam("patient:not-a-uuid"), []);
    assert.deepEqual(parseWorkspaceSearchParam("case:123"), []);
    assert.deepEqual(parseWorkspaceSearchParam("booking:12345678-1234-1234-1234-123456789012"), []);
    assert.deepEqual(parseWorkspaceSearchParam("prescription:12345678-1234-1234-1234-123456789012"), []);
  });

  it("round-trips stack formatting", () => {
    const stack = [
      { kind: "patient" as const, id: PATIENT },
      { kind: "lead" as const, id: LEAD },
    ];
    assert.equal(formatWorkspaceSearchParam(stack), `patient:${PATIENT},lead:${LEAD}`);
    assert.deepEqual(parseWorkspaceSearchParam(formatWorkspaceSearchParam(stack)!), stack);
  });

  it("round-trips D4 stacked URL", () => {
    const stack = [
      { kind: "payment" as const, id: PAYMENT },
      { kind: "surgery_case" as const, id: SURGERY },
    ];
    const serialized = formatWorkspaceSearchParam(stack);
    assert.equal(serialized, `payment:${PAYMENT},surgery_case:${SURGERY}`);
    assert.deepEqual(parseWorkspaceSearchParam(serialized!), stack);
  });
});
