import { expect, type Page } from "@playwright/test";

export class MarketingPage {
  constructor(private readonly page: Page) {}

  async gotoHome(): Promise<void> {
    await this.page.goto("/", { waitUntil: "domcontentloaded" });
  }

  async expectHomeLoaded(): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 1 }).first()).toContainText(
      /hair restoration/i,
    );
  }

  async gotoPricing(): Promise<void> {
    await this.page.goto("/pricing", { waitUntil: "domcontentloaded" });
  }

  async expectPricingLoaded(): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    expect(this.page.url()).toMatch(/\/pricing/);
  }

  async gotoPlatformOverview(): Promise<void> {
    await this.page.goto("/platform", { waitUntil: "domcontentloaded" });
  }

  async expectPlatformLoaded(): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  }
}
