/**
 * TITAN Phase 1I — Global Command Centre demo-readiness validation (pure).
 */

import {
  ENTERPRISE_DEMO_CLINICS,
  ENTERPRISE_DEMO_TENANT_SLUG,
} from "./enterpriseDemoConstants";
import { ENTERPRISE_DEMO_CONSULTATION_QUOTE_INVOICES } from "./enterpriseDemoFinancialGenerator";
import { ENTERPRISE_DEMO_TOTAL_SURGERIES } from "./enterpriseDemoSurgeriesGenerator";
import type { GlobalCommandCentrePayload } from "./enterpriseDemoGlobalCommandCentreLoader.server";

export type GlobalCommandCentreValidationSeverity = "pass" | "warn" | "fail";

export type GlobalCommandCentreValidationCheck = {
  id: string;
  label: string;
  severity: GlobalCommandCentreValidationSeverity;
  detail: string;
};

export type GlobalCommandCentreValidationReport = {
  tenantId: string;
  tenantSlug: string;
  validatedAt: string;
  summary: { pass: number; warn: number; fail: number };
  readyForDemo: boolean;
  checks: GlobalCommandCentreValidationCheck[];
};

export const TITAN_DEMO_CLINIC_COUNT = ENTERPRISE_DEMO_CLINICS.length;

export const TITAN_DEMO_EXPECTED_SURGERIES = ENTERPRISE_DEMO_TOTAL_SURGERIES;

export const TITAN_DEMO_EXPECTED_CONSULTATION_QUOTES = ENTERPRISE_DEMO_CONSULTATION_QUOTE_INVOICES;

/** Metadata-only synthetic imaging paths — no real storage objects required. */
export const TITAN_DEMO_SYNTHETIC_IMAGE_PATH_PREFIX = "titan-demo/synthetic/";

export const TITAN_GLOBAL_COMMAND_CENTRE_ROUTES = {
  friendlyDashboard: `/fi-admin/${ENTERPRISE_DEMO_TENANT_SLUG}/global-command-centre`,
  friendlyPresentation: `/fi-admin/${ENTERPRISE_DEMO_TENANT_SLUG}/global-command-centre/presentation`,
} as const;

export function buildTenantGlobalCommandCentreRoutes(tenantId: string): {
  dashboard: string;
  presentation: string;
  presentationQueryRedirect: string;
} {
  const base = `/fi-admin/${tenantId}/global-command-centre`;
  return {
    dashboard: base,
    presentation: `${base}/presentation`,
    presentationQueryRedirect: `${base}?presentation=true`,
  };
}

export function appendGlobalCommandCentreValidationCheck(
  checks: GlobalCommandCentreValidationCheck[],
  check: GlobalCommandCentreValidationCheck
): void {
  checks.push(check);
}

export function finalizeGlobalCommandCentreValidationReport(input: {
  tenantId: string;
  tenantSlug: string;
  validatedAt: string;
  checks: GlobalCommandCentreValidationCheck[];
}): GlobalCommandCentreValidationReport {
  const summary = { pass: 0, warn: 0, fail: 0 };
  for (const check of input.checks) summary[check.severity] += 1;
  return {
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    validatedAt: input.validatedAt,
    summary,
    readyForDemo: summary.fail === 0,
    checks: input.checks,
  };
}

