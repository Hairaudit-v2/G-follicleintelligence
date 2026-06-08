import assert from "node:assert/strict";
import { test } from "node:test";

import { executeFiStaffSyncPost, scrubSecretFromMessage } from "@/src/lib/hr/iiohrFiStaffSyncClient";
import { pushStaffSyncToFi } from "@/src/lib/hr/iiohrFiStaffSyncPush";

test("scrubSecretFromMessage redacts the shared secret substring", () => {
  const secret = "super-secret-token-xyz";
  assert.equal(scrubSecretFromMessage(`auth failed: ${secret}`, secret), "auth failed: [redacted]");
});

test("executeFiStaffSyncPost: preview body has mode and rows but no confirm", async () => {
  let seenBody = "";
  const fetchImpl: typeof fetch = async (_url, init) => {
    seenBody = typeof init?.body === "string" ? init.body : "";
    return new Response(JSON.stringify({ ok: true, runId: "r1", summary: {} }), { status: 200 });
  };
  const res = await executeFiStaffSyncPost({
    url: "https://fi.example/api",
    secret: "s",
    body: { mode: "preview", rows: [{ external_staff_id: "1", full_name: "A" }] },
    fetchImpl,
  });
  assert.equal(res.httpStatus, 200);
  const parsed = JSON.parse(seenBody) as Record<string, unknown>;
  assert.equal(parsed.mode, "preview");
  assert.ok(Array.isArray(parsed.rows));
  assert.ok(!("confirm" in parsed));
});

