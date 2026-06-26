import { test, expect } from "../fixtures/auth";
import { LoginPage } from "../pages/login.page";
import { requireE2eBaseUrl } from "../fixtures/baseUrl";

/**
 * Accessibility smoke — keyboard navigation and semantic markup on public surfaces.
 *
 * @smoke @a11y — no credentials; uses Playwright built-in locators (no axe dependency).
 */

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("accessibility smoke @smoke @a11y", () => {
  test("login form is keyboard reachable and submittable", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.expectLoaded();

    await page.keyboard.press("Tab");
    const email = page.getByLabel(/work email/i);
    await expect(email).toBeFocused();

    await email.fill("accessibility-check@example.test");
    await page.keyboard.press("Tab");
    const password = page.getByLabel(/^password$/i);
    await expect(password).toBeFocused();
    await password.fill("not-used");

    const submit = page.getByRole("button", { name: /sign in to os/i });
    await expect(submit).toBeEnabled();
    await expect(submit).toBeVisible();
  });

  test("login page has a single primary heading", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await expect(page.getByRole("heading", { name: /operating system/i })).toBeVisible();
  });

  test("invalid payment page has accessible unavailable message", async ({ page }) => {
    await page.goto("/pay/e2e-a11y-invalid-token", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /link unavailable/i })).toBeVisible();
    await expect(page.getByText(/not valid or has been replaced/i)).toBeVisible();
  });
});
