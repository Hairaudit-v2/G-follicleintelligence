import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildOutboundHliHeaders,
  HDR_SIGNATURE,
  HDR_TENANT,
  verifyHliTrichoscopySignature,
} from "@/src/lib/integrations/hliTrichoscopy/eventVerifier";
import { processHliTrichoscopyEvent } from "@/src/lib/integrations/hliTrichoscopy/events";

function headersFromRecord(rec: Record<string, string>): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(rec)) h.set(k, v);
  return h;
}

describe("processHliTrichoscopyEvent auth gates", () => {
  it("rejects when platform flag is off", async () => {
    const result = await processHliTrichoscopyEvent({
      headers: new Headers(),
      rawBody: "{}",
      env: { FI_ENABLE_HLI_TRICHOSCOPY: "0" },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "platform_disabled");
  });

  it("rejects missing signing headers", async () => {
    const result = await processHliTrichoscopyEvent({
      headers: new Headers(),
      rawBody: "{}",
      env: { FI_ENABLE_HLI_TRICHOSCOPY: "1" },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.httpStatus, 401);
  });

  it("rejects invalid signatures when secret configured", async () => {
    const secret = "test-hli-trichoscopy-webhook-secret-32!";
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const body = JSON.stringify({
      eventId: "evt-1",
      eventType: "trichoscopy.session_created",
      eventVersion: "1",
      occurredAt: new Date().toISOString(),
      tenantReference: tenantId,
      patientReference: "hli-pt-1",
      idempotencyKey: "idem-1",
    });
    const signed = buildOutboundHliHeaders({ tenantId, secret, body });
    signed[HDR_SIGNATURE] = "00".repeat(32);

    const result = await processHliTrichoscopyEvent({
      headers: headersFromRecord(signed),
      rawBody: body,
      env: {
        FI_ENABLE_HLI_TRICHOSCOPY: "1",
        HLI_TRICHOSCOPY_WEBHOOK_SECRET: secret,
        HLI_TRICHOSCOPY_SIGNING_SECRET: secret,
        HLI_TRICHOSCOPY_API_BASE_URL: "https://hli.example",
        HLI_TRICHOSCOPY_SERVICE_KEY: "svc",
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "signature_invalid");
  });

  it("builds signatures that verify", () => {
    const secret = "test-hli-trichoscopy-webhook-secret-32!";
    const tenantId = "tenant-a";
    const body = '{"ok":true}';
    const headers = buildOutboundHliHeaders({ tenantId, secret, body });
    assert.equal(Boolean(headers[HDR_TENANT]), true);
    assert.equal(
      verifyHliTrichoscopySignature({
        secret,
        timestamp: headers["x-fi-timestamp"],
        requestId: headers["x-fi-request-id"],
        tenantId,
        body,
        signature: headers[HDR_SIGNATURE],
      }),
      true
    );
  });
});
