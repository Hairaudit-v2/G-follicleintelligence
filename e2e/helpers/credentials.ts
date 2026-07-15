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

/**
 * Production HubSpot smoke credentials (read-only suite only).
 * Prefer dedicated production secrets; never commit values or storage-state files.
 */
export function hasProductionAdminCredentials(): boolean {
  return Boolean(
    process.env.FI_E2E_PRODUCTION_ADMIN_EMAIL?.trim() &&
      process.env.FI_E2E_PRODUCTION_ADMIN_PASSWORD?.trim() &&
      process.env.FI_E2E_TENANT_ID?.trim() &&
      process.env.FI_E2E_BASE_URL?.trim(),
  );
}

export function productionAdminEmail(): string {
  const email = process.env.FI_E2E_PRODUCTION_ADMIN_EMAIL?.trim();
  if (!email) throw new Error("Missing FI_E2E_PRODUCTION_ADMIN_EMAIL");
  return email;
}

export function productionAdminPassword(): string {
  const password = process.env.FI_E2E_PRODUCTION_ADMIN_PASSWORD?.trim();
  if (!password) throw new Error("Missing FI_E2E_PRODUCTION_ADMIN_PASSWORD");
  return password;
}

/** Optional low-role user for gated HubSpot smoke (AMBER skip when unset). */
export function hasLowRoleCredentials(): boolean {
  return Boolean(
    process.env.FI_E2E_LOW_ROLE_EMAIL?.trim() &&
      process.env.FI_E2E_LOW_ROLE_PASSWORD?.trim() &&
      process.env.FI_E2E_TENANT_ID?.trim(),
  );
}

export function lowRoleEmail(): string {
  const email = process.env.FI_E2E_LOW_ROLE_EMAIL?.trim();
  if (!email) throw new Error("Missing FI_E2E_LOW_ROLE_EMAIL");
  return email;
}

export function lowRolePassword(): string {
  const password = process.env.FI_E2E_LOW_ROLE_PASSWORD?.trim();
  if (!password) throw new Error("Missing FI_E2E_LOW_ROLE_PASSWORD");
  return password;
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

/** Paul (owner) has linked auth + portal access; manager@ is tenant_backend without admin row. */
const DEFAULT_ROSTER_MANAGER_EMAIL = "paul@evolvedhair.com.au";
const DEFAULT_ROSTER_VIEW_ONLY_EMAIL = "danicamiloseski24@gmail.com";

export function hasRosterManagerCredentials(): boolean {
  return Boolean(
    process.env.FI_E2E_TENANT_ID?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
      rosterManagerEmail(),
  );
}

export function rosterManagerEmail(): string {
  const email =
    process.env.FI_E2E_ROSTER_MANAGER_EMAIL?.trim() ||
    process.env.FI_E2E_ROSTER_MANAGER_EMAILS?.split(",")[0]?.trim() ||
    DEFAULT_ROSTER_MANAGER_EMAIL;
  if (!email) throw new Error("Missing FI_E2E_ROSTER_MANAGER_EMAIL");
  return email;
}

export function hasRosterViewOnlyCredentials(): boolean {
  return Boolean(
    process.env.FI_E2E_TENANT_ID?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
      rosterViewOnlyEmail(),
  );
}

export function rosterViewOnlyEmail(): string {
  const email = process.env.FI_E2E_ROSTER_VIEW_ONLY_EMAIL?.trim() || DEFAULT_ROSTER_VIEW_ONLY_EMAIL;
  if (!email) throw new Error("Missing FI_E2E_ROSTER_VIEW_ONLY_EMAIL");
  return email;
}

/** Roster shift mutations on Evolved tenant (manager login path). */
export function allowsRosterMutations(): boolean {
  return process.env.FI_E2E_ALLOW_MUTATIONS === "1" && hasRosterManagerCredentials();
}
