import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert";

import { GET, POST } from "../app/api/internal/leadflow/process-hubspot-events/route";

const CRON_SECRET = "0123456789abcdef0123456789abcdef";
const ROUTE_URL = "https://fi.example.com/api/internal/leadflow/process-hubspot-events";

const ENV_KEYS = ["CRON_SECRET", "FI_LEADFLOW_CRON_SECRET", "SUPABASE_SERVICE_ROLE_KEY"] as const;

let savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;

function saveEnv(): void {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
}

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function mockRequest(
  body: unknown = {},
  headers: Record<string, string> = {},
  method = "POST"
): Request {
  return new Request(ROUTE_URL, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

describe("LeadFlow process-hubspot-events endpoint", () => {
  beforeEach(() => {
    saveEnv();
    process.env.CRON_SECRET = CRON_SECRET;
    delete process.env.FI_LEADFLOW_CRON_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-should-not-auth";
  });

  afterEach(() => {
    restoreEnv();
  });

  it("rejects GET with 405", async () => {
    const res = await GET();
    assert.equal(res.status, 405);
  });

  it("rejects missing secret with 401", async () => {
    const res = await POST(mockRequest({}) as never);
    assert.equal(res.status, 401);
    const json = (await res.json()) as { ok: boolean };
    assert.equal(json.ok, false);
  });

  it("rejects invalid secret with 401", async () => {
    const res = await POST(
      mockRequest({}, { Authorization: "Bearer wrong-secret-value-0123456789" }) as never
    );
    assert.equal(res.status, 401);
  });

  it("returns 503 when no cron secrets configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(
      mockRequest({}, { Authorization: `Bearer ${CRON_SECRET}` }) as never
    );
    assert.equal(res.status, 503);
  });

  it("accepts FI_LEADFLOW_CRON_SECRET via alternate header", async () => {
    const leadflowSecret = "fedcba9876543210fedcba9876543210";
    process.env.FI_LEADFLOW_CRON_SECRET = leadflowSecret;
    delete process.env.CRON_SECRET;

    const res = await POST(
      mockRequest({}, { "x-fi-leadflow-secret": leadflowSecret }) as never
    );
    assert.notEqual(res.status, 401);
  });
});
