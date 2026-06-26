import { expect, type Page } from "@playwright/test";

/**
 * Follicle Intelligence OS login surface — selectors anchored to stable
 * element ids/roles from FiOsLoginScreen (not layout classes).
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(nextPath?: string): Promise<void> {
    const query = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    await this.page.goto(`/follicle-intelligence/login${query}`, {
      waitUntil: "domcontentloaded",
    });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /operating system/i })).toBeVisible();
    await expect(this.page.getByLabel(/work email/i)).toBeVisible();
    await expect(this.page.getByRole("button", { name: /sign in to os/i })).toBeVisible();
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.page.getByLabel(/work email/i).fill(email);
    await this.page.getByLabel(/^password$/i).fill(password);
    await this.page.getByRole("button", { name: /sign in to os/i }).click();
  }
}
