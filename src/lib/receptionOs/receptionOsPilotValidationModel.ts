/**
 * ReceptionOS Phase 6 — pilot data validation model (pure).
 */

export type ReceptionOsPilotValidationSeverity = "pass" | "warn" | "fail";

export type ReceptionOsPilotValidationCheck = {
  id: string;
  label: string;
  severity: ReceptionOsPilotValidationSeverity;
  detail: string;
};

export type ReceptionOsPilotValidationReport = {
  tenantId: string;
  validatedAt: string;
  operatingDate: string | null;
  summary: { pass: number; warn: number; fail: number };
  readyForPilot: boolean;
  checks: ReceptionOsPilotValidationCheck[];
};

export function appendPilotValidationCheck(
  checks: ReceptionOsPilotValidationCheck[],
  check: ReceptionOsPilotValidationCheck,
): void {
  checks.push(check);
}

export function finalizePilotValidationReport(input: {
  tenantId: string;
  validatedAt: string;
  operatingDate: string | null;
  checks: ReceptionOsPilotValidationCheck[];
}): ReceptionOsPilotValidationReport {
  const summary = { pass: 0, warn: 0, fail: 0 };
  for (const c of input.checks) summary[c.severity] += 1;
  return {
    tenantId: input.tenantId,
    validatedAt: input.validatedAt,
    operatingDate: input.operatingDate,
    summary,
    readyForPilot: summary.fail === 0,
    checks: input.checks,
  };
}
