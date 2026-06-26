/**
 * E2E test data conventions — aligned with docs/smoke/fi-os-clinic-readiness-runbook.md.
 * All mutation tests must use these prefixes so records are identifiable and safe to soft-delete.
 */
const PREFIX = "SMOKETEST-";

export function e2eRunId(): string {
  return `${Date.now().toString(36)}`;
}

export function smokeTestFirstName(suffix?: string): string {
  return `${PREFIX}Patient-${suffix ?? e2eRunId()}`;
}

export function smokeTestLastName(): string {
  return "E2E";
}

export function smokeTestEmail(): string {
  return `tester+e2e-${e2eRunId()}@example.test`;
}

export function smokeTestMobile(): string {
  return "0000000000";
}

export function smokeTestDateOfBirth(): string {
  return "1990-01-15";
}

export function smokeTestLeadName(suffix?: string): string {
  return `${PREFIX}Lead-${suffix ?? e2eRunId()}`;
}
