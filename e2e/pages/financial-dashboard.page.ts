import { expect, type Page } from "@playwright/test";

import { e2eTenantId } from "../fixtures/baseUrl";

export class FinancialDashboardPage {
  constructor(private readonly page: Page) {}

  dashboardPath(): string {
    return `/fi-admin/${e2eTenantId()}/financial/dashboard`;
  }

  async goto(): Promise<void> {
    await this.page.goto(this.dashboardPath(), { waitUntil: "domcontentloaded" });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`/fi-admin/${e2eTenantId()}/`));
    await expect(this.page.getByText(/payment metrics|financial/i).first()).toBeVisible({
      timeout: 20_000,
    });
  }
}
