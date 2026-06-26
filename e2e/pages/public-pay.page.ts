import { expect, type Page } from "@playwright/test";

/** Public patient payment surface at /pay/[token]. */
export class PublicPayPage {
  constructor(private readonly page: Page) {}

  async goto(token: string): Promise<void> {
    await this.page.goto(`/pay/${token}`, { waitUntil: "domcontentloaded" });
  }

  async expectUnavailableLink(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /link unavailable/i })).toBeVisible();
    await expect(
      this.page.getByText(/not valid or has been replaced/i),
    ).toBeVisible();
  }
}
