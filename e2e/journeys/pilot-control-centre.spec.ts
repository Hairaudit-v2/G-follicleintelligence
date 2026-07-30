/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.5/1A.6 — E2E acceptance journeys (Playwright).
 * Fail-closed access + empty-cohort honesty. Live authenticated role matrix remains governance-gated.
 */
import { expect, test } from "@playwright/test";

const TENANT = process.env.FI_E2E_TENANT_ID?.trim() || "c2615b95-b707-4485-aa5f-be8f78ec868a";

test.describe("Pilot Control Centre 1A.5/1A.6 @smoke", () => {
  test("unauthenticated direct route access is denied", async ({ page }) => {
    const res = await page.goto(`/fi-admin/${TENANT}/pilot-control`, {
      waitUntil: "domcontentloaded",
    });
    // Portal gate redirects to login or returns not-found — never renders Control Centre chrome.
    const url = page.url();
    const body = await page.locator("body").innerText().catch(() => "");
    const denied =
      (res && res.status() >= 400) ||
      /sign in|log in|login|not found|404/i.test(`${url}\n${body}`) ||
      !/Pilot Control Centre/i.test(body);
    expect(denied).toBeTruthy();
  });

  test("unauthenticated API overview is rejected", async ({ request }) => {
    const res = await request.get(
      `/api/pilot-control/overview?programmeId=evolved-controlled-pilot`
    );
    expect(res.status()).toBeGreaterThanOrEqual(401);
    const json = await res.json().catch(() => null);
    if (json?.error?.code) {
      expect(String(json.error.code)).toMatch(/UNAUTHENTICATED|FORBIDDEN/i);
    }
  });

  test("unauthenticated API adoption is rejected", async ({ request }) => {
    const res = await request.get(
      `/api/pilot-control/adoption?programmeId=evolved-controlled-pilot`
    );
    expect(res.status()).toBeGreaterThanOrEqual(401);
    const json = await res.json().catch(() => null);
    if (json?.error?.code) {
      expect(String(json.error.code)).toMatch(/UNAUTHENTICATED|FORBIDDEN/i);
    }
  });

  test("admin alias path redirects away from unauthenticated control centre", async ({ page }) => {
    await page.goto("/admin/pilot-control", { waitUntil: "domcontentloaded" });
    const url = page.url();
    expect(url.includes("/admin/pilot-control") && !url.includes("fi-admin")).toBeFalsy();
  });
});
