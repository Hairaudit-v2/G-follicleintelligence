/**
 * Safe operational smoke checks against a deployed FI OS host.
 * Does not create leads, patients, bookings, reminders, uploads, or surgery data.
 *
 * Required: FI_BASE_URL, FI_SMOKE_TENANT_ID (UUID)
 * Optional secrets: FI_ADMIN_API_KEY, FI_TIMELY_WEBHOOK_SECRET, FI_REMINDER_CRON_SECRET, CRON_SECRET, FI_LEGACY_FI_API_SECRET
 *
 * Never prints secret values.
 */
import { randomUUID } from "node:crypto";

import { normalizeFiDeploymentBaseUrl } from "../src/lib/env/fiDeploymentBaseUrl";

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

  // A — HR health (no auth)
  {
    const { status } = await fetchStatus("/api/health/iiohr-hr-staff-sync");
    if (status !== 200) {
      fail("A health iiohr-hr-staff-sync", `expected 200, got ${status}`);
    }
    pass("A health iiohr-hr-staff-sync", "200");
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
