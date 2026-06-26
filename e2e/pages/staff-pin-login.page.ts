import { expect, type Page } from "@playwright/test";

import { e2eTenantId } from "../fixtures/baseUrl";

export class StaffPinLoginPage {
  constructor(private readonly page: Page) {}

  path(): string {
    return `/fi-admin/${e2eTenantId()}/staff-pin-login`;
  }

  async goto(): Promise<void> {
    await this.page.goto(this.path(), { waitUntil: "domcontentloaded" });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /staff pin sign-in/i })).toBeVisible();
  }

  async signIn(staffId: string, pin: string): Promise<void> {
    await this.page.getByLabel(/staff member/i).selectOption(staffId);
    await this.page.getByLabel(/4-digit pin/i).fill(pin);
    await this.page.getByRole("button", { name: /enter clinicos/i }).click();
  }

  async expectInvalidCredentialsError(): Promise<void> {
    await expect(this.page.getByRole("alert")).toContainText(/invalid|try again/i);
  }
}
