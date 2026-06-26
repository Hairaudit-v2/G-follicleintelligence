import { expect, type Page } from "@playwright/test";

import { e2eTenantId } from "../fixtures/baseUrl";

export type PatientFormData = {
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  dateOfBirth: string;
};

export class PatientCreatePage {
  constructor(private readonly page: Page) {}

  path(): string {
    return `/fi-admin/${e2eTenantId()}/patients/new`;
  }

  async goto(): Promise<void> {
    await this.page.goto(this.path(), { waitUntil: "domcontentloaded" });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /add new patient/i })).toBeVisible();
  }

  async fillForm(data: PatientFormData): Promise<void> {
    await this.page.getByLabel(/first name/i).fill(data.firstName);
    await this.page.getByLabel(/last name/i).fill(data.lastName);
    await this.page.getByLabel(/^mobile$/i).fill(data.mobile);
    await this.page.locator("#direct-patient-email").fill(data.email);
    await this.page.locator("#direct-patient-dob").fill(data.dateOfBirth);
  }

  async submit(): Promise<void> {
    await this.page.getByRole("button", { name: /create patient/i }).click();
  }

  async expectCreated(firstName: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`/fi-admin/${e2eTenantId()}/patients/`), {
      timeout: 30_000,
    });
    await expect(this.page.getByText(firstName).first()).toBeVisible({ timeout: 15_000 });
  }
}
