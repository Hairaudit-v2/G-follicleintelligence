import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inferWorkspaceFromHref } from "./workspaceHref";

const TENANT = "11111111-1111-1111-1111-111111111111";
const PATIENT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const LEAD = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const APPT = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const PAYMENT = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const PATHOLOGY = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const SURGERY = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const CONSULT = "11111111-2222-3333-4444-555555555555";
const STAFF = "66666666-7777-8888-9999-aaaaaaaaaaaa";

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

  it("maps pathology result hrefs", () => {
    assert.deepEqual(
      inferWorkspaceFromHref(
        `/fi-admin/${TENANT}/patients/${PATIENT}/blood-results/${PATHOLOGY}`
      ),
      { kind: "pathology_result", id: PATHOLOGY }
    );
  });

  it("maps surgery case hrefs", () => {
    assert.deepEqual(inferWorkspaceFromHref(`/fi-admin/${TENANT}/cases/${SURGERY}`), {
      kind: "surgery_case",
      id: SURGERY,
    });
    assert.deepEqual(inferWorkspaceFromHref(`/fi-admin/${TENANT}/cases/${SURGERY}/summary`), {
      kind: "surgery_case",
      id: SURGERY,
    });
    assert.deepEqual(inferWorkspaceFromHref(`/fi-admin/${TENANT}/surgery/cases/${SURGERY}`), {
      kind: "surgery_case",
      id: SURGERY,
    });
  });

  it("maps consultation hrefs", () => {
    assert.deepEqual(inferWorkspaceFromHref(`/fi-admin/${TENANT}/consultations/${CONSULT}`), {
      kind: "consultation",
      id: CONSULT,
    });
  });

  it("does not map consultation sub-routes", () => {
    assert.equal(
      inferWorkspaceFromHref(`/fi-admin/${TENANT}/consultations/${CONSULT}/forms`),
      null
    );
  });

  it("maps payment hrefs", () => {
    assert.deepEqual(
      inferWorkspaceFromHref(`/fi-admin/${TENANT}/financial/payments/${PAYMENT}`),
      { kind: "payment", id: PAYMENT }
    );
    assert.deepEqual(
      inferWorkspaceFromHref(`/fi-admin/${TENANT}/financial/payment-requests/${PAYMENT}`),
      { kind: "payment", id: PAYMENT }
    );
    assert.deepEqual(inferWorkspaceFromHref(`/fi-admin/${TENANT}/payments/${PAYMENT}`), {
      kind: "payment",
      id: PAYMENT,
    });
  });

  it("maps staff hrefs", () => {
    assert.deepEqual(inferWorkspaceFromHref(`/fi-admin/${TENANT}/workforce-os/staff/${STAFF}`), {
      kind: "staff",
      id: STAFF,
    });
    assert.deepEqual(inferWorkspaceFromHref(`/fi-admin/${TENANT}/staff/${STAFF}`), {
      kind: "staff",
      id: STAFF,
    });
    assert.deepEqual(inferWorkspaceFromHref(`/fi-admin/${TENANT}/staff/${STAFF}/twin`), {
      kind: "staff",
      id: STAFF,
    });
    assert.deepEqual(inferWorkspaceFromHref(`/fi-admin/${TENANT}/team/${STAFF}`), {
      kind: "staff",
      id: STAFF,
    });
  });

  it("ignores list routes and unrelated modules", () => {
    assert.equal(inferWorkspaceFromHref(`/fi-admin/${TENANT}/patients`), null);
    assert.equal(inferWorkspaceFromHref(`/fi-admin/${TENANT}/calendar`), null);
    assert.equal(inferWorkspaceFromHref(`/fi-admin/${TENANT}/reception`), null);
    assert.equal(inferWorkspaceFromHref(`/fi-admin/${TENANT}/financial/payments`), null);
    assert.equal(inferWorkspaceFromHref(`/fi-admin/${TENANT}/consultations`), null);
  });
});
