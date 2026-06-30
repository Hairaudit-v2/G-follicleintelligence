import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  assertHubspotLeadFlowWebhookAuthorized,
  assertHubspotWebhookAuthorized,
  buildHubspotSignatureRequestUri,
  computeHubspotSignatureV3,
  HubspotWebhookAuthError,
} from "./hubspotWebhookAuth.server";

const WEBHOOK_SECRET = "test-hubspot-webhook-secret-32!";
const CLIENT_SECRET = "test-hubspot-client-secret-value";
const WEBHOOK_URL =
  "https://example.com/api/tenants/11111111-1111-4111-8111-111111111111/integrations/hubspot/webhook";
const RAW_BODY = `[{"objectId":12345,"subscriptionType":"contact.creation"}]`;

function reqWithBearer(token: string | null, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  if (token !== null) headers.set("Authorization", `Bearer ${token}`);
  return new Request(WEBHOOK_URL, { method: "POST", ...init, headers });
}

function reqWithHubspotSignature(options: {
  rawBody?: string;
  timestamp?: string;
  signature?: string;
  url?: string;
}): Request {
  const rawBody = options.rawBody ?? RAW_BODY;
  const timestamp = options.timestamp ?? String(Date.now());
  const url = options.url ?? WEBHOOK_URL;
  const signature =
    options.signature ??
    computeHubspotSignatureV3(
      "POST",
      buildHubspotSignatureRequestUri(url),
      rawBody,
      timestamp,
      CLIENT_SECRET
    );

  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hubspot-request-timestamp": timestamp,
      "x-hubspot-signature-v3": signature,
    },
    body: rawBody,
  });
}

describe("HubSpot webhook bearer auth", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, prev);
    process.env.FI_HUBSPOT_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  afterEach(() => {
    Object.assign(process.env, prev);
  });

  it("accepts matching bearer token", () => {
    assert.doesNotThrow(() => assertHubspotWebhookAuthorized(reqWithBearer(WEBHOOK_SECRET)));
  });

  it("rejects missing auth", () => {
    assert.throws(
      () => assertHubspotWebhookAuthorized(reqWithBearer(null)),
      (e: unknown) => e instanceof HubspotWebhookAuthError && e.status === 401
    );
  });

  it("rejects invalid bearer token", () => {
    assert.throws(
      () => assertHubspotWebhookAuthorized(reqWithBearer("wrong-secret")),
      (e: unknown) => e instanceof HubspotWebhookAuthError && e.status === 401
    );
  });
});

describe("HubSpot LeadFlow webhook dual auth", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, prev);
    process.env.FI_HUBSPOT_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.FI_HUBSPOT_CLIENT_SECRET = CLIENT_SECRET;
  });

  afterEach(() => {
    Object.assign(process.env, prev);
  });

  it("accepts matching bearer token", () => {
    assert.doesNotThrow(() =>
      assertHubspotLeadFlowWebhookAuthorized(reqWithBearer(WEBHOOK_SECRET), RAW_BODY)
    );
  });

  it("rejects missing auth", () => {
    assert.throws(
      () => assertHubspotLeadFlowWebhookAuthorized(reqWithBearer(null), RAW_BODY),
      (e: unknown) => e instanceof HubspotWebhookAuthError && e.status === 401
    );
  });

  it("rejects invalid bearer token", () => {
    assert.throws(
      () => assertHubspotLeadFlowWebhookAuthorized(reqWithBearer("wrong-secret"), RAW_BODY),
      (e: unknown) => e instanceof HubspotWebhookAuthError && e.status === 401
    );
  });

  it("accepts valid HubSpot v3 signature", () => {
    const req = reqWithHubspotSignature({});
    assert.doesNotThrow(() => assertHubspotLeadFlowWebhookAuthorized(req, RAW_BODY));
  });

  it("rejects stale timestamp", () => {
    const staleTimestamp = String(Date.now() - 6 * 60 * 1000);
    const req = reqWithHubspotSignature({ timestamp: staleTimestamp });
    assert.throws(
      () => assertHubspotLeadFlowWebhookAuthorized(req, RAW_BODY),
      (e: unknown) => e instanceof HubspotWebhookAuthError && e.status === 401
    );
  });

  it("rejects invalid signature", () => {
    const req = reqWithHubspotSignature({ signature: "invalid-signature" });
    assert.throws(
      () => assertHubspotLeadFlowWebhookAuthorized(req, RAW_BODY),
      (e: unknown) => e instanceof HubspotWebhookAuthError && e.status === 401
    );
  });

  it("prefers bearer auth when Authorization header is present", () => {
    const req = reqWithBearer(WEBHOOK_SECRET, {
      headers: {
        "x-hubspot-request-timestamp": String(Date.now()),
        "x-hubspot-signature-v3": "ignored-when-bearer-valid",
      },
    });
    assert.doesNotThrow(() => assertHubspotLeadFlowWebhookAuthorized(req, RAW_BODY));
  });
});
