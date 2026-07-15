import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyHubspotMutatingRequest,
  isAuthSessionRequest,
  isHubspotWorkspaceRequest,
} from "./hubspotMutationGuard";

function fakeRequest(input: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  postData?: string;
}) {
  return {
    method: () => input.method,
    url: () => input.url,
    headers: () => input.headers ?? {},
    postData: () => input.postData ?? null,
  } as Parameters<typeof classifyHubspotMutatingRequest>[0];
}

describe("hubspotMutationGuard", () => {
  it("allows auth session POSTs", () => {
    assert.equal(
      isAuthSessionRequest("https://xyz.supabase.co/auth/v1/token?grant_type=password"),
      true,
    );
    assert.equal(
      classifyHubspotMutatingRequest(
        fakeRequest({
          method: "POST",
          url: "https://xyz.supabase.co/auth/v1/token?grant_type=password",
        }),
      ),
      null,
    );
  });

  it("flags HubSpot integration API mutations", () => {
    const violation = classifyHubspotMutatingRequest(
      fakeRequest({
        method: "POST",
        url: "https://follicleintelligence.ai/api/tenants/c2615b95-b707-4485-aa5f-be8f78ec868a/integrations/hubspot/contact",
      }),
    );
    assert.ok(violation);
    assert.equal(violation?.method, "POST");
    assert.match(violation?.reason ?? "", /HubSpot integration API/i);
  });

  it("allows documented Next.js loader POSTs without mutation fingerprints", () => {
    const tenant = "c2615b95-b707-4485-aa5f-be8f78ec868a";
    assert.equal(
      classifyHubspotMutatingRequest(
        fakeRequest({
          method: "POST",
          url: `https://follicleintelligence.ai/fi-admin/${tenant}/settings/integrations/hubspot?tab=import-review`,
          headers: { "next-action": "abc", "content-type": "text/plain;charset=UTF-8" },
          postData: '["tenant","integration"]',
        }),
      ),
      null,
    );
  });

  it("rejects loader POSTs that fingerprint HubSpot mutations", () => {
    const tenant = "c2615b95-b707-4485-aa5f-be8f78ec868a";
    const violation = classifyHubspotMutatingRequest(
      fakeRequest({
        method: "POST",
        url: `https://follicleintelligence.ai/fi-admin/${tenant}/settings/integrations/hubspot?tab=backup-sync`,
        headers: { "next-action": "abc" },
        postData: "runHubspotSyncAction",
      }),
    );
    assert.ok(violation);
  });

  it("recognizes workspace URLs", () => {
    assert.equal(
      isHubspotWorkspaceRequest(
        "https://follicleintelligence.ai/fi-admin/t/settings/integrations/hubspot?tab=overview",
      ),
      true,
    );
    assert.equal(isHubspotWorkspaceRequest("https://follicleintelligence.ai/fi-admin/t/crm"), false);
  });
});
