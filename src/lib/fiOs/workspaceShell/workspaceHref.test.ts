import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inferWorkspaceFromHref } from "./workspaceHref";

const TENANT = "11111111-1111-1111-1111-111111111111";
const PATIENT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const LEAD = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const APPT = "cccccccc-cccc-cccc-cccc-cccccccccccc";

describe("inferWorkspaceFromHref", () => {
  it("maps patient profile hrefs", () => {
    assert.deepEqual(inferWorkspaceFromHref(`/fi-admin/${TENANT}/patients/${PATIENT}`), {
      kind: "patient",
      id: PATIENT,
    });
  });

  it("maps CRM lead hrefs", () => {
    assert.deepEqual(inferWorkspaceFromHref(`/fi-admin/${TENANT}/crm/leads/${LEAD}`), {
      kind: "lead",
      id: LEAD,
    });
  });

  it("maps appointment hrefs", () => {
    assert.deepEqual(inferWorkspaceFromHref(`/fi-admin/${TENANT}/appointments/${APPT}`), {
      kind: "appointment",
      id: APPT,
    });
  });

  it("ignores list routes and unrelated modules", () => {
    assert.equal(inferWorkspaceFromHref(`/fi-admin/${TENANT}/patients`), null);
    assert.equal(inferWorkspaceFromHref(`/fi-admin/${TENANT}/calendar`), null);
    assert.equal(inferWorkspaceFromHref(`/fi-admin/${TENANT}/reception`), null);
  });
});
