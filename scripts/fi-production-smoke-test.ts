/**
 * Safe operational smoke checks against a deployed FI OS host.
 * Does not create leads, patients, bookings, reminders, uploads, or surgery data.
 *
 * Required: FI_BASE_URL, FI_SMOKE_TENANT_ID (UUID)
 * Optional secrets: FI_ADMIN_API_KEY, FI_TIMELY_WEBHOOK_SECRET, FI_REMINDER_CRON_SECRET, CRON_SECRET, FI_LEGACY_FI_API_SECRET
 * Optional: FI_SMOKE_OTHER_TENANT_ID (a second tenant UUID, used only to confirm
 *   unauthenticated cross-tenant API access is denied — never reads tenant data)
 *
 * Never prints secret values.
 */
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { normalizeFiDeploymentBaseUrl } from "../src/lib/env/fiDeploymentBaseUrl";

function loadRepoEnvFiles(): void {
  for (const name of [".env.local", ".env"] as const) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    let raw = readFileSync(p, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
      const eq = withoutExport.indexOf("=");
      if (eq <= 0) continue;
      const key = withoutExport.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      let val = withoutExport.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

loadRepoEnvFiles();

function baseUrl(): string {
  const raw = process.env.FI_BASE_URL?.trim();
  if (!raw) {
    console.error("Missing FI_BASE_URL (e.g. https://your-app.vercel.app — site root, not /fi-admin)");
    process.exit(1);
  }
  return normalizeFiDeploymentBaseUrl(raw);
}

function tenantId(): string {
  const t = process.env.FI_SMOKE_TENANT_ID?.trim();
  if (!t) {
    console.error("Missing FI_SMOKE_TENANT_ID (tenant UUID on target host)");
    process.exit(1);
  }
  return t;
}

function skip(check: string, reason: string): void {
  console.log(`SKIPPED [${check}]: ${reason}`);
}

function pass(check: string, detail?: string): void {
  console.log(`PASS [${check}]${detail ? `: ${detail}` : ""}`);
}

function fail(check: string, detail: string): never {
  console.error(`FAIL [${check}]: ${detail}`);
  process.exit(1);
}

async function fetchStatus(
  path: string,
  init?: RequestInit
): Promise<{ status: number; contentType: string; text: string }> {
  const url = `${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { ...init, redirect: "manual" });
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  return { status: res.status, contentType, text };
}

function assertNotSuccessWithSecret(check: string, status: number): void {
  if (status === 200) {
    fail(check, "unexpected 200 for unauthenticated or wrong-secret request");
  }
  if (status !== 401 && status !== 403 && status !== 404 && status !== 503 && status !== 405) {
    fail(check, `unexpected status ${status} (expected 401, 403, 404, 503, or 405)`);
  }
  pass(check, `status ${status}`);
}

async function main(): Promise<void> {
  const tid = tenantId();
  const b = baseUrl();
  console.log(`FI OS production smoke test → ${b} (tenant ${tid})`);
  console.log("---");

  // A — HR health (production requires cron Bearer)
  {
    const unauth = await fetchStatus("/api/health/iiohr-hr-staff-sync");
    if (unauth.status === 200) {
      fail("A health iiohr-hr-staff-sync unauthenticated", "unexpected 200 without cron secret");
    }
    if (unauth.status !== 401 && unauth.status !== 503) {
      fail("A health iiohr-hr-staff-sync unauthenticated", `expected 401 or 503, got ${unauth.status}`);
    }
    pass("A health iiohr-hr-staff-sync unauthenticated", `status ${unauth.status}`);

    const cronSecret = process.env.CRON_SECRET?.trim() || process.env.FI_HR_SYNC_CRON_SECRET?.trim();
    if (cronSecret) {
      const authed = await fetchStatus("/api/health/iiohr-hr-staff-sync", {
        headers: { authorization: `Bearer ${cronSecret}` },
      });
      if (authed.status !== 200) {
        fail("A health iiohr-hr-staff-sync authenticated", `expected 200, got ${authed.status}`);
      }
      pass("A health iiohr-hr-staff-sync authenticated", "200");
    } else {
      skip("A health iiohr-hr-staff-sync authenticated", "CRON_SECRET or FI_HR_SYNC_CRON_SECRET not set locally");
    }
  }

  // B — Legacy FI events without auth
  {
    const { status } = await fetchStatus("/api/fi/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (status === 200) {
      fail("B legacy /api/fi/events no auth", "unexpected 200");
    }
    if (status !== 404 && status !== 401) {
      fail("B legacy /api/fi/events no auth", `expected 404 or 401, got ${status}`);
    }
    pass("B legacy /api/fi/events no auth", `status ${status}`);
  }

  // C — Legacy wrong Bearer (only if we can send a non-empty wrong token without revealing env)
  {
    const { status } = await fetchStatus("/api/fi/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer definitely-not-the-real-secret-xxxxxxxx",
      },
      body: JSON.stringify({}),
    });
    if (status === 200) {
      fail("C legacy /api/fi/events wrong bearer", "unexpected 200");
    }
    if (status !== 404 && status !== 401) {
      fail("C legacy /api/fi/events wrong bearer", `expected 404 or 401, got ${status}`);
    }
    pass("C legacy /api/fi/events wrong bearer", `status ${status}`);
  }

  // D — Global search without session
  {
    const q = encodeURIComponent("smoke");
    const { status } = await fetchStatus(`/api/tenants/${tid}/clinic-os/global-search?q=${q}`);
    if (status === 200) {
      fail("D global search without session", "unexpected 200 (should require session in production)");
    }
    if (status !== 401 && status !== 403) {
      fail("D global search without session", `expected 401 or 403 in production-like deploy, got ${status}`);
    }
    pass("D global search without session", `status ${status}`);
  }

  // E — Reminder cron wrong secret
  {
    const { status } = await fetchStatus("/api/cron/fi-reminder-jobs", {
      method: "POST",
      headers: { authorization: "Bearer wrong-reminder-cron-secret-zzzzzz" },
    });
    assertNotSuccessWithSecret("E reminder cron wrong secret", status);
  }

  // F — Timely discovery wrong secret
  {
    const { status } = await fetchStatus(`/api/tenants/${tid}/integrations/timely/discovery`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer wrong-timely-webhook-secret-zzzzzzzz",
      },
      body: JSON.stringify({ probe: randomUUID() }),
    });
    assertNotSuccessWithSecret("F Timely discovery wrong secret", status);
  }

  // H — /fi-admin/system without a session must not render the platform admin shell
  {
    const { status } = await fetchStatus("/fi-admin/system");
    if (status === 200) {
      fail("H fi-admin/system without session", "unexpected 200 (should redirect/401/403 unauthenticated)");
    }
    if (![302, 303, 307, 401, 403].includes(status)) {
      fail("H fi-admin/system without session", `expected redirect or 401/403, got ${status}`);
    }
    pass("H fi-admin/system without session", `status ${status}`);
  }

  // I — Tenant clinic dashboard without a session must not render
  {
    const { status } = await fetchStatus(`/fi-admin/${tid}/financial/dashboard`);
    if (status === 200) {
      fail("I tenant dashboard without session", "unexpected 200 (should redirect/401/403 unauthenticated)");
    }
    if (![302, 303, 307, 401, 403].includes(status)) {
      fail("I tenant dashboard without session", `expected redirect or 401/403, got ${status}`);
    }
    pass("I tenant dashboard without session", `status ${status}`);
  }

  // J — Cross-tenant case API access must be denied (no session => 401/403, never tenant data)
  if (process.env.FI_SMOKE_OTHER_TENANT_ID?.trim()) {
    const otherTid = process.env.FI_SMOKE_OTHER_TENANT_ID.trim();
    const { status } = await fetchStatus(`/api/tenants/${otherTid}/cases`);
    if (status === 200) {
      fail("J cross-tenant cases list without session", "unexpected 200");
    }
    if (![401, 403].includes(status)) {
      fail("J cross-tenant cases list without session", `expected 401 or 403, got ${status}`);
    }
    pass("J cross-tenant cases list without session", `status ${status}`);
  } else {
    skip("J cross-tenant cases list", "FI_SMOKE_OTHER_TENANT_ID not set — set to a second tenant UUID to exercise RLS denial at the API layer");
  }

  // K — Staff PIN login rejects invalid PIN (does not create a session, no real PIN used)
  {
    const { status, text } = await fetchStatus("/api/fi-staff-pin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: tid, staffId: randomUUID(), pin: "000000" }),
    });
    if (status === 200 && /"ok"\s*:\s*true/.test(text)) {
      fail("K staff PIN login with bogus staff/PIN", "unexpected ok:true for a random staffId/PIN");
    }
    pass("K staff PIN login with bogus staff/PIN", `status ${status}`);
  }

  // G — Optional positive checks (never mutate production data)
  if (process.env.FI_TIMELY_WEBHOOK_SECRET?.trim() && process.env.FI_TIMELY_WEBHOOK_SECRET.length >= 16) {
    skip("G Timely positive path", "skipped — discovery POST always persists payload; no dry read endpoint wired");
  } else {
    skip("G Timely positive path", "FI_TIMELY_WEBHOOK_SECRET not set or too short in runner env");
  }

  console.log("---");
  console.log("FI OS smoke test completed (no mutations performed).");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Smoke test failed.");
  process.exit(1);
});