export function validateGlobalCommandCentrePayloadForDemo(
  payload: GlobalCommandCentrePayload,
  checks: GlobalCommandCentreValidationCheck[]
): void {
  if (payload.tenantSlug !== ENTERPRISE_DEMO_TENANT_SLUG) {
    appendGlobalCommandCentreValidationCheck(checks, {
      id: "tenant_slug",
      label: "Enterprise demo tenant slug",
      severity: "fail",
      detail: `Expected slug "${ENTERPRISE_DEMO_TENANT_SLUG}", got "${payload.tenantSlug}".`,
    });
    return;
  }

  appendGlobalCommandCentreValidationCheck(checks, {
    id: "tenant_slug",
    label: "Enterprise demo tenant slug",
    severity: "pass",
    detail: `Resolved IHRG demo tenant (${payload.tenantName}).`,
  });

  if (payload.networkKpis.activeClinics >= TITAN_DEMO_CLINIC_COUNT) {
    appendGlobalCommandCentreValidationCheck(checks, {
      id: "active_clinics",
      label: "Active clinics",
      severity: "pass",
      detail: `${payload.networkKpis.activeClinics} clinics loaded (expected ${TITAN_DEMO_CLINIC_COUNT}).`,
    });
  } else if (payload.networkKpis.activeClinics > 0) {
    appendGlobalCommandCentreValidationCheck(checks, {
      id: "active_clinics",
      label: "Active clinics",
      severity: "warn",
      detail: `${payload.networkKpis.activeClinics} clinics loaded — expected ${TITAN_DEMO_CLINIC_COUNT}. Re-run seed or check clinic slug metadata.`,
    });
  } else {
    appendGlobalCommandCentreValidationCheck(checks, {
      id: "active_clinics",
      label: "Active clinics",
      severity: "fail",
      detail: "No clinics found. Run npm run seed:enterprise-demo.",
    });
  }

  if (payload.clinicRiskRows.length >= TITAN_DEMO_CLINIC_COUNT) {
    appendGlobalCommandCentreValidationCheck(checks, {
      id: "clinic_risk_matrix",
      label: "Clinic risk matrix",
      severity: "pass",
      detail: `${payload.clinicRiskRows.length} clinic rows in risk matrix.`,
    });
  } else if (payload.clinicRiskRows.length > 0) {
    appendGlobalCommandCentreValidationCheck(checks, {
      id: "clinic_risk_matrix",
      label: "Clinic risk matrix",
      severity: "warn",
      detail: `${payload.clinicRiskRows.length} clinic rows — expected ${TITAN_DEMO_CLINIC_COUNT}.`,
    });
  } else {
    appendGlobalCommandCentreValidationCheck(checks, {
      id: "clinic_risk_matrix",
      label: "Clinic risk matrix",
      severity: "fail",
      detail: "Risk matrix is empty — dashboard will show empty state.",
    });
  }

  if (payload.alerts.length >= 3) {
    appendGlobalCommandCentreValidationCheck(checks, {
      id: "network_alerts",
      label: "Network alert feed",
      severity: "pass",
      detail: `${payload.alerts.length} curated franchise alerts visible.`,
    });
  } else if (payload.alerts.length > 0) {
    appendGlobalCommandCentreValidationCheck(checks, {
      id: "network_alerts",
      label: "Network alert feed",
      severity: "warn",
      detail: `${payload.alerts.length} alerts — expected at least 3 when all anomaly clinics are seeded.`,
    });
  } else {
    appendGlobalCommandCentreValidationCheck(checks, {
      id: "network_alerts",
      label: "Network alert feed",
      severity: "warn",
      detail: "No alerts — confirm Dubai, Bangkok, London, Athens, and Sydney clinic slugs are seeded.",
    });
  }

  const hasSurgicalTotals =
    payload.surgicalSnapshot.totalGraftsExtracted > 0 && payload.surgicalSnapshot.totalGraftsImplanted > 0;
  appendGlobalCommandCentreValidationCheck(checks, {
    id: "surgical_snapshot",
    label: "Surgical intelligence snapshot",
    severity: hasSurgicalTotals ? "pass" : "fail",
    detail: hasSurgicalTotals
      ? `Grafts extracted ${payload.surgicalSnapshot.totalGraftsExtracted.toLocaleString()} · implanted ${payload.surgicalSnapshot.totalGraftsImplanted.toLocaleString()}.`
      : "Surgical graft totals are zero — surgery seed may be missing.",
  });

  const hasOutcomeSignals =
    payload.outcomeSnapshot.auditsApproved > 0 ||
    payload.outcomeSnapshot.auditsWithWarnings > 0 ||
    payload.outcomeSnapshot.incompleteFollowUp > 0;
  appendGlobalCommandCentreValidationCheck(checks, {
    id: "outcome_snapshot",
    label: "Outcome / audit snapshot",
    severity: hasOutcomeSignals ? "pass" : "fail",
    detail: hasOutcomeSignals
      ? `Approved ${payload.outcomeSnapshot.auditsApproved} · warnings ${payload.outcomeSnapshot.auditsWithWarnings} · incomplete follow-up ${payload.outcomeSnapshot.incompleteFollowUp}.`
      : "No outcome audit signals — ImagingOS/AuditOS seed may be missing.",
  });

  if (payload.networkKpis.openFinancialRiskAlerts > 0) {
    appendGlobalCommandCentreValidationCheck(checks, {
      id: "financial_risk_signals",
      label: "Financial risk signals",
      severity: "pass",
      detail: `${payload.networkKpis.openFinancialRiskAlerts} open franchise risk alerts aggregated.`,
    });
  } else {
    appendGlobalCommandCentreValidationCheck(checks, {
      id: "financial_risk_signals",
      label: "Financial risk signals",
      severity: "warn",
      detail: "No open financial risk alerts — FinancialOS seed may be incomplete.",
    });
  }

  appendGlobalCommandCentreValidationCheck(checks, {
    id: "read_only_mode",
    label: "Read-only simulation",
    severity: payload.readOnly ? "pass" : "fail",
    detail: payload.readOnly ? "Payload marked read-only." : "Expected readOnly=true for demo safety.",
  });
}

export function validateSyntheticImageStoragePath(storagePath: string): boolean {
  return storagePath.includes(TITAN_DEMO_SYNTHETIC_IMAGE_PATH_PREFIX);
}