test("executeFiStaffSyncPost: commit body includes confirm true", async () => {
  let seenBody = "";
  const fetchImpl: typeof fetch = async (_url, init) => {
    seenBody = typeof init?.body === "string" ? init.body : "";
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  await executeFiStaffSyncPost({
    url: "https://fi.example/api",
    secret: "s",
    body: { mode: "commit", confirm: true, rows: [{ external_staff_id: "1", full_name: "A" }] },
    fetchImpl,
  });
  const parsed = JSON.parse(seenBody) as Record<string, unknown>;
  assert.equal(parsed.mode, "commit");
  assert.equal(parsed.confirm, true);
});

test("pushStaffSyncToFi: missing FI_BASE_URL fails clearly", async () => {
  const prevBase = process.env.FI_BASE_URL;
  const prevSecret = process.env.IIOHR_HR_SYNC_SECRET;
  delete process.env.FI_BASE_URL;
  process.env.IIOHR_HR_SYNC_SECRET = "configured";
  try {
    await assert.rejects(
      () =>
        pushStaffSyncToFi({
          tenantId: "00000000-0000-4000-8000-000000000001",
          rows: [{ external_staff_id: "1", full_name: "A" }],
          mode: "preview",
        }),
      (e: unknown) => e instanceof Error && /FI_BASE_URL/.test(e.message)
    );
  } finally {
    if (prevBase === undefined) delete process.env.FI_BASE_URL;
    else process.env.FI_BASE_URL = prevBase;
    if (prevSecret === undefined) delete process.env.IIOHR_HR_SYNC_SECRET;
    else process.env.IIOHR_HR_SYNC_SECRET = prevSecret;
  }
});

test("pushStaffSyncToFi: missing IIOHR_HR_SYNC_SECRET fails clearly", async () => {
  const prevBase = process.env.FI_BASE_URL;
  const prevSecret = process.env.IIOHR_HR_SYNC_SECRET;
  process.env.FI_BASE_URL = "https://fi.example";
  delete process.env.IIOHR_HR_SYNC_SECRET;
  try {
    await assert.rejects(
      () =>
        pushStaffSyncToFi({
          tenantId: "00000000-0000-4000-8000-000000000001",
          rows: [{ external_staff_id: "1", full_name: "A" }],
          mode: "preview",
        }),
      (e: unknown) => e instanceof Error && /IIOHR_HR_SYNC_SECRET/.test(e.message)
    );
  } finally {
    if (prevBase === undefined) delete process.env.FI_BASE_URL;
    else process.env.FI_BASE_URL = prevBase;
    if (prevSecret === undefined) delete process.env.IIOHR_HR_SYNC_SECRET;
    else process.env.IIOHR_HR_SYNC_SECRET = prevSecret;
  }
});

test("pushStaffSyncToFi: commit requires confirm true", async () => {
  const prevBase = process.env.FI_BASE_URL;
  const prevSecret = process.env.IIOHR_HR_SYNC_SECRET;
  process.env.FI_BASE_URL = "https://fi.example";
  process.env.IIOHR_HR_SYNC_SECRET = "secret-for-commit-gate";
  try {
    await assert.rejects(
      () =>
        pushStaffSyncToFi({
          tenantId: "00000000-0000-4000-8000-000000000001",
          rows: [{ external_staff_id: "1", full_name: "A" }],
          mode: "commit",
        }),
      (e: unknown) => e instanceof Error && /confirm: true/.test(e.message)
    );
  } finally {
    if (prevBase === undefined) delete process.env.FI_BASE_URL;
    else process.env.FI_BASE_URL = prevBase;
    if (prevSecret === undefined) delete process.env.IIOHR_HR_SYNC_SECRET;
    else process.env.IIOHR_HR_SYNC_SECRET = prevSecret;
  }
});

test("pushStaffSyncToFi: preview succeeds without confirm and never puts secret in result", async () => {
  const prevBase = process.env.FI_BASE_URL;
  const prevSecret = process.env.IIOHR_HR_SYNC_SECRET;
  const secret = "never-echo-this-value-12345";
  process.env.FI_BASE_URL = "https://fi.example";
  process.env.IIOHR_HR_SYNC_SECRET = secret;
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ ok: true, runId: "run-xyz", summary: { warnings: [] } }), {
      status: 200,
    })) as typeof fetch;
  try {
    const result = await pushStaffSyncToFi({
      tenantId: "00000000-0000-4000-8000-000000000001",
      rows: [{ external_staff_id: "1", full_name: "A" }],
      mode: "preview",
    });
    assert.equal(result.httpStatus, 200);
    const rawStr = JSON.stringify(result.raw);
    assert.ok(!rawStr.includes(secret), "FI JSON must not echo the sync secret");
  } finally {
    globalThis.fetch = origFetch;
    if (prevBase === undefined) delete process.env.FI_BASE_URL;
    else process.env.FI_BASE_URL = prevBase;
    if (prevSecret === undefined) delete process.env.IIOHR_HR_SYNC_SECRET;
    else process.env.IIOHR_HR_SYNC_SECRET = prevSecret;
  }
});

test("pushStaffSyncToFi: non-2xx error message is scrubbed of secret", async () => {
  const prevBase = process.env.FI_BASE_URL;
  const prevSecret = process.env.IIOHR_HR_SYNC_SECRET;
  const secret = "scrub-me-from-error-body";
  process.env.FI_BASE_URL = "https://fi.example";
  process.env.IIOHR_HR_SYNC_SECRET = secret;
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ ok: false, error: `denied ${secret}` }), { status: 401 })) as typeof fetch;
  try {
    await assert.rejects(
      () =>
        pushStaffSyncToFi({
          tenantId: "00000000-0000-4000-8000-000000000001",
          rows: [{ external_staff_id: "1", full_name: "A" }],
          mode: "preview",
        }),
      (e: unknown) => {
        if (!(e instanceof Error)) return false;
        assert.ok(!e.message.includes(secret), "thrown message must not contain the secret");
        assert.ok(e.message.includes("[redacted]"));
        return true;
      }
    );
  } finally {
    globalThis.fetch = origFetch;
    if (prevBase === undefined) delete process.env.FI_BASE_URL;
    else process.env.FI_BASE_URL = prevBase;
    if (prevSecret === undefined) delete process.env.IIOHR_HR_SYNC_SECRET;
    else process.env.IIOHR_HR_SYNC_SECRET = prevSecret;
  }
});
