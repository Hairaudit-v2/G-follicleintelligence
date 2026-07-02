/**
 * FI-UX-REBUILD D6 — Today live signals + QR arrival intent.
 *
 * Lightweight checks run without opt-in (revision API auth, invalid token).
 * Full arrival → Today flow requires:
 *   FI_E2E_D6_ARRIVAL=true
 *   FI_E2E_TODAY_SURFACE_ENABLED=true
 *   FI_E2E_TENANT_ID / FI_E2E_BOOKING_ID (today's confirmed booking)
 *   Server: FI_ARRIVAL_TOKEN_SECRET (or FI_EXTERNAL_CONNECTOR_MASTER_KEY)
 *           FI_TODAY_SURFACE_TENANT_IDS includes FI_E2E_TENANT_ID
 *
 *   npx playwright test e2e/fi-ux-d6-realtime-signals.spec.ts --project=chromium-authenticated
 */
import { expect, test } from "@playwright/test";

import {
  BOOKING_ARRIVAL_TOKEN_TTL_MS,
  signBookingArrivalToken,
} from "../src/lib/fiOs/todaySignal/bookingArrivalIntentCore";

import { authenticatedTest, hasDemoCredentials } from "./fixtures/auth";
import { e2eTenantId, requireE2eBaseUrl } from "./fixtures/baseUrl";

const baseTest = hasDemoCredentials() ? authenticatedTest : test;

function TENANT(): string {
  return e2eTenantId();
}

function BASE(): string {
  return `/fi-admin/${TENANT()}`;
}

function d6ArrivalOptedIn(): boolean {
  return process.env.FI_E2E_D6_ARRIVAL?.trim().toLowerCase() === "true";
}

function todaySurfaceOptedIn(): boolean {
  return process.env.FI_E2E_TODAY_SURFACE_ENABLED?.trim().toLowerCase() === "true";
}

function arrivalSecret(): string | null {
  return (
    process.env.FI_ARRIVAL_TOKEN_SECRET?.trim() ||
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY?.trim() ||
    null
  );
}

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("FI-UX-REBUILD D6 Today signal revision @smoke", () => {
  test("revision API rejects unauthenticated access", async ({ request }) => {
    const res = await request.get(`/api/tenants/${TENANT()}/today-signal/revision`);
    expect(res.status()).toBeGreaterThanOrEqual(401);
    expect(res.status()).toBeLessThanOrEqual(403);
  });

  test("public booking-arrival rejects invalid token", async ({ request }) => {
    const res = await request.post("/api/public/booking-arrival", {
      data: { token: "not-a-valid-token" },
    });
    expect(res.status()).toBe(400);
    const json = (await res.json()) as { ok?: boolean };
    expect(json.ok).not.toBe(true);
  });
});

baseTest.describe("FI-UX-REBUILD D6 authenticated revision poll @authenticated", () => {
  baseTest.beforeEach(() => {
    baseTest.skip(!hasDemoCredentials(), "Demo admin credentials required");
  });

  baseTest("revision endpoint returns non-PHI fingerprint", async ({ request }) => {
    const res = await request.get(`/api/tenants/${TENANT()}/today-signal/revision`);
    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as { revision?: string };
    expect(json.revision).toMatch(/^[0-9a-f]{8}$/);
  });
});

baseTest.describe("FI-UX-REBUILD D6 QR arrival → Today @authenticated @smoke", () => {
  baseTest.beforeEach(() => {
    baseTest.skip(!d6ArrivalOptedIn(), "Set FI_E2E_D6_ARRIVAL=true to run arrival flow");
    baseTest.skip(!todaySurfaceOptedIn(), "Set FI_E2E_TODAY_SURFACE_ENABLED=true");
    baseTest.skip(!hasDemoCredentials(), "Demo admin credentials required");
    baseTest.skip(!arrivalSecret(), "FI_ARRIVAL_TOKEN_SECRET required on server and in e2e env");
  });

  baseTest("QR link records arrival intent and Today shows says they're here", async ({
    page,
    request,
  }) => {
    const bookingId = process.env.FI_E2E_BOOKING_ID?.trim();
    baseTest.skip(!bookingId, "FI_E2E_BOOKING_ID required (today's confirmed booking)");

    const secret = arrivalSecret()!;
    const token = signBookingArrivalToken(
      {
        tenantId: TENANT(),
        bookingId,
        exp: Date.now() + BOOKING_ARRIVAL_TOKEN_TTL_MS,
      },
      secret
    );

    const arrivalRes = await request.post("/api/public/booking-arrival", {
      data: { token },
    });
    expect(arrivalRes.ok()).toBeTruthy();

    await page.goto(BASE(), { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Needs you now" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/says they're here/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Awaiting reception confirmation/i).first()).toBeVisible();
  });
});
