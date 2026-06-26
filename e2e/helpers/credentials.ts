/**
 * Env-gated demo credentials for authenticated e2e journeys.
 * Never commit real values — supply via CI secrets or local .env only.
 */
export function hasDemoCredentials(): boolean {
  return Boolean(
    process.env.FI_E2E_DEMO_ADMIN_EMAIL?.trim() &&
      process.env.FI_E2E_DEMO_ADMIN_PASSWORD?.trim() &&
      process.env.FI_E2E_TENANT_ID?.trim(),
  );
}

export function demoAdminEmail(): string {
  const email = process.env.FI_E2E_DEMO_ADMIN_EMAIL?.trim();
  if (!email) {
    throw new Error("Missing FI_E2E_DEMO_ADMIN_EMAIL");
  }
  return email;
}

export function demoAdminPassword(): string {
  const password = process.env.FI_E2E_DEMO_ADMIN_PASSWORD?.trim();
  if (!password) {
    throw new Error("Missing FI_E2E_DEMO_ADMIN_PASSWORD");
  }
  return password;
}

export function hasCrossTenantCredentials(): boolean {
  return hasDemoCredentials() && Boolean(process.env.FI_E2E_OTHER_TENANT_ID?.trim());
}

export function hasStaffPinCredentials(): boolean {
  return Boolean(
    process.env.FI_E2E_TENANT_ID?.trim() &&
      process.env.FI_E2E_STAFF_ID?.trim() &&
      process.env.FI_E2E_STAFF_PIN?.trim(),
  );
}

export function staffPinId(): string {
  const id = process.env.FI_E2E_STAFF_ID?.trim();
  if (!id) throw new Error("Missing FI_E2E_STAFF_ID");
  return id;
}

export function staffPin(): string {
  const pin = process.env.FI_E2E_STAFF_PIN?.trim();
  if (!pin) throw new Error("Missing FI_E2E_STAFF_PIN");
  return pin;
}

/** Mutation tests only run on throwaway demo tenants when explicitly opted in. */
export function allowsMutations(): boolean {
  return process.env.FI_E2E_ALLOW_MUTATIONS === "1" && hasDemoCredentials();
}
