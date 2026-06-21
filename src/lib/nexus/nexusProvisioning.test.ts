import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { signIiohrNexusRequestForTests } from "./iiohrNexusWebhookAuth.server";
import {
  evaluateNexusGate,
  handleNexusProvisionHttp,
  handleNexusRollbackHttp,
  handleNexusStateHttp,
} from "./nexusIiohrApi.server";
import { createNexusTestStore, nexusTestDeps } from "./nexusProvisioningTestStore";
import { provisionExternalProfessionalFromNexus } from "./provisionExternalProfessional.server";
import { readExternalProfessionalState } from "./readExternalProfessionalState.server";
import { rollbackExternalProfessionalProvisioning } from "./rollbackExternalProfessionalProvisioning.server";

const TENANT = "00000000-0000-4000-8000-000000000001";
const SITE = "00000000-0000-4000-8000-000000000002";
const SECRET = "nexus-test-secret-value";

function basePayload(over: Record<string, unknown> = {}) {
  return {
    globalProfessionalId: "iiohr:prof:001",
    email: "surgeon@example.com",
    name: "Dr Example",
    professionalType: "hair_surgeon",
    tenantId: TENANT,
    siteId: SITE,
    staffType: "clinical",
    approvedRoles: ["surgeon_operator", "consultation_doctor"],
    ...over,
  };
}

function signedHeaders(rawBody: string, timestamp = String(Math.floor(Date.now() / 1000))) {
  const { signature } = signIiohrNexusRequestForTests({ secret: SECRET, timestamp, rawBody });
  return {
    get(name: string) {
      if (name === "x-iiohr-fi-webhook-timestamp") return timestamp;
      if (name === "x-iiohr-fi-webhook-signature") return signature;
      return null;
    },
  };
}

describe("nexusIiohrApi gate and auth", () => {
  it("disabled endpoint rejects with 403", async () => {
    const rawBody = JSON.stringify(basePayload());
    const res = await handleNexusProvisionHttp(
      { headers: signedHeaders(rawBody) as unknown as Headers },
      rawBody,
      { enabled: false, secret: SECRET }
    );
    assert.equal(res.httpStatus, 403);
    assert.equal(res.body.ok, false);
  });

  it("invalid signature rejects with 401", async () => {
    const rawBody = JSON.stringify(basePayload());
    const res = await handleNexusProvisionHttp(
      {
        headers: {
          get(name: string) {
            if (name === "x-iiohr-fi-webhook-timestamp") return String(Math.floor(Date.now() / 1000));
            if (name === "x-iiohr-fi-webhook-signature") return "00".repeat(32);
            return null;
          },
        } as unknown as Headers,
      },
      rawBody,
      { enabled: true, secret: SECRET }
    );
    assert.equal(res.httpStatus, 401);
    assert.equal(res.body.ok, false);
  });

  it("evaluateNexusGate returns 503 when secret missing", () => {
    const gate = evaluateNexusGate({ enabled: true, secret: null });
    assert.ok(gate);
    assert.equal(gate.httpStatus, 503);
  });
});

describe("nexus provisioning services", () => {
  let store: ReturnType<typeof createNexusTestStore>;

  beforeEach(() => {
    store = createNexusTestStore(TENANT, SITE);
  });

  it("invalid role rejects", async () => {
    const result = await provisionExternalProfessionalFromNexus(
      basePayload({ approvedRoles: ["not_a_real_role"] }),
      store.client,
      nexusTestDeps(store)
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.httpStatus, 400);
      assert.match(result.error, /Invalid role/);
    }
  });

  it("provision upserts professional and creates membership + inactive staff profile", async () => {
    const result = await provisionExternalProfessionalFromNexus(
      basePayload(),
      store.client,
      nexusTestDeps(store)
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.state.professional);
      assert.equal(result.state.professional?.email, "surgeon@example.com");
      assert.equal(result.state.memberships.length, 1);
      assert.equal(result.state.memberships[0]?.membership_status, "pending");
      assert.equal(result.state.staffProfiles.length, 1);
      assert.equal(result.state.staffProfiles[0]?.active, false);
    }
  });

  it("provision assigns approved roles idempotently", async () => {
    const first = await provisionExternalProfessionalFromNexus(
      basePayload(),
      store.client,
      nexusTestDeps(store)
    );
    assert.equal(first.ok, true);
    if (first.ok) {
      assert.equal(first.state.activeRoles.length, 2);
    }

    const second = await provisionExternalProfessionalFromNexus(
      basePayload({ approvedRoles: ["surgeon_operator", "consultation_doctor", "audit_viewer"] }),
      store.client,
      nexusTestDeps(store)
    );
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(second.state.activeRoles.length, 3);
      const codes = second.state.activeRoles.map((r) => r.role_code).sort();
      assert.deepEqual(codes, ["audit_viewer", "consultation_doctor", "surgeon_operator"]);
    }
  });

  it("duplicate request does not duplicate roles", async () => {
    await provisionExternalProfessionalFromNexus(basePayload(), store.client, nexusTestDeps(store));
    await provisionExternalProfessionalFromNexus(basePayload(), store.client, nexusTestDeps(store));
    const state = await readExternalProfessionalState("iiohr:prof:001", store.client);
    assert.equal(state.ok, true);
    if (state.ok) {
      assert.equal(state.state.activeRoles.length, 2);
    }
  });

  it("rollback revokes only nexus_created roles for tenant", async () => {
    await provisionExternalProfessionalFromNexus(basePayload(), store.client, nexusTestDeps(store));

    store.roles.set("manual::role", {
      id: "manual-role-id",
      global_professional_id: "iiohr:prof:001",
      tenant_id: TENANT,
      role_code: "fi_admin",
      assigned_by: "manual",
      active: true,
      nexus_created: false,
      created_at: new Date().toISOString(),
      revoked_at: null,
    });

    const rollback = await rollbackExternalProfessionalProvisioning(
      { globalProfessionalId: "iiohr:prof:001", tenantId: TENANT, reason: "certification revoked" },
      store.client
    );
    assert.equal(rollback.ok, true);
    if (rollback.ok) {
      assert.equal(rollback.state.activeRoles.length, 1);
      assert.equal(rollback.state.activeRoles[0]?.role_code, "fi_admin");
      assert.equal(rollback.state.activeRoles[0]?.nexus_created, false);
      assert.equal(rollback.state.staffProfiles[0]?.active, false);
      assert.equal(rollback.state.memberships[0]?.membership_status, "revoked");
    }
  });

  it("state endpoint returns current state via signed GET material", async () => {
    await provisionExternalProfessionalFromNexus(basePayload(), store.client, nexusTestDeps(store));
    const gid = "iiohr:prof:001";
    const res = await handleNexusStateHttp(
      { headers: signedHeaders(gid) as unknown as Headers },
      gid,
      { enabled: true, secret: SECRET },
      { readState: (id) => readExternalProfessionalState(id, store.client) }
    );
    assert.equal(res.httpStatus, 200);
    assert.equal(res.body.ok, true);
    const state = res.body.state as { activeRoles: unknown[] };
    assert.equal(state.activeRoles.length, 2);
  });
});

describe("nexus rollback http", () => {
  it("rollback requires reason", async () => {
    const rawBody = JSON.stringify({
      globalProfessionalId: "iiohr:prof:001",
      tenantId: TENANT,
      reason: "",
    });
    const res = await handleNexusRollbackHttp(
      { headers: signedHeaders(rawBody) as unknown as Headers },
      rawBody,
      { enabled: true, secret: SECRET }
    );
    assert.equal(res.httpStatus, 400);
  });
});
