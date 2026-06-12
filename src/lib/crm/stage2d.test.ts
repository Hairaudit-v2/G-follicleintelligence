import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  crmCreateLeadBodySchema,
  crmMessagePreviewBodySchema,
  crmMoveLeadStageBodySchema,
} from "./crmApiSchemas";
import { assertMessagePayloadHasNoForbiddenBodyKeys } from "./messageBodyKeysPolicy";
import { isCrmMutationRole, isCrmShellNavRole } from "./crmGatePolicy";
import { isFiAdminApiKeyMatch } from "./crmFiAdminApiKeyMatch";
import { validateCrmMessagePreviewInput } from "./validation";

describe("Stage 2D CRM gates (pure)", () => {
  it("rejects mutations without FI admin key match when no session is modelled", () => {
    assert.equal(isFiAdminApiKeyMatch(undefined, "expected-secret"), false);
    assert.equal(isFiAdminApiKeyMatch("wrong", "expected-secret"), false);
    assert.equal(isFiAdminApiKeyMatch("expected-secret", "expected-secret"), true);
  });

  it("member role is not a CRM mutation role", () => {
    assert.equal(isCrmMutationRole("member"), false);
    assert.equal(isCrmMutationRole("crm_operator"), true);
  });
});

describe("Stage 2E CRM shell nav policy (pure)", () => {
  it("allows fi_admin and crm_operator only for shell nav", () => {
    assert.equal(isCrmShellNavRole("fi_admin"), true);
    assert.equal(isCrmShellNavRole("crm_operator"), true);
    assert.equal(isCrmShellNavRole("admin"), true);
    assert.equal(isCrmShellNavRole("member"), false);
  });
});

describe("Stage 2D Zod CRM payloads", () => {
  it("create lead requires personId or resolvable person fields and a summary", () => {
    const bad = crmCreateLeadBodySchema.safeParse({ status: "open" });
    assert.equal(bad.success, false);
    const badNoPerson = crmCreateLeadBodySchema.safeParse({ summary: "Lead title" });
    assert.equal(badNoPerson.success, false);
    const ok = crmCreateLeadBodySchema.safeParse({
      summary: "Lead title",
      personId: "11111111-1111-4111-8111-111111111111",
    });
    assert.ok(ok.success);
    const ok2 = crmCreateLeadBodySchema.safeParse({
      summary: "Lead title",
      person: { email: "a@b.co" },
    });
    assert.ok(ok2.success);
  });

  it("move stage requires target stage id", () => {
    const bad = crmMoveLeadStageBodySchema.safeParse({ adminKey: "x" });
    assert.equal(bad.success, false);
    const ok = crmMoveLeadStageBodySchema.safeParse({
      toStageId: "22222222-2222-4222-8222-222222222222",
    });
    assert.ok(ok.success);
  });

  it("message preview schema rejects full-body style keys inside preview", () => {
    const bad = crmMessagePreviewBodySchema.safeParse({
      preview: { channel: "email", direction: "inbound", content: "nope" },
    });
    assert.equal(bad.success, false);
  });
});

describe("Stage 2D message body key policy", () => {
  it("rejects content/html/text/fullbody-style keys", () => {
    assert.throws(() => assertMessagePayloadHasNoForbiddenBodyKeys({ content: "x" }), /full-body/);
    assert.throws(() => assertMessagePayloadHasNoForbiddenBodyKeys({ HTML: "x" }), /full-body/);
    assert.throws(() => validateCrmMessagePreviewInput({ channel: "x", direction: "inbound", text: "t" }), /full-body/);
  });
});
